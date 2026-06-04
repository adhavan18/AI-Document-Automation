"""
PDF pre-processing pipeline for USCIS form extraction.

Returns a PreprocessResult dict with:
    acroform_fields  – dict of AcroForm field names → values
    raw_text         – concatenated pdfplumber text across all pages
    ocr_text         – pytesseract output (empty string if not needed/run)
    page_images      – list of base64-encoded PNG strings, one per page
    form_version     – edition date string parsed from page 1 (e.g. "01/17/23")
    is_scanned       – True when the PDF contains no embedded fonts

I-797 notice-of-action PDFs have no AcroForm; pass form_type="I-797" to
skip AcroForm extraction and go straight to regex-based text parsing.
"""

from __future__ import annotations

import base64
import re
import subprocess
import tempfile
from pathlib import Path
from typing import TypedDict

import os
import cv2
import numpy as np
import pdfplumber
import pypdf
import pypdfium2
import pytesseract

# Point pytesseract to Tesseract binary on Windows
os.environ['TESSERACT_CMD'] = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
pytesseract.pytesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# ---------------------------------------------------------------------------
# Return type
# ---------------------------------------------------------------------------

class PreprocessResult(TypedDict):
    acroform_fields: dict[str, str | None]
    raw_text: str
    ocr_text: str
    page_images: list[str]          # base64-encoded PNG, one per page
    form_version: str | None
    is_scanned: bool


# ---------------------------------------------------------------------------
# Edition-date pattern: "Edition MM/DD/YY" anywhere on bottom of page 1
# ---------------------------------------------------------------------------
_EDITION_RE = re.compile(r"Edition\s+(\d{2}/\d{2}/\d{2})", re.IGNORECASE)


def _log(msg: str) -> None:
    print(f"[PREPROCESSOR] {msg}")


# ---------------------------------------------------------------------------
# Step 1 — AcroForm extraction
# ---------------------------------------------------------------------------

def _extract_acroform(pdf_path: str) -> dict[str, str | None]:
    _log("Step 1 — extracting AcroForm fields with pypdf")
    reader = pypdf.PdfReader(pdf_path)
    raw = reader.get_fields() or {}
    fields: dict[str, str | None] = {}
    for name, field in raw.items():
        val = field.get("/V")
        if val is None:
            fields[name] = None
        elif isinstance(val, pypdf.generic.NameObject):
            fields[name] = str(val).lstrip("/")
        else:
            fields[name] = str(val)
    _log(f"  found {len(fields)} AcroForm fields")
    return fields


# ---------------------------------------------------------------------------
# Step 2 — Text extraction
# ---------------------------------------------------------------------------

def _extract_text(pdf_path: str) -> tuple[str, list[str]]:
    """
    Returns (full_raw_text, per_page_texts).

    Uses pypdf for text extraction (10x faster than pdfplumber on digital PDFs).
    Falls back to pdfplumber only if pypdf yields no text (e.g. image-only pages).
    """
    _log("Step 2 — extracting text with pypdf (fast path)")
    reader = pypdf.PdfReader(pdf_path)
    pages_text: list[str] = [
        (page.extract_text() or "") for page in reader.pages
    ]
    raw_text = "\n".join(pages_text)
    total = len(raw_text.strip())
    _log(f"  pypdf: {len(pages_text)} pages, {len(raw_text)} chars")

    if total < 100:
        # pypdf got nothing — fall back to pdfplumber (handles some edge cases)
        _log("  pypdf yielded minimal text — falling back to pdfplumber")
        pages_text = []
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                pages_text.append(page.extract_text() or "")
        raw_text = "\n".join(pages_text)
        _log(f"  pdfplumber: {len(raw_text)} chars")

    return raw_text, pages_text


# ---------------------------------------------------------------------------
# Step 3 — Form version detection
# ---------------------------------------------------------------------------

def _detect_form_version(pdf_path: str, page1_text: str) -> str | None:
    _log("Step 3 — detecting form edition date")
    # Primary: search the pdfplumber text of page 1
    match = _EDITION_RE.search(page1_text)
    if match:
        edition = match.group(1)
        _log(f"  edition found in text layer: {edition}")
        return edition

    # Fallback: search AcroForm field names for edition pattern
    try:
        reader = pypdf.PdfReader(pdf_path)
        # Check PDF metadata
        info = reader.metadata or {}
        for v in info.values():
            if v and isinstance(v, str):
                m = _EDITION_RE.search(v)
                if m:
                    _log(f"  edition found in PDF metadata: {m.group(1)}")
                    return m.group(1)
    except Exception as exc:
        _log(f"  metadata check failed: {exc}")

    _log("  edition date not found")
    return None


# ---------------------------------------------------------------------------
# Step 4 — Scan detection via pdffonts (poppler)
# ---------------------------------------------------------------------------

def _detect_scanned(pdf_path: str) -> bool:
    _log("Step 4 — detecting whether PDF is scanned (pdffonts)")
    try:
        result = subprocess.run(
            ["pdffonts", pdf_path],
            capture_output=True,
            text=True,
            timeout=30,
        )
        # pdffonts header is 2 lines; any data line means fonts are present
        lines = [l for l in result.stdout.splitlines() if l.strip()]
        has_fonts = len(lines) > 2
        is_scanned = not has_fonts
        _log(f"  pdffonts returned {max(0, len(lines) - 2)} font entries → is_scanned={is_scanned}")
        return is_scanned
    except FileNotFoundError:
        _log("  pdffonts not found on PATH — skipping font check, defaulting is_scanned=False")
        return False
    except subprocess.TimeoutExpired:
        _log("  pdffonts timed out — defaulting is_scanned=False")
        return False
    except Exception as exc:
        _log(f"  pdffonts error ({exc}) — defaulting is_scanned=False")
        return False


# ---------------------------------------------------------------------------
# Step 5 — Rasterise, preprocess, OCR
# ---------------------------------------------------------------------------

def _deskew(image: np.ndarray) -> np.ndarray:
    """Rotate the image to correct skew using Hough-line angle estimation."""
    coords = np.column_stack(np.where(image > 0))
    if coords.size == 0:
        return image
    angle = cv2.minAreaRect(coords)[-1]
    # minAreaRect returns angles in [-90, 0); map to [-45, 45)
    if angle < -45:
        angle = 90 + angle
    if abs(angle) < 0.5:  # negligible skew
        return image
    h, w = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC,
                              borderMode=cv2.BORDER_REPLICATE)
    return rotated


def _preprocess_image(img_array: np.ndarray) -> np.ndarray:
    """Grayscale → adaptive threshold → deskew."""
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    binary = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=31,
        C=10,
    )
    deskewed = _deskew(binary)
    return deskewed


def _rasterise_and_ocr(pdf_path: str, dpi: int = 150) -> tuple[str, list[np.ndarray]]:
    """
    Rasterise every page with pypdfium2 at `dpi`, preprocess with OpenCV,
    run tesseract via subprocess, and return (ocr_text, list_of_raw_rgb_arrays).
    """
    _log(f"Step 5 — rasterising at {dpi} DPI and running OCR")
    doc = pypdfium2.PdfDocument(pdf_path)
    page_texts: list[str] = []
    raw_arrays: list[np.ndarray] = []

    scale = dpi / 72.0  # pypdfium2 default unit is 72 pt/inch
    tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        bitmap = page.render(scale=scale, rotation=0)
        pil_image = bitmap.to_pil()
        img_array = np.array(pil_image)
        raw_arrays.append(img_array)

        processed = _preprocess_image(img_array)
        text = ""

        try:
            # Save preprocessed image to temp file
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                tmp_path = tmp.name
                bgr = cv2.cvtColor(processed, cv2.COLOR_GRAY2BGR) if len(processed.shape) == 2 else processed
                cv2.imwrite(tmp_path, bgr)

            # Call tesseract via subprocess
            result = subprocess.run(
                [tesseract_cmd, tmp_path, 'stdout'],
                capture_output=True,
                text=True,
                timeout=30,
            )
            text = result.stdout.strip()
            Path(tmp_path).unlink(missing_ok=True)
        except FileNotFoundError:
            _log(f"  Tesseract binary not found at {tesseract_cmd} — OCR skipped for page {page_idx + 1}")
            text = ""
        except subprocess.TimeoutExpired:
            _log(f"  Tesseract timeout on page {page_idx + 1}")
            text = ""
        except Exception as exc:
            _log(f"  OCR error on page {page_idx + 1}: {exc}")
            text = ""

        page_texts.append(text)
        _log(f"  page {page_idx + 1}: OCR produced {len(text)} chars")

    ocr_text = "\n".join(page_texts)
    _log(f"  total ocr_text length: {len(ocr_text)} chars")
    return ocr_text, raw_arrays


# ---------------------------------------------------------------------------
# Step 6 — Base64-encode page images
# ---------------------------------------------------------------------------

def _encode_images(
    pdf_path: str,
    raw_arrays: list[np.ndarray] | None,
    dpi: int = 150,
) -> list[str]:
    """
    Encode pages as base64 PNG strings.
    Uses already-rasterised arrays when available; otherwise rasterises now.
    """
    _log("Step 6 — encoding page images to base64")

    if raw_arrays is None:
        _log("  rasterising for image encoding (OCR path was not taken)")
        doc = pypdfium2.PdfDocument(pdf_path)
        scale = dpi / 72.0
        raw_arrays = []
        for page_idx in range(len(doc)):
            bitmap = doc[page_idx].render(scale=scale, rotation=0)
            raw_arrays.append(np.array(bitmap.to_pil()))

    encoded: list[str] = []
    for i, arr in enumerate(raw_arrays):
        # arr is RGB from pypdfium2/PIL; cv2.imencode expects BGR
        bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
        success, buffer = cv2.imencode(".png", bgr)
        if not success:
            _log(f"  failed to encode page {i + 1} as PNG — skipping")
            encoded.append("")
            continue
        b64 = base64.b64encode(buffer).decode("ascii")
        encoded.append(b64)
        _log(f"  page {i + 1}: {len(b64)} base64 chars")

    return encoded


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def preprocess(pdf_path: str, form_type: str = "") -> PreprocessResult:
    """
    Run the full pre-processing pipeline on a USCIS PDF.

    Parameters
    ----------
    pdf_path:
        Absolute or relative path to the PDF file.
    form_type:
        One of "I-485", "N-400", "I-129", "I-140", "I-797".
        When "I-797", AcroForm extraction is skipped entirely because
        notices of action are USCIS-generated PDFs with no fillable fields.

    Returns
    -------
    PreprocessResult dict with keys:
        acroform_fields, raw_text, ocr_text, page_images,
        form_version, is_scanned.
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    _log(f"Starting pipeline for: {path.name}  form_type={form_type or '(unspecified)'}")

    # Step 1 — I-797 has no AcroForm; skip to avoid noise
    if form_type == "I-797":
        _log("Step 1 — skipped (I-797 has no AcroForm fields)")
        acroform_fields: dict[str, str | None] = {}
    else:
        acroform_fields = _extract_acroform(str(path))

    # Steps 2 + 3
    raw_text, pages_text = _extract_text(str(path))
    form_version = _detect_form_version(str(path), pages_text[0] if pages_text else "")

    # Step 4 — detect scanned PDF
    # pdffonts (poppler) may not be on PATH on Windows; fall back to checking
    # whether text extraction yielded anything — if not, it must be image-only.
    is_scanned = _detect_scanned(str(path))
    if not is_scanned and not raw_text.strip() and not acroform_fields:
        _log("Step 4 — no text and no AcroForm found; treating as scanned")
        is_scanned = True

    # Step 5 — OCR when needed
    raw_arrays: list[np.ndarray] | None = None
    ocr_text = ""
    if is_scanned or not acroform_fields:
        _log("  OCR triggered (is_scanned or no AcroForm fields)")
        ocr_text, raw_arrays = _rasterise_and_ocr(str(path))
    else:
        _log("Step 5 — OCR skipped (native text + AcroForm fields present)")

    # Step 6 — only rasterise to images if OCR already produced raw arrays
    # (i.e. scanned PDF path). For digital PDFs with AcroForm fields the LLM
    # correction path is skipped anyway so images are never needed.
    if raw_arrays is not None:
        page_images = _encode_images(str(path), raw_arrays)
        _log(f"Step 6 — encoded {len(page_images)} page image(s) from OCR arrays")
    else:
        page_images = []
        _log("Step 6 — skipped (digital PDF, images not needed)")

    _log("Pipeline complete.")
    return PreprocessResult(
        acroform_fields=acroform_fields,
        raw_text=raw_text,
        ocr_text=ocr_text,
        page_images=page_images,
        form_version=form_version,
        is_scanned=is_scanned,
    )

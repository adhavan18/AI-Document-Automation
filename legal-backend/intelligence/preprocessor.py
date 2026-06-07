"""
PDF pre-processing pipeline for USCIS form extraction.

Returns a PreprocessResult dict with:
    acroform_fields  – dict of AcroForm field names → values
    raw_text         – concatenated pypdf text across all pages
    ocr_text         – AWS Textract output (empty string if not needed/run)
    page_images      – list of base64-encoded PNG strings, one per page
    form_version     – edition date string parsed from page 1 (e.g. "01/17/23")
    is_scanned       – True when the PDF contains no embedded fonts

I-797 notice-of-action PDFs have no AcroForm; pass form_type="I-797" to
skip AcroForm extraction and go straight to regex-based text parsing.
"""

from __future__ import annotations

import base64
import io
import re
import subprocess
from pathlib import Path
from typing import TypedDict

import pypdf
import pypdfium2


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

def _extract_acroform(reader: pypdf.PdfReader) -> dict[str, str | None]:
    _log("Step 1 — extracting AcroForm fields with pypdf")
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

def _page_has_fonts(page) -> bool:
    try:
        resources = page.get("/Resources", {})
        return bool(resources.get("/Font"))
    except Exception:
        return True


def _extract_text(reader: pypdf.PdfReader) -> tuple[str, list[str]]:
    _log("Step 2 — extracting text with pypdf")
    pages_text: list[str] = []
    for page in reader.pages:
        if not _page_has_fonts(page):
            pages_text.append("")
        else:
            pages_text.append(page.extract_text() or "")
    raw_text = "\n".join(pages_text)
    _log(f"  pypdf: {len(pages_text)} pages, {len(raw_text)} chars")
    return raw_text, pages_text


# ---------------------------------------------------------------------------
# Step 3 — Form version detection
# ---------------------------------------------------------------------------

def _detect_form_version(reader: pypdf.PdfReader, page1_text: str) -> str | None:
    _log("Step 3 — detecting form edition date")
    match = _EDITION_RE.search(page1_text)
    if match:
        _log(f"  edition found in text layer: {match.group(1)}")
        return match.group(1)
    try:
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
        lines = [l for l in result.stdout.splitlines() if l.strip()]
        is_scanned = len(lines) <= 2
        _log(f"  pdffonts: {max(0, len(lines) - 2)} font(s) → is_scanned={is_scanned}")
        return is_scanned
    except FileNotFoundError:
        _log("  pdffonts not on PATH — defaulting is_scanned=False")
        return False
    except subprocess.TimeoutExpired:
        _log("  pdffonts timed out — defaulting is_scanned=False")
        return False
    except Exception as exc:
        _log(f"  pdffonts error ({exc}) — defaulting is_scanned=False")
        return False


# ---------------------------------------------------------------------------
# Step 5 — AWS Textract OCR
# ---------------------------------------------------------------------------

def _run_textract(pdf_path: str) -> str:
    from intelligence.textract_ocr import is_available, ocr_pdf
    if not is_available():
        _log("Step 5 — Textract unavailable (check AWS credentials)")
        return ""
    _log("Step 5 — running AWS Textract OCR")
    return ocr_pdf(pdf_path)


# ---------------------------------------------------------------------------
# Step 6 — Base64-encode page images (for LLM vision fallback)
# ---------------------------------------------------------------------------

def _encode_images(pdf_path: str, dpi: int = 150) -> list[str]:
    _log("Step 6 — encoding page images to base64 PNG")
    try:
        doc = pypdfium2.PdfDocument(pdf_path)
    except Exception as exc:
        _log(f"  failed to open PDF for image encoding: {exc}")
        return []

    scale = dpi / 72.0
    encoded: list[str] = []
    for i in range(len(doc)):
        try:
            bitmap = doc[i].render(scale=scale, rotation=0)
            pil_image = bitmap.to_pil()
            buf = io.BytesIO()
            pil_image.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            encoded.append(b64)
            _log(f"  page {i + 1}: {len(b64)} base64 chars")
        except Exception as exc:
            _log(f"  page {i + 1} encoding failed: {exc}")
            encoded.append("")

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
        One of "I-485", "N-400", "I-129", "I-140", "I-797", etc.
        When "I-797", AcroForm extraction is skipped.

    Returns
    -------
    PreprocessResult dict.
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    _log(f"Starting pipeline for: {path.name}  form_type={form_type or '(unspecified)'}")

    reader = pypdf.PdfReader(str(path), strict=False)

    # Step 1 — AcroForm
    if form_type == "I-797":
        _log("Step 1 — skipped (I-797 has no AcroForm fields)")
        acroform_fields: dict[str, str | None] = {}
    else:
        acroform_fields = _extract_acroform(reader)

    # Steps 2 + 3
    raw_text, pages_text = _extract_text(reader)
    form_version = _detect_form_version(reader, pages_text[0] if pages_text else "")

    # Step 4 — scan detection
    is_scanned = _detect_scanned(str(path))
    if not is_scanned and not raw_text.strip() and not acroform_fields:
        _log("Step 4 — no text and no AcroForm; treating as scanned")
        is_scanned = True

    # Step 5 — Textract OCR when needed
    ocr_text = ""
    if is_scanned or not acroform_fields:
        ocr_text = _run_textract(str(path))
    else:
        _log("Step 5 — OCR skipped (native text + AcroForm fields present)")

    # Step 6 — page images for LLM vision fallback (scanned documents only)
    if is_scanned:
        page_images = _encode_images(str(path))
        _log(f"Step 6 — encoded {len(page_images)} page image(s)")
    else:
        page_images = []
        _log("Step 6 — skipped (digital PDF)")

    _log("Pipeline complete.")
    return PreprocessResult(
        acroform_fields=acroform_fields,
        raw_text=raw_text,
        ocr_text=ocr_text,
        page_images=page_images,
        form_version=form_version,
        is_scanned=is_scanned,
    )

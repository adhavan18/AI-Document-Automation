"""
EasyOCR PDF text extraction — replaces Tesseract.

EasyOCR is a pure-Python neural OCR library; no separate binary is needed.
pypdfium2 rasterises each page to a PIL image which EasyOCR then processes.

The Reader is lazy-loaded on first use (downloads ~100 MB of model weights
on first run) and cached as a module-level singleton for the process lifetime.

Usage
-----
    from intelligence.easyocr_text import ocr_pdf, is_available

    text = ocr_pdf("/path/to/form.pdf")
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

_READER: Any = None
_READER_LOCK = threading.Lock()


# ---------------------------------------------------------------------------
# Singleton reader
# ---------------------------------------------------------------------------

def _get_reader():
    global _READER
    if _READER is not None:
        return _READER
    with _READER_LOCK:
        if _READER is not None:
            return _READER
        try:
            import easyocr
            print("[EASYOCR] Loading English reader (first run downloads ~100 MB)…")
            _READER = easyocr.Reader(["en"], gpu=False, verbose=False)
            print("[EASYOCR] Reader ready.")
            return _READER
        except ImportError:
            print("[EASYOCR] easyocr not installed — OCR unavailable")
            return None
        except Exception as exc:
            print(f"[EASYOCR] Failed to initialise reader: {exc}")
            return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def ocr_pdf(pdf_path: str, dpi: int = 150, max_pages: int = 10) -> str:
    """
    Run EasyOCR on up to *max_pages* pages of the PDF.

    Returns the concatenated OCR text, or "" if EasyOCR is unavailable
    or the PDF has no rasterisable pages.
    """
    reader = _get_reader()
    if reader is None:
        return ""

    try:
        import numpy as np
        import pypdfium2
    except ImportError:
        print("[EASYOCR] pypdfium2 or numpy not installed")
        return ""

    path = Path(pdf_path)
    if not path.exists():
        return ""

    print(f"[EASYOCR] OCR start: {path.name}")
    doc = pypdfium2.PdfDocument(str(path))
    scale = dpi / 72.0
    page_texts: list[str] = []
    n = min(len(doc), max_pages)

    for i in range(n):
        bitmap = doc[i].render(scale=scale, rotation=0)
        img = np.array(bitmap.to_pil())

        # paragraph=True merges nearby text into coherent blocks
        results = reader.readtext(img, detail=0, paragraph=True)
        text = "\n".join(r for r in results if r.strip())
        page_texts.append(text)
        print(f"[EASYOCR] page {i + 1}/{n}: {len(text)} chars")

        # Stop early if first 3 pages are all empty (blank/corrupt PDF)
        if i >= 2 and not any(p.strip() for p in page_texts):
            print("[EASYOCR] first 3 pages blank — stopping early")
            break

    combined = "\n".join(page_texts)
    print(f"[EASYOCR] total OCR chars: {len(combined)}")
    return combined


def is_available() -> bool:
    """True when easyocr is importable."""
    try:
        import easyocr  # noqa: F401
        return True
    except ImportError:
        return False

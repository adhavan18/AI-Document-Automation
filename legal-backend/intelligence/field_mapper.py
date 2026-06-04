"""
Field mapping entry point — delegates to intelligence.native.

Retained for backwards compatibility. New code should call native.extract()
directly.
"""

from __future__ import annotations

from intelligence.native import (  # noqa: F401  (re-export)
    SUPPORTED_FORMS,
    AnyFormSchema,
    extract,
)
from intelligence.preprocessor import PreprocessResult
from models.schemas import I129, I140, I485, I797, N400


def map_fields(
    form_type: str,
    acroform_fields: dict[str, str | None],
    raw_text: str,
) -> I485 | N400 | I129 | I140 | I797:
    """
    Thin shim so existing call-sites keep working.

    Constructs a minimal PreprocessResult and calls native.extract().
    New code should call native.extract() directly with the full
    PreprocessResult so OCR text and scan-detection are available.
    """
    minimal: PreprocessResult = {
        "acroform_fields": acroform_fields,
        "raw_text": raw_text,
        "ocr_text": "",
        "page_images": [],
        "form_version": None,
        "is_scanned": False,
    }
    return extract(minimal, form_type)

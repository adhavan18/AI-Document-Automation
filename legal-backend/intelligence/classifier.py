"""
Stage 2 — Document Classifier.

Wraps the existing identifier to add edition_date, supplement,
form_title, confidence level (high/medium/low), and a human-readable
reason string.

If confidence == "low", the router must halt the pipeline.
"""
from __future__ import annotations

import re
from typing import TypedDict

from intelligence.identifier import identify, IdentifierResult
from intelligence.preprocessor import PreprocessResult
from models.schemas import FORM_METADATA


class ClassifierResult(TypedDict):
    stage: str
    form_id: str           # e.g. "I-485"
    form_title: str
    edition_date: str | None
    supplement: str | None
    confidence: str        # "high" | "medium" | "low"
    reason: str
    # Internal — detection_confidence float is kept for the router
    _detection_confidence: float


# Canonical form_id → display supplement label
_SUPPLEMENT_LABELS: dict[str, str] = {
    "I-485_SUPP_J": "Supplement J",
}

# Edition date patterns commonly found in USCIS form footers / headers
_EDITION_DATE_RE = re.compile(
    r'(?:edition|ed\.?|form\s+\w[-\w]+\s+)?'
    r'(\d{2}/\d{2}/\d{2,4})',
    re.IGNORECASE,
)


def _extract_edition_date(text: str) -> str | None:
    """
    Look for edition date in form footer text.
    USCIS forms print e.g. "Form I-485 Edition 09/17/19" or just "09/17/19"
    near "edition" or "uscis.gov".
    """
    # First try: near the word "edition"
    m = re.search(
        r'edition\s+(\d{2}/\d{2}/\d{2,4})',
        text,
        re.IGNORECASE,
    )
    if m:
        return m.group(1)

    # Second try: near "uscis.gov" or form-number headers in footer
    footer_slice = text[-3000:] if len(text) > 3000 else text
    m = _EDITION_DATE_RE.search(footer_slice)
    if m:
        return m.group(1)

    return None


def classify(
    preprocess_result: PreprocessResult,
    form_type_override: str | None = None,
) -> ClassifierResult:
    """
    Run Stage 2 classification.

    Parameters
    ----------
    preprocess_result:
        Output of preprocessor.preprocess().
    form_type_override:
        Skip auto-detection and force this form type.

    Returns
    -------
    ClassifierResult dict.  If confidence == "low" the caller should halt.
    """
    text: str = (
        preprocess_result.get('ocr_text') or
        preprocess_result.get('raw_text') or ''
    )

    # ---------------------------------------------------------------- identify
    if form_type_override:
        form_id = form_type_override
        det_conf = 1.0
        via = 'override'
    else:
        id_result: IdentifierResult = identify(preprocess_result)
        form_id = id_result['form_type']
        det_conf = id_result['detection_confidence']
        via = 'acroform' if det_conf == 1.0 else 'keyword-scoring'

    # ---------------------------------------------------------------- metadata
    meta = FORM_METADATA.get(form_id)
    form_title = meta.full_name if meta else form_id
    supplement = _SUPPLEMENT_LABELS.get(form_id)

    # ---------------------------------------------------------------- edition date
    edition_date = _extract_edition_date(text)

    # ---------------------------------------------------------------- confidence band
    if form_id == 'unknown':
        confidence = 'low'
        reason = 'Form type could not be identified from AcroForm fields or text keywords.'
    elif det_conf >= 0.8 or via in ('acroform', 'override'):
        confidence = 'high'
        reason = (
            f'Identified as {form_id} via {via} '
            f'(detection score {det_conf:.0%}).'
        )
    elif det_conf >= 0.5:
        confidence = 'medium'
        reason = (
            f'Identified as {form_id} via {via} '
            f'(detection score {det_conf:.0%}); confirm form type before processing.'
        )
    else:
        confidence = 'low'
        reason = (
            f'Best keyword match is {form_id} but score is only {det_conf:.0%}; '
            f'manual confirmation required.'
        )

    return ClassifierResult(
        stage='document_classifier',
        form_id=form_id,
        form_title=form_title,
        edition_date=edition_date,
        supplement=supplement,
        confidence=confidence,
        reason=reason,
        _detection_confidence=det_conf,
    )

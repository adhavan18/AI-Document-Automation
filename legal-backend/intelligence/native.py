"""
Native extraction layer.

Takes a PreprocessResult dict and a form_type string.
Returns a populated typed schema instance (from models.schemas) with
confidence scores derived purely from AcroForm data and regex on raw text.
Source is always "native" for populated fields.

AcroForm matching uses fuzzy substring lookup so real USCIS field-name
variants (which differ across form editions) resolve without hardcoded keys.

I-797 and I-290B have no AcroForm — both go straight to regex on raw_text.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Union

from intelligence.preprocessor import PreprocessResult
from intelligence.receipt_fields import extract_receipt_fields
from models.schemas import (
    FieldResult,
    I129,
    I129F,
    I130,
    I131,
    I140,
    I485,
    I485SuppJ,
    I539,
    I751,
    I765,
    I290B,
    I797,
    I824,
    I90,
    N400,
    N600,
    Source,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def _log(field: str, value: str | None, confidence: float) -> None:
    val_repr = repr(value) if value is not None else "null"
    print(f"[NATIVE] {field}: value={val_repr} confidence={confidence:.2f}")


# ---------------------------------------------------------------------------
# Known value sets
# ---------------------------------------------------------------------------

NONIMMIGRANT_CLASSIFICATIONS: frozenset[str] = frozenset({
    "B-1", "B-2",
    "E-1", "E-2", "E-3",
    "F-1", "F-2",
    "H-1B", "H-1B1", "H-2A", "H-2B", "H-3", "H-4",
    "J-1", "J-2",
    "K-1", "K-2", "K-3", "K-4",
    "L-1", "L-1A", "L-1B", "L-2",
    "M-1", "M-2",
    "O-1", "O-1A", "O-1B", "O-2", "O-3",
    "P-1", "P-1A", "P-1B", "P-2", "P-3",
    "Q-1",
    "R-1", "R-2",
    "TN", "TD",
    "V-1", "V-2",
})

PREFERENCE_CLASSIFICATIONS: frozenset[str] = frozenset({
    "EB-1", "EB-1A", "EB-1B", "EB-1C",
    "EB-2", "EB-2 NIW",
    "EB-3", "EB-3W",
    "EB-4",
    "EB-5", "EB-5C",
})

VALID_ACTIONS: frozenset[str] = frozenset({
    "APPROVED", "DENIED", "RECEIVED", "REJECTED",
})

I751_BASIS: frozenset[str] = frozenset({
    "joint_petition", "abuse_waiver", "hardship_waiver", "death_of_spouse",
})

I130_RELATIONSHIPS: frozenset[str] = frozenset({
    "spouse", "parent", "child", "sibling",
})

I131_DOC_TYPES: frozenset[str] = frozenset({
    "advance_parole", "reentry_permit", "refugee_travel_document",
})

I539_STATUSES: frozenset[str] = frozenset({
    "B-1", "B-2",
    "E-1", "E-2", "E-3",
    "F-1", "F-2",
    "H-1B", "H-1B1", "H-2A", "H-2B", "H-3", "H-4",
    "J-1", "J-2",
    "L-1", "L-1A", "L-1B", "L-2",
    "M-1", "M-2",
    "O-1", "O-2",
    "TN", "TD",
})

I765_CATEGORIES: frozenset[str] = frozenset({
    "A03", "A05", "A07", "A08", "A10", "A12",
    "B01", "B06",
    "C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08", "C09",
    "C10", "C11", "C12", "C14", "C16", "C17", "C18", "C19", "C20",
    "C22", "C24", "C25", "C26", "C28", "C29", "C31", "C33", "C34",
    "C35", "C36",
})

N600_BASIS: frozenset[str] = frozenset({
    "born_abroad_to_citizen", "derived_through_parent", "naturalized_parent",
})

I824_ACTIONS: frozenset[str] = frozenset({
    "notify_consulate", "transfer_file", "other",
})

I90_REASONS: frozenset[str] = frozenset({
    "01", "02", "03", "04", "05", "06", "07",
    "08", "09", "10", "11", "12", "13", "14",
})

KNOWN_FORM_NUMBERS: frozenset[str] = frozenset({
    "I-90", "I-129", "I-129F", "I-130", "I-131", "I-140", "I-290B",
    "I-360", "I-485", "I-526", "I-539", "I-600", "I-601", "I-751",
    "I-765", "I-797", "I-824", "N-400", "N-600",
})

_SOC_CODE_RE = re.compile(r"^\d{2}-\d{4}\.\d{2}$")

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

_RECEIPT_RE          = re.compile(r"\b([A-Z]{3}[0-9]{10})\b")
_NOTICE_DATE_RE      = re.compile(r"(?i)date[:\s]+(\d{2}/\d{2}/\d{4})")
_VALID_FROM_RE       = re.compile(r"(?i)valid\s+from[:\s]+(\d{2}/\d{2}/\d{4})")
_VALID_TO_RE         = re.compile(r"(?i)valid\s+(?:to|through|until)[:\s]+(\d{2}/\d{2}/\d{4})")
_ACTION_RE           = re.compile(r"\b(APPROVED|DENIED|RECEIVED|REJECTED)\b")
_CASE_TYPE_RE        = re.compile(r"\b(Form\s+[A-Z][-\w]+)", re.IGNORECASE)
_ALIEN_INLINE_RE     = re.compile(r"\b(A[-\s]?\d{8,9})\b", re.IGNORECASE)
_EIN_INLINE_RE       = re.compile(r"\b(\d{2}-\d{7})\b")
_SSN_INLINE_RE       = re.compile(r"\b(\d{3}-\d{2}-\d{4})\b")
_WAGE_INLINE_RE      = re.compile(r"(?i)wage[:\s]+\$?([\d,]+(?:\.\d{2})?)")
_DOB_INLINE_RE       = re.compile(r"(?i)date\s+of\s+birth[:\s]+(\d{2}/\d{2}/\d{4})")
# OCR-tolerant: "Date of Birth (mm/dd/yyyy) 03/15/1990" — skip non-digit noise between label and value
_DOB_OCR_RE          = re.compile(r"(?i)date\s+of\s+birth[^0-9]+(\d{1,2}/\d{1,2}/\d{4})")
_ENTRY_INLINE_RE     = re.compile(r"(?i)date\s+of\s+(?:last\s+)?entry[:\s]+(\d{2}/\d{2}/\d{4})")
_ENTRY_OCR_RE        = re.compile(r"(?i)date\s+of\s+(?:last\s+)?(?:entry|arrival)[^0-9]+(\d{1,2}/\d{1,2}/\d{4})")
# OCR legal-name extractor for I-485/N-400 layout. The OCR renders the name
# fields as:  "... Middle Name (if applicable) (Sharma Arjun Kumar Other Names …"
# i.e. the three values appear together right after the last "(if applicable)"
# label, often prefixed by a stray "(". We capture the first three Name-Case
# tokens following that anchor and reject the "N/A"/"NIA" empty-row marker.
_LEGAL_NAME_OCR_RE = re.compile(
    r"(?i)current\s+legal\s+name.*?middle\s+name\s*\(if\s+applicable\)\s*\(?\s*"
    r"([A-Z][a-zA-Z]{1,40})\s+([A-Z][a-zA-Z]{1,40})"
)
# Single-label fallbacks (used only if the combined pattern misses)
_FAMILY_NAME_OCR_RE  = re.compile(r"(?i)family\s+name\s*\(last\s+name\)\s*\(?\s*([A-Z][a-z]{2,40})\b")
_GIVEN_NAME_OCR_RE   = re.compile(r"(?i)given\s+name\s*\(first\s+name\)\s*\(?\s*([A-Z][a-z]{2,40})\b")
# OCR country extractor: "Country of Birth India" on its own line
_COB_OCR_RE          = re.compile(r"(?i)^country\s+of\s+birth\s+([A-Za-z][A-Za-z\s]{1,29}?)$", re.MULTILINE)
# OCR class of admission: "Class of Admission: F-1" or similar
_COA_OCR_RE          = re.compile(r"(?i)class\s+of\s+admission[:\s]+([A-Z0-9\-]{1,10})")
_PR_DATE_INLINE_RE   = re.compile(r"(?i)permanent\s+resident[:\s]+(\d{2}/\d{2}/\d{4})")
_PRIORITY_INLINE_RE  = re.compile(r"(?i)priority\s+date[:\s]+(\d{2}/\d{2}/\d{4})")
_NOTICE_TYPE_RE      = re.compile(r"(?i)notice\s+type\s*:\s*(.+)")
_APPLICANT_RE        = re.compile(r"(?i)(?:applicant|name)\s*:\s*(.+)")
_DATE_ANY_RE         = re.compile(r"\b(\d{2}/\d{2}/\d{4})\b")
_FORM_NUMBER_RE      = re.compile(r"\b((?:Form\s+)?(?:I|N)-\d+[A-Z]?)\b", re.IGNORECASE)
_YES_NO_RE           = re.compile(r"(?i)\b(yes|no)\b")
_SOC_INLINE_RE       = re.compile(r"\b(\d{2}-\d{4}\.\d{2})\b")
_CARD_EXPIRES_RE     = re.compile(r"(?i)(?:card\s+)?expir(?:es?|ation)[:\s]+(\d{2}/\d{2}/\d{4})")
_DECISION_DATE_RE    = re.compile(r"(?i)(?:date\s+of\s+)?decision[:\s]+(\d{2}/\d{2}/\d{4})")
_STATUS_EXPIRES_RE   = re.compile(r"(?i)(?:status\s+)?expires?[:\s]+(\d{2}/\d{2}/\d{4})")
_ADMISSION_DATE_RE   = re.compile(r"(?i)(?:date\s+of\s+)?admission[:\s]+(\d{2}/\d{2}/\d{4})")
_PARENT_DATE_RE      = re.compile(r"(?i)(?:citizenship|naturali[sz]ation)\s+date[:\s]+(\d{2}/\d{2}/\d{4})")
_APPROVAL_DATE_RE    = re.compile(r"(?i)approval\s+date[:\s]+(\d{2}/\d{2}/\d{4})")


def _regex_first(pattern: re.Pattern[str], text: str) -> str | None:
    m = pattern.search(text)
    return m.group(1).strip() if m else None


# ---------------------------------------------------------------------------
# Fuzzy AcroForm lookup
# ---------------------------------------------------------------------------

def _fuzzy_get(
    acro: dict[str, str | None],
    schema_field: str,
    extra_tokens: list[str] | None = None,
) -> str | None:
    """
    Return the first non-empty AcroForm value whose key (lowercased) contains
    schema_field or any of extra_tokens as a substring.
    """
    needles = [schema_field.lower().replace("_", "")] + [
        t.lower().replace("_", "") for t in (extra_tokens or [])
    ]
    for key, val in acro.items():
        if not val or not val.strip():
            continue
        key_lower = key.lower().replace("_", "").replace("[", "").replace("]", "")
        if any(needle in key_lower for needle in needles):
            return val.strip()
    return None


# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------

def _normalise_alien(raw: str) -> str:
    digits = re.sub(r"\D", "", raw)
    digits = digits[-9:] if len(digits) > 9 else digits
    return f"A{digits}"


def _normalise_date(raw: str) -> str:
    s = raw.strip().replace("-", "/")
    parts = s.split("/")
    if len(parts) != 3:
        return raw.strip()
    mm, dd, yy = parts
    if len(yy) == 2:
        yr = int(yy)
        yy = f"19{yy}" if yr >= 50 else f"20{yy}"
    return f"{mm}/{dd}/{yy}"


def _parse_date(raw: str) -> datetime | None:
    """Parse a MM/DD/YYYY string into a datetime, or None on failure."""
    try:
        return datetime.strptime(_normalise_date(raw), "%m/%d/%Y").replace(
            tzinfo=timezone.utc
        )
    except ValueError:
        return None


_DATE_VALID_RE    = re.compile(r"^\d{2}/\d{2}/\d{4}$")
_EIN_VALID_RE     = re.compile(r"^\d{2}-\d{7}$")
_SSN_VALID_RE     = re.compile(r"^\d{3}-\d{2}-\d{4}$")
_WAGE_STRIP_RE    = re.compile(r"[\$,\s]")
_RECEIPT_VALID_RE = re.compile(r"^[A-Z]{3}[0-9]{10}$")


# ---------------------------------------------------------------------------
# FieldResult factories (all source=native)
# ---------------------------------------------------------------------------

def _fr(field: str, value: str | None, confidence: float) -> FieldResult:
    fr = FieldResult(value=value, confidence=confidence, source=Source.native)
    _log(field, value, confidence)
    return fr


def _fr_text(field: str, raw: str | None) -> FieldResult:
    if not raw:
        return _fr(field, None, 0.0)
    return _fr(field, raw, 0.95)


def _fr_alien(field: str, raw: str | None) -> FieldResult:
    if not raw:
        return _fr(field, None, 0.0)
    normed = _normalise_alien(raw)
    digits = normed[1:]
    ok = len(digits) == 9 and digits.isdigit()
    return _fr(field, normed, 0.95 if ok else 0.3)


def _fr_date(field: str, raw: str | None) -> FieldResult:
    if not raw:
        return _fr(field, None, 0.0)
    normed = _normalise_date(raw)
    ok = bool(_DATE_VALID_RE.match(normed))
    return _fr(field, normed, 0.95 if ok else 0.4)


def _fr_date_future(field: str, raw: str | None) -> FieldResult:
    """Date that must be in the future; penalise if expired."""
    if not raw:
        return _fr(field, None, 0.0)
    normed = _normalise_date(raw)
    if not _DATE_VALID_RE.match(normed):
        return _fr(field, normed, 0.4)
    dt = _parse_date(normed)
    if dt is None:
        return _fr(field, normed, 0.4)
    in_future = dt > datetime.now(timezone.utc)
    return _fr(field, normed, 0.95 if in_future else 0.6)


def _fr_date_past(field: str, raw: str | None) -> FieldResult:
    """Date that must be in the past; penalise if in future."""
    if not raw:
        return _fr(field, None, 0.0)
    normed = _normalise_date(raw)
    if not _DATE_VALID_RE.match(normed):
        return _fr(field, normed, 0.4)
    dt = _parse_date(normed)
    if dt is None:
        return _fr(field, normed, 0.4)
    in_past = dt <= datetime.now(timezone.utc)
    return _fr(field, normed, 0.95 if in_past else 0.6)


def _fr_date_warn_expired(field: str, raw: str | None) -> FieldResult:
    """Date field that flags (confidence 0.6) when it's already expired."""
    if not raw:
        return _fr(field, None, 0.0)
    normed = _normalise_date(raw)
    if not _DATE_VALID_RE.match(normed):
        return _fr(field, normed, 0.4)
    dt = _parse_date(normed)
    if dt is None:
        return _fr(field, normed, 0.4)
    already_expired = dt <= datetime.now(timezone.utc)
    conf = 0.6 if already_expired else 0.95
    return _fr(field, normed, conf)


def _fr_ssn(field: str, raw: str | None) -> FieldResult:
    if not raw:
        return _fr(field, None, 0.0)
    v = raw.strip()
    ok = bool(_SSN_VALID_RE.match(v))
    return _fr(field, v, 0.95 if ok else 0.4)


def _fr_ein(field: str, raw: str | None) -> FieldResult:
    if not raw:
        return _fr(field, None, 0.0)
    v = raw.strip()
    ok = bool(_EIN_VALID_RE.match(v))
    return _fr(field, v, 0.95 if ok else 0.4)


def _fr_wage(field: str, raw: str | None) -> FieldResult:
    if not raw:
        return _fr(field, None, 0.0)
    stripped = _WAGE_STRIP_RE.sub("", raw.strip())
    try:
        float(stripped)
        return _fr(field, stripped, 0.95)
    except ValueError:
        return _fr(field, raw.strip(), 0.4)


def _fr_classification(
    field: str, raw: str | None, known: frozenset[str]
) -> FieldResult:
    if not raw:
        return _fr(field, None, 0.0)
    v = raw.strip().upper()
    in_list = any(v == k.upper() for k in known)
    return _fr(field, v, 0.95 if in_list else 0.5)


def _fr_enum(
    field: str, raw: str | None, known: frozenset[str], normalise_lower: bool = True
) -> FieldResult:
    """Enum field: value must be in known set (case-folded). 0.95 or 0.4."""
    if not raw:
        return _fr(field, None, 0.0)
    v = raw.strip()
    check = v.lower() if normalise_lower else v.upper()
    known_normalised = {k.lower() if normalise_lower else k.upper() for k in known}
    ok = check in known_normalised
    return _fr(field, v, 0.95 if ok else 0.4)


def _fr_receipt(field: str, raw: str | None) -> FieldResult:
    if not raw:
        return _fr(field, None, 0.0)
    v = raw.strip().upper()
    ok = bool(_RECEIPT_VALID_RE.match(v))
    return _fr(field, v, 0.95 if ok else 0.4)


def _fr_action(field: str, raw: str | None) -> FieldResult:
    if not raw:
        return _fr(field, None, 0.0)
    v = raw.strip().upper()
    ok = v in VALID_ACTIONS
    return _fr(field, v, 0.95 if ok else 0.4)


def _fr_bool_text(field: str, raw: str | None) -> FieldResult:
    """Boolean checkbox field — normalise to 'Yes'/'No', confidence 0.75."""
    if not raw:
        return _fr(field, None, 0.0)
    v = raw.strip().lower()
    if v in ("yes", "true", "1", "on", "/yes", "yes/"):
        return _fr(field, "Yes", 0.75)
    if v in ("no", "false", "0", "off", "/no", "no/"):
        return _fr(field, "No", 0.75)
    return _fr(field, raw.strip(), 0.4)


def _fr_soc_code(field: str, raw: str | None) -> FieldResult:
    """SOC code must match XX-XXXX.XX."""
    if not raw:
        return _fr(field, None, 0.0)
    v = raw.strip()
    ok = bool(_SOC_CODE_RE.match(v))
    return _fr(field, v, 0.95 if ok else 0.4)


# ---------------------------------------------------------------------------
# Per-form extractors — existing forms (unchanged)
# ---------------------------------------------------------------------------

def _extract_i485(acro: dict[str, str | None], raw_text: str, receipt: dict[str, FieldResult]) -> I485:
    return I485(**receipt)


def _extract_n400(acro: dict[str, str | None], raw_text: str, receipt: dict[str, FieldResult]) -> N400:
    return N400(**receipt)


def _extract_i129(acro: dict[str, str | None], raw_text: str, receipt: dict[str, FieldResult]) -> I129:
    return I129(**receipt)


def _extract_i140(acro: dict[str, str | None], raw_text: str, receipt: dict[str, FieldResult]) -> I140:
    return I140(**receipt)


def _extract_i797(raw_text: str, receipt_fields: dict[str, FieldResult]) -> I797:
    lines = raw_text.splitlines()
    top_block = "\n".join(lines[:30])

    case_type = _regex_first(_CASE_TYPE_RE, top_block)

    nt_m = _NOTICE_TYPE_RE.search(raw_text)
    notice_type = nt_m.group(1).strip() if nt_m else None

    return I797(
        **receipt_fields,
        notice_type=_fr_text("notice_type", notice_type),
        case_type=_fr_text("case_type", case_type),
    )


# ---------------------------------------------------------------------------
# Per-form extractors — new forms
# ---------------------------------------------------------------------------

def _extract_i751(acro: dict[str, str | None], raw_text: str, receipt: dict[str, FieldResult]) -> I751:
    return I751(**receipt)


def _extract_i130(acro: dict[str, str | None], raw_text: str, receipt: dict[str, FieldResult]) -> I130:
    return I130(**receipt)


def _extract_i131(acro: dict[str, str | None], raw_text: str, receipt: dict[str, FieldResult]) -> I131:
    return I131(**receipt)


def _extract_i539(acro: dict[str, str | None], raw_text: str, receipt: dict[str, FieldResult]) -> I539:
    return I539(**receipt)


def _extract_i765(acro: dict[str, str | None], raw_text: str, receipt: dict[str, FieldResult]) -> I765:
    return I765(**receipt)


def _extract_i290b(raw_text: str, receipt_fields: dict[str, FieldResult]) -> I290B:
    return I290B(**receipt_fields)


def _extract_i129f(acro: dict[str, str | None], raw_text: str, receipt: dict[str, FieldResult]) -> I129F:
    return I129F(**receipt)


def _extract_n600(acro: dict[str, str | None], raw_text: str, receipt: dict[str, FieldResult]) -> N600:
    return N600(**receipt)


def _extract_i485_supp_j(acro: dict[str, str | None], raw_text: str, receipt: dict[str, FieldResult]) -> I485SuppJ:
    return I485SuppJ(**receipt)


def _extract_i824(acro: dict[str, str | None], raw_text: str, receipt: dict[str, FieldResult]) -> I824:
    return I824(**receipt)


def _extract_i90(acro: dict[str, str | None], raw_text: str, receipt: dict[str, FieldResult]) -> I90:
    return I90(**receipt)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

AnyFormSchema = Union[
    I485, N400, I129, I140, I797,
    I751, I130, I131, I539, I765,
    I290B, I129F, N600, I485SuppJ, I824, I90,
]

_EXTRACTORS = {
    "I-485":        lambda acro, text, rcpt: _extract_i485(acro, text, rcpt),
    "N-400":        lambda acro, text, rcpt: _extract_n400(acro, text, rcpt),
    "I-129":        lambda acro, text, rcpt: _extract_i129(acro, text, rcpt),
    "I-140":        lambda acro, text, rcpt: _extract_i140(acro, text, rcpt),
    "I-797":        lambda acro, text, rcpt: _extract_i797(text, rcpt),
    "I-751":        lambda acro, text, rcpt: _extract_i751(acro, text, rcpt),
    "I-130":        lambda acro, text, rcpt: _extract_i130(acro, text, rcpt),
    "I-131":        lambda acro, text, rcpt: _extract_i131(acro, text, rcpt),
    "I-539":        lambda acro, text, rcpt: _extract_i539(acro, text, rcpt),
    "I-765":        lambda acro, text, rcpt: _extract_i765(acro, text, rcpt),
    "I-290B":       lambda acro, text, rcpt: _extract_i290b(text, rcpt),
    "I-129F":       lambda acro, text, rcpt: _extract_i129f(acro, text, rcpt),
    "N-600":        lambda acro, text, rcpt: _extract_n600(acro, text, rcpt),
    "I-485_SUPP_J": lambda acro, text, rcpt: _extract_i485_supp_j(acro, text, rcpt),
    "I-824":        lambda acro, text, rcpt: _extract_i824(acro, text, rcpt),
    "I-90":         lambda acro, text, rcpt: _extract_i90(acro, text, rcpt),
}

SUPPORTED_FORMS: frozenset[str] = frozenset(_EXTRACTORS)


def extract(
    preprocess_result: PreprocessResult,
    form_type: str,
    textract_fields: dict | None = None,
) -> AnyFormSchema:
    """
    Extract and validate fields from a PreprocessResult.

    Uses AcroForm data (fuzzy-matched) as primary source, with Textract
    structured form fields as secondary source, and regex on raw_text as fallback.
    I-797 and I-290B have no AcroForm and go straight to regex.

    Parameters
    ----------
    preprocess_result:
        Dict returned by preprocessor.preprocess().
    form_type:
        One of the 16 supported USCIS form keys.
    textract_fields:
        Optional dict of Textract form fields: {field_name: {"value": str, "confidence": float}}

    Returns
    -------
    Populated Pydantic schema instance with source="native" on all fields.
    """
    if form_type not in _EXTRACTORS:
        raise ValueError(
            f"Unsupported form_type {form_type!r}. "
            f"Supported: {sorted(SUPPORTED_FORMS)}"
        )

    acro = preprocess_result["acroform_fields"]
    raw_text = preprocess_result["ocr_text"] or preprocess_result["raw_text"]
    textract_fields = textract_fields or {}

    print(
        f"[NATIVE] Starting extraction for form_type={form_type} "
        f"acro_fields={len(acro)} textract_fields={len(textract_fields)} text_chars={len(raw_text)}"
    )

    # Merge AcroForm + Textract into a single fuzzy-lookup dict (Textract wins on ties)
    merged_acro = {**acro}
    for tf_key, tf_data in textract_fields.items():
        # Textract keys are more verbose; try to match against AcroForm keys
        for acro_key in list(merged_acro.keys()):
            if _fuzzy_match(tf_key, acro_key):
                if not merged_acro[acro_key] and tf_data.get("value"):
                    merged_acro[acro_key] = tf_data["value"]
                break
        else:
            # No AcroForm match; add Textract field directly
            merged_acro[tf_key] = tf_data.get("value")

    # Shared "Receipt record" fields — attached to every form schema.
    receipt = extract_receipt_fields(merged_acro, raw_text, form_type)
    for fname, fr in receipt.items():
        _log(f"receipt:{fname}", fr.value, fr.confidence)

    result = _EXTRACTORS[form_type](merged_acro, raw_text, receipt)

    print(f"[NATIVE] Extraction complete for {form_type}")
    return result


def _fuzzy_match(textract_key: str, acro_key: str) -> bool:
    """Check if Textract and AcroForm keys likely refer to the same field."""
    t_clean = textract_key.lower().replace(" ", "").replace("_", "").replace(":", "")
    a_clean = acro_key.lower().replace(" ", "").replace("_", "").replace("[", "").replace("]", "")
    return t_clean in a_clean or a_clean in t_clean

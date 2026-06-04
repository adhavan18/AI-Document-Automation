"""
Shared "Receipt record" fields.

These ten fields model a USCIS receipt-tracking record (the CRM-style
Receipt form) and are attached to *every* form schema via
``models.schemas.ReceiptFieldsMixin``.  This module provides the native
extraction for them so each per-form extractor can populate them with a
single call to :func:`extract_receipt_fields`.

Field set
---------
==========================  =========  ==============================================
field name                  type       notes
==========================  =========  ==============================================
primary_flag                bool       "Primary Flag" — defaults to "True"
sent_government_agency      date       "Sent Government Agency" (MM/DD/YYYY)
receipt_for                 string     "Receipt For" — lookup / free text
receipt_type                enum       "Receipt Type" * (required)
receipt_date                date       "Receipt Date"
receipt_notice_date         date       "Receipt Notice Date"
receipt_number              string     "Receipt Number" (USCIS XXX0000000000)
receipt_status              enum       "Receipt Status"
expiration_alert            bool       "Expiration Alert" — defaults to "No"
receipt_notes               string     "Receipt Notes" — free text
==========================  =========  ==============================================
"""

from __future__ import annotations

import re
from datetime import date, datetime

from models.schemas import FieldResult, Source

# ---------------------------------------------------------------------------
# Enumerations (from the UI dropdowns)
# ---------------------------------------------------------------------------

RECEIPT_TYPES: frozenset[str] = frozenset({
    "USCIS Receipt Number",
    "J Visa Application Number",
    "NVC Matter Number",
    "PERM Receipt",
    "Other",
})

RECEIPT_STATUSES: frozenset[str] = frozenset({
    "Pending", "Approved", "Denied", "RFE", "Withdrawn", "Shipped",
})

# Map a detected USCIS form_type to its default Receipt Type.
# Almost every supported form is a USCIS petition/application whose receipt is
# a standard USCIS receipt number; the special cases (J visa, NVC, PERM) are
# detected from text below and override this default.
_FORM_TYPE_TO_RECEIPT_TYPE: dict[str, str] = {
    "I-485": "USCIS Receipt Number",
    "N-400": "USCIS Receipt Number",
    "I-129": "USCIS Receipt Number",
    "I-140": "USCIS Receipt Number",
    "I-797": "USCIS Receipt Number",
    "I-751": "USCIS Receipt Number",
    "I-130": "USCIS Receipt Number",
    "I-131": "USCIS Receipt Number",
    "I-539": "USCIS Receipt Number",
    "I-765": "USCIS Receipt Number",
    "I-290B": "USCIS Receipt Number",
    "I-129F": "USCIS Receipt Number",
    "N-600": "USCIS Receipt Number",
    "I-485_SUPP_J": "USCIS Receipt Number",
    "I-824": "USCIS Receipt Number",
    "I-90": "USCIS Receipt Number",
}

# Window (in days) before a validity-end date within which we raise the
# expiration alert.
_EXPIRATION_WINDOW_DAYS = 90

# Field names attached to every schema, in display order.
RECEIPT_FIELD_NAMES: tuple[str, ...] = (
    "primary_flag",
    "sent_government_agency",
    "receipt_for",
    "receipt_type",
    "receipt_date",
    "receipt_notice_date",
    "receipt_number",
    "receipt_status",
    "expiration_alert",
    "receipt_notes",
)

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

_RECEIPT_NUM_RE      = re.compile(r"\b([A-Z]{3}[0-9]{10})\b")
_RECEIPT_DATE_RE     = re.compile(r"(?i)receipt\s+date[:\s]+(\d{1,2}/\d{1,2}/\d{2,4})")
_NOTICE_DATE_RE      = re.compile(r"(?i)notice\s+date[:\s]+(\d{1,2}/\d{1,2}/\d{2,4})")
_SENT_AGENCY_RE      = re.compile(r"(?i)(?:sent\s+(?:to\s+)?government\s+agency|date\s+sent)[:\s]+(\d{1,2}/\d{1,2}/\d{2,4})")

# Status keyword matching per spec. Ordered list — first match wins, so more
# specific phrases (RFE, card mailed) are checked before the generic ones.
_STATUS_KEYWORDS: tuple[tuple[str, str], ...] = (
    (r"request\s+for\s+evidence|\bRFE\b",      "RFE"),
    (r"card\s+was\s+mailed|\bshipped\b",       "Shipped"),
    (r"\bwithdrawn\b",                          "Withdrawn"),
    (r"\bdenied\b|\brejection\b|\brejected\b",  "Denied"),
    (r"\bapproved\b|\bapproval\b",              "Approved"),
    (r"\bpending\b",                            "Pending"),
)
_STATUS_RES: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (re.compile(pat, re.I), status) for pat, status in _STATUS_KEYWORDS
)

# Validity-end date for the expiration alert: a date appearing near a
# "valid"/"expires"/"valid until/through/to" keyword.
_VALIDITY_END_RE = re.compile(
    r"(?i)(?:valid\s+(?:until|through|to)|expires?(?:\s+on)?|expiration\s+date)"
    r"[:\s]+(\d{1,2}/\d{1,2}/\d{2,4})"
)

# "This document is a notice" signal — gates the loose keyword scans so that
# application-form boilerplate cannot produce false status/type values.
# Deliberately strict: the bare token "I-797" appears in many application-form
# instruction sections ("we will mail you an I-797 receipt notice"), so it is
# NOT a sufficient signal. We require explicit notice-header language. The far
# more reliable signal — an actual receipt number — is checked separately in
# _looks_like_notice().
_NOTICE_OF_ACTION_RE = re.compile(
    r"(?i)(?:notice\s+of\s+action|receipt\s+notice\s+date|approval\s+notice|"
    r"form\s+I-?797[A-C]?\b[, ]+notice\s+of\s+action)"
)

# Special receipt-type detection from notice text. Checked before the
# form_type default so a J/NVC/PERM document overrides the USCIS default.
_J_VISA_RE = re.compile(r"(?i)\b(?:DS-?2019|J-?1\s+visa|exchange\s+visitor|SEVIS)\b")
_NVC_RE    = re.compile(r"(?i)\b(?:National\s+Visa\s+Center|\bNVC\b)\b")
_PERM_RE   = re.compile(r"(?i)\b(?:PERM|labor\s+certification|ETA[- ]?9089)\b")

_DATE_VALID_RE       = re.compile(r"^\d{2}/\d{2}/\d{4}$")
_RECEIPT_VALID_RE    = re.compile(r"^[A-Z]{3}[0-9]{10}$")

# receipt_for — the applicant/petitioner/beneficiary the receipt is for.
# Deliberately conservative: only a clearly-labelled, capitalised name on the
# SAME line (no newline crossing) is accepted natively. The LLM fallback fills
# the harder cases. Over-eager matching here produced garbage like
# "informed me that he", so we require a strict Name-Case token sequence and
# reject lowercased prose via the [A-Z]... anchors plus a stop-word filter.
_RECEIPT_FOR_RE = re.compile(
    r"(?:Applicant|Petitioner|Beneficiary|Recipient)(?:'?s)?(?:\s+Name)?"
    r"[ \t]*[:\-][ \t]*"
    r"([A-Z][a-z]+(?:[ \t]+[A-Z][a-z'\-]+){1,3})"
)
# Tokens that look like names but are form/notice boilerplate — reject them.
_RECEIPT_FOR_STOPWORDS = frozenset({
    "type", "date", "form", "name", "the", "interviewed", "informed",
    "number", "status", "this", "your", "page", "part", "section",
})

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _first(pattern: re.Pattern[str], text: str) -> str | None:
    m = pattern.search(text)
    return m.group(1).strip() if m else None


def _clean_receipt_for(raw: str | None) -> str | None:
    """Reject false-positive name matches (form boilerplate) and tidy result."""
    if not raw:
        return None
    name = raw.strip()
    tokens = name.split()
    # A real name is 2-4 capitalised tokens, none of them boilerplate words.
    if not (2 <= len(tokens) <= 4):
        return None
    if any(t.lower() in _RECEIPT_FOR_STOPWORDS for t in tokens):
        return None
    return name


# A real receipt notice is short (typically 1-2 pages). Multi-page application
# packets run to tens of thousands of characters and only *mention* notices in
# their instructions — never treat those as notices on header text alone.
_NOTICE_MAX_CHARS = 8000


def _looks_like_notice(text: str) -> bool:
    """True when the document reads like an actual USCIS notice/receipt rather
    than a blank or filled application form.

    The reliable signal is a USCIS receipt number (``[A-Z]{3}[0-9]{10}``). Absent
    that, explicit notice-header language counts only on a *short* document —
    long application packets mention "Notice of Action" / "I-797" in their
    instructions and must not be misread as notices.
    """
    if _RECEIPT_NUM_RE.search(text):
        return True
    if len(text) <= _NOTICE_MAX_CHARS and _NOTICE_OF_ACTION_RE.search(text):
        return True
    return False


def _detect_status(text: str, is_notice: bool) -> tuple[str, float]:
    """Map notice language to a Receipt Status enum value per the spec.

    Only scans keywords when the document looks like a notice; otherwise returns
    the safe default 'Pending'. Returns (status, confidence).
    """
    if is_notice:
        for rx, status in _STATUS_RES:
            if rx.search(text):
                return status, 0.9
    return "Pending", 0.75  # default — no decision found / not a notice


def _detect_receipt_type(text: str, form_type: str | None, is_notice: bool) -> str:
    """Infer Receipt Type from the document text, then the form_type default.

    A J-visa / NVC / PERM marker overrides the USCIS default — but only on real
    notices, so incidental boilerplate on application forms can't flip the type.
    """
    if is_notice:
        if _J_VISA_RE.search(text):
            return "J Visa Application Number"
        if _NVC_RE.search(text):
            return "NVC Matter Number"
        if _PERM_RE.search(text):
            return "PERM Receipt"
    if form_type and form_type in _FORM_TYPE_TO_RECEIPT_TYPE:
        return _FORM_TYPE_TO_RECEIPT_TYPE[form_type]
    return "Other"


def _parse_mmddyyyy(normed: str) -> date | None:
    """Parse an already-normalised MM/DD/YYYY string into a date, or None."""
    if not _DATE_VALID_RE.match(normed):
        return None
    try:
        return datetime.strptime(normed, "%m/%d/%Y").date()
    except ValueError:
        return None


def _detect_expiration_alert(text: str, today: date | None = None) -> tuple[str, float]:
    """Return ('Yes'|'No', confidence).

    'Yes' when a validity-end date is found within the next
    ``_EXPIRATION_WINDOW_DAYS`` days (inclusive, future-facing).
    """
    today = today or date.today()
    raw = _first(_VALIDITY_END_RE, text)
    if not raw:
        return "No", 0.75  # default — no validity date present
    end = _parse_mmddyyyy(_normalise_date(raw))
    if end is None:
        return "No", 0.5
    delta = (end - today).days
    if 0 <= delta <= _EXPIRATION_WINDOW_DAYS:
        return "Yes", 0.9
    return "No", 0.9


def _normalise_date(raw: str) -> str:
    s = raw.strip().replace("-", "/")
    parts = s.split("/")
    if len(parts) != 3:
        return raw.strip()
    mm, dd, yy = parts
    mm = mm.zfill(2)
    dd = dd.zfill(2)
    if len(yy) == 2:
        yr = int(yy)
        yy = f"19{yy}" if yr >= 50 else f"20{yy}"
    return f"{mm}/{dd}/{yy}"


def _fr(value: str | None, confidence: float) -> FieldResult:
    return FieldResult(value=value, confidence=confidence, source=Source.native)


def _fr_date(raw: str | None) -> FieldResult:
    if not raw:
        return _fr(None, 0.0)
    normed = _normalise_date(raw)
    ok = bool(_DATE_VALID_RE.match(normed))
    return _fr(normed, 0.95 if ok else 0.4)


def _fr_receipt_number(raw: str | None) -> FieldResult:
    if not raw:
        return _fr(None, 0.0)
    v = raw.strip().upper()
    ok = bool(_RECEIPT_VALID_RE.match(v))
    return _fr(v, 0.95 if ok else 0.4)


def _fr_enum(raw: str | None, known: frozenset[str]) -> FieldResult:
    if not raw:
        return _fr(None, 0.0)
    v = raw.strip()
    match = next((k for k in known if k.lower() == v.lower()), None)
    return _fr(match or v, 0.95 if match else 0.4)


def _fr_text(raw: str | None) -> FieldResult:
    if not raw:
        return _fr(None, 0.0)
    return _fr(raw.strip(), 0.9)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def extract_receipt_fields(
    acro: dict[str, str | None],
    raw_text: str,
    form_type: str | None = None,
) -> dict[str, FieldResult]:
    """
    Extract the ten shared receipt-record fields from AcroForm + raw text.

    Parameters
    ----------
    acro:
        AcroForm field dict (currently unused — receipt data lives in the
        printed notice text, not fillable fields — kept for signature symmetry).
    raw_text:
        OCR/extracted document text.
    form_type:
        Detected USCIS form key, used to default ``receipt_type``.

    Notes
    -----
    ``primary_flag`` is always ``True`` when a notice is processed.
    ``receipt_status`` defaults to ``Pending`` when no status keyword is found.
    ``expiration_alert`` is ``Yes`` only when a validity-end date within 90 days
    is detected. ``receipt_for`` / ``receipt_notes`` are best-effort native and
    are improved by the LLM fallback when low confidence.
    """
    text = raw_text or ""

    is_notice = _looks_like_notice(text)

    # --- document-extractable fields -------------------------------------
    receipt_number = _first(_RECEIPT_NUM_RE, text)
    receipt_date   = _first(_RECEIPT_DATE_RE, text)
    notice_date    = _first(_NOTICE_DATE_RE, text)
    sent_agency    = _first(_SENT_AGENCY_RE, text)
    receipt_for    = _clean_receipt_for(_first(_RECEIPT_FOR_RE, text))

    status, status_conf = _detect_status(text, is_notice)
    receipt_type = _detect_receipt_type(text, form_type, is_notice)
    exp_value, exp_conf = _detect_expiration_alert(text)

    return {
        # always True when a USCIS notice is detected
        "primary_flag":           _fr("True", 0.95),
        "sent_government_agency": _fr_date(sent_agency),
        "receipt_for":            _fr_text(receipt_for),
        # required field — confident default from form_type, manual override OK
        "receipt_type":           _fr_enum(receipt_type, RECEIPT_TYPES),
        "receipt_date":           _fr_date(receipt_date),
        "receipt_notice_date":    _fr_date(notice_date),
        "receipt_number":         _fr_receipt_number(receipt_number),
        # status always resolves (defaults to Pending); confidence reflects
        # whether it came from a real notice decision or the safe default
        "receipt_status":         _fr(status, status_conf),
        "expiration_alert":       _fr(exp_value, exp_conf),
        # free-text notes — native leaves blank, LLM fallback may fill
        "receipt_notes":          _fr_text(None),
    }

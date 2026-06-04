"""
Stage 1 — Identity Resolver.

Scans preprocessed text for identity anchors without guessing.
Returns null for any anchor not confidently found.
"""
from __future__ import annotations

import re
from typing import TypedDict

from intelligence.preprocessor import PreprocessResult


class IdentityResult(TypedDict):
    stage: str
    client_name: str | None
    alien_number: str | None
    receipt_number: str | None
    date_of_birth: str | None
    ssn_last4: str | None
    employer_name: str | None


# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

_A_NUMBER = re.compile(
    r'\bA[-\s]?(\d{3}[-\s]?\d{3}[-\s]?\d{3})\b',
    re.IGNORECASE,
)

_RECEIPT = re.compile(
    r'\b([A-Z]{3}\d{10})\b',
)

_SSN_FULL = re.compile(
    r'\b\d{3}-\d{2}-(\d{4})\b',
)

# Dates in MM/DD/YYYY or YYYY-MM-DD
_DATE_MDY = re.compile(
    r'\b(0?[1-9]|1[0-2])/(0?[1-9]|[12]\d|3[01])/(19|20)\d{2}\b',
)
_DATE_ISO = re.compile(
    r'\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b',
)

# Name label patterns — look for value on the same line
_NAME_LABELS = re.compile(
    r'(?:family\s+name|last\s+name|applicant\s+name|beneficiary\s+name|'
    r'petitioner(?:\s+name)?|legal\s+name)[:\s]+([A-Z][A-Za-z\-\' ]{1,60})',
    re.IGNORECASE,
)
_GIVEN_LABELS = re.compile(
    r'(?:given\s+name|first\s+name)[:\s]+([A-Z][A-Za-z\-\' ]{1,40})',
    re.IGNORECASE,
)

# Employer / company name
_EMPLOYER_LABELS = re.compile(
    r'(?:company\s+name|employer(?:\s+name)?|petitioning\s+(?:company|organization|employer))[:\s]+'
    r'([A-Z][A-Za-z0-9\-\.,& ]{2,80})',
    re.IGNORECASE,
)

# DOB label
_DOB_LABELS = re.compile(
    r'(?:date\s+of\s+birth|d\.?o\.?b\.?)[:\s]+'
    r'((?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:19|20)\d{2}|(?:19|20)\d{2}-\d{2}-\d{2})',
    re.IGNORECASE,
)


def _clean_anumber(raw: str) -> str:
    digits = re.sub(r'\D', '', raw)
    return f'A-{digits[:3]}-{digits[3:6]}-{digits[6:9]}'


def _normalize_date(raw: str) -> str:
    """Convert MM/DD/YYYY → YYYY-MM-DD; pass ISO through."""
    raw = raw.strip()
    mdy = re.fullmatch(
        r'(0?[1-9]|1[0-2])/(0?[1-9]|[12]\d|3[01])/((?:19|20)\d{2})', raw
    )
    if mdy:
        m, d, y = mdy.groups()
        return f'{y}-{int(m):02d}-{int(d):02d}'
    return raw


def resolve(preprocess_result: PreprocessResult) -> IdentityResult:
    """
    Extract identity anchors from preprocessed PDF text.

    Uses AcroForm fields first (highest fidelity), then falls back to
    raw/OCR text pattern matching.  Returns null for anything not found.
    """
    text: str = preprocess_result.get('ocr_text') or preprocess_result.get('raw_text') or ''
    acro: dict[str, str | None] = preprocess_result.get('acroform_fields') or {}

    # ------------------------------------------------------------------ helpers
    def _acro_first(keys: list[str]) -> str | None:
        for k in keys:
            for ak, av in acro.items():
                if k in ak.lower() and av and av.strip():
                    return av.strip()
        return None

    # ------------------------------------------------------------------ A-Number
    alien_number: str | None = None
    # AcroForm first
    raw_a = _acro_first(['alien', 'a_number', 'anumber', 'a-number'])
    if raw_a:
        digits = re.sub(r'\D', '', raw_a)
        if len(digits) >= 7:
            alien_number = _clean_anumber(digits)
    # Regex fallback
    if not alien_number:
        m = _A_NUMBER.search(text)
        if m:
            alien_number = _clean_anumber(m.group(1))

    # ------------------------------------------------------------------ Receipt number
    receipt_number: str | None = None
    raw_r = _acro_first(['receipt', 'receipt_number'])
    if raw_r:
        rm = re.search(r'[A-Z]{3}\d{10}', raw_r.upper())
        if rm:
            receipt_number = rm.group(0)
    if not receipt_number:
        rm = _RECEIPT.search(text.upper())
        if rm:
            receipt_number = rm.group(1)

    # ------------------------------------------------------------------ Date of birth
    date_of_birth: str | None = None
    raw_dob = _acro_first(['dob', 'date_of_birth', 'birthdate', 'birth_date'])
    if raw_dob:
        date_of_birth = _normalize_date(raw_dob)
    if not date_of_birth:
        m = _DOB_LABELS.search(text)
        if m:
            date_of_birth = _normalize_date(m.group(1))

    # ------------------------------------------------------------------ SSN last 4
    ssn_last4: str | None = None
    raw_ssn = _acro_first(['ssn', 'social_security'])
    if raw_ssn:
        digits = re.sub(r'\D', '', raw_ssn)
        if len(digits) >= 4:
            ssn_last4 = digits[-4:]
    if not ssn_last4:
        m = _SSN_FULL.search(text)
        if m:
            ssn_last4 = m.group(1)

    # ------------------------------------------------------------------ Client name
    client_name: str | None = None
    family = _acro_first(['family_name', 'last_name', 'family name', 'applicant_name'])
    given = _acro_first(['given_name', 'first_name', 'given name'])
    if family and given:
        client_name = f'{family.strip()}, {given.strip()}'
    elif family:
        client_name = family.strip()
    else:
        # Text regex
        nm = _NAME_LABELS.search(text)
        gm = _GIVEN_LABELS.search(text)
        if nm and gm:
            client_name = f'{nm.group(1).strip()}, {gm.group(1).strip()}'
        elif nm:
            client_name = nm.group(1).strip()

    # ------------------------------------------------------------------ Employer name
    employer_name: str | None = None
    raw_emp = _acro_first(['company', 'employer', 'petitioner_name', 'organization'])
    if raw_emp:
        employer_name = raw_emp.strip()
    if not employer_name:
        em = _EMPLOYER_LABELS.search(text)
        if em:
            employer_name = em.group(1).strip().rstrip(',.')

    return IdentityResult(
        stage='identity_resolver',
        client_name=client_name,
        alien_number=alien_number,
        receipt_number=receipt_number,
        date_of_birth=date_of_birth,
        ssn_last4=ssn_last4,
        employer_name=employer_name,
    )

"""
Form-type identifier.

Takes a PreprocessResult dict and returns:
    form_type           — form key matching FORM_SCHEMAS, or "unknown"
    detection_confidence — float 0-1
    scores_by_form      — {form_key: normalised_score} for all 16 forms

Detection runs in order; first match wins:
    Step 1  AcroForm field-name pattern matching
    Step 2  Keyword scoring on text
    Step 3  Threshold gate (score > 0.3 required)
    Step 4  Supplement-J promotion (I-485 → I-485_SUPP_J when warranted)
"""

from __future__ import annotations

import re
from typing import TypedDict

from intelligence.preprocessor import PreprocessResult


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def _log(msg: str) -> None:
    print(f"[IDENTIFIER] {msg}")


# ---------------------------------------------------------------------------
# Return type
# ---------------------------------------------------------------------------

class IdentifierResult(TypedDict):
    form_type: str
    detection_confidence: float
    scores_by_form: dict[str, float]


# ---------------------------------------------------------------------------
# Step 1 — AcroForm field-name patterns
#
# Each entry is (form_key, [substring_patterns]).
# ALL patterns in the list must appear (case-insensitive) somewhere across
# the full set of AcroForm field names for the form to match.
# Ordered most-specific first so that I-485_SUPP_J beats I-485.
# ---------------------------------------------------------------------------

_ACROFORM_PATTERNS: list[tuple[str, list[str]]] = [
    # Supplement J has its own XFA tree node names
    ("I-485_SUPP_J", ["485", "suppj"]),
    ("I-485",        ["485"]),
    ("N-400",        ["400", "natz"]),
    ("I-129",        ["129"]),
    ("I-140",        ["140"]),
    ("I-751",        ["751"]),
    ("I-130",        ["130"]),
    ("I-131",        ["131"]),
    ("I-539",        ["539"]),
    ("I-765",        ["765"]),
    # I-290B and I-797 have no AcroForm — intentionally absent
    ("I-129F",       ["129f"]),
    ("N-600",        ["600", "natz"]),
    ("I-824",        ["824"]),
    ("I-90",         ["i90"]),
]


def _check_acroform(acroform_fields: dict[str, str | None]) -> str | None:
    """
    Return a form key if ANY AcroForm field name satisfies ALL patterns for
    that form, else None.

    We join all field names into one lowercased string so substring search
    works across the whole key space with a single pass per form.
    """
    if not acroform_fields:
        return None

    combined = " ".join(acroform_fields.keys()).lower()

    for form_key, patterns in _ACROFORM_PATTERNS:
        if all(p in combined for p in patterns):
            return form_key

    return None


# ---------------------------------------------------------------------------
# Step 2 — Keyword scoring
# ---------------------------------------------------------------------------

_FORM_KEYWORDS: dict[str, list[str]] = {
    "I-485": [
        "adjustment of status",
        "i-485",
        "lawful permanent resident",
        "green card",
    ],
    "N-400": [
        "naturalization",
        "n-400",
        "citizen of the united states",
        "oath of allegiance",
    ],
    "I-129": [
        "nonimmigrant worker",
        "i-129",
        "h-1b",
        "l-1",
        "petition for worker",
    ],
    "I-140": [
        "immigrant petition",
        "i-140",
        "alien worker",
        "eb-1",
        "eb-2",
        "eb-3",
    ],
    "I-797": [
        "notice of action",
        "i-797",
        "receipt number",
        "your case",
        "uscis has",
    ],
    "I-751": [
        "remove conditions",
        "i-751",
        "conditional resident",
        "joint petition",
    ],
    "I-130": [
        "petition for alien relative",
        "i-130",
        "relationship to beneficiary",
    ],
    "I-131": [
        "travel document",
        "i-131",
        "advance parole",
        "reentry permit",
        "refugee travel",
    ],
    "I-539": [
        "extend",
        "change of status",
        "i-539",
        "nonimmigrant status expires",
    ],
    "I-765": [
        "employment authorization",
        "i-765",
        "eligibility category",
        "ead",
    ],
    "I-290B": [
        "notice of appeal",
        "i-290b",
        "motion to reopen",
        "motion to reconsider",
    ],
    "I-129F": [
        "fiance",
        "i-129f",
        "k-1",
        "k-2",
        "petition for alien fiance",
    ],
    "N-600": [
        "certificate of citizenship",
        "n-600",
        "acquired citizenship",
        "derived citizenship",
    ],
    "I-485_SUPP_J": [
        "supplement j",
        "job offer",
        "portability",
        "soc code",
        "principal applicant",
    ],
    "I-824": [
        "action on approved",
        "i-824",
        "notify consulate",
        "transfer file",
    ],
    "I-90": [
        "renew",
        "replace",
        "i-90",
        "permanent resident card",
        "card expires",
    ],
}

_SUPPLEMENT_J_SIGNALS = frozenset({"supplement j", "portability"})


def _keyword_scores(text: str) -> dict[str, float]:
    """
    Return a dict of normalised keyword scores (0.0–1.0) for all 16 forms.
    Score = matched_keywords / total_keywords_for_form.
    """
    lower = text.lower()
    scores: dict[str, float] = {}
    for form_key, keywords in _FORM_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in lower)
        scores[form_key] = hits / len(keywords)
    return scores


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

_CONFIDENCE_THRESHOLD = 0.3


def identify(preprocess_result: PreprocessResult) -> IdentifierResult:
    """
    Identify the form type from a PreprocessResult.

    Parameters
    ----------
    preprocess_result:
        Dict returned by preprocessor.preprocess().

    Returns
    -------
    IdentifierResult with keys:
        form_type            — matched form key or "unknown"
        detection_confidence — normalised score (0.0 if unknown)
        scores_by_form       — raw scores for all 16 forms
    """
    acroform_fields = preprocess_result["acroform_fields"]
    # Prefer OCR text (richer for scanned docs), fall back to pdfplumber text
    text = preprocess_result["ocr_text"] or preprocess_result["raw_text"]

    # ------------------------------------------------------------------
    # Step 1 — AcroForm field-name pattern matching
    # ------------------------------------------------------------------
    acroform_match = _check_acroform(acroform_fields)
    if acroform_match:
        _log(f"Step 1: AcroForm match -> {acroform_match}")
        # Still compute keyword scores for the result payload
        scores = _keyword_scores(text)
        confidence = 1.0
        form_type = acroform_match

        # Step 4 — supplement check even on AcroForm path
        if form_type == "I-485" and any(sig in text.lower() for sig in _SUPPLEMENT_J_SIGNALS):
            _log("Step 4: Supplement J signals found — promoting I-485 -> I-485_SUPP_J")
            form_type = "I-485_SUPP_J"

        _log(f"Result: {form_type} (confidence={confidence:.2f}, via acroform)")
        return IdentifierResult(
            form_type=form_type,
            detection_confidence=confidence,
            scores_by_form=scores,
        )

    _log("Step 1: no AcroForm match — proceeding to keyword scoring")

    # ------------------------------------------------------------------
    # Step 2 — Keyword scoring
    # ------------------------------------------------------------------
    scores = _keyword_scores(text)

    if not text.strip():
        _log("Step 2: no text available — all scores 0.0")

    # ------------------------------------------------------------------
    # Step 3 — Pick highest scoring form
    # ------------------------------------------------------------------
    best_form = max(scores, key=lambda k: scores[k])
    best_score = scores[best_form]

    score_summary = ", ".join(
        f"{k}={v:.2f}" for k, v in sorted(scores.items(), key=lambda x: -x[1]) if v > 0
    ) or "all zeros"
    _log(f"Step 2: keyword scores — {score_summary}")
    _log(f"Step 3: best={best_form} score={best_score:.2f} threshold={_CONFIDENCE_THRESHOLD}")

    if best_score <= _CONFIDENCE_THRESHOLD:
        _log("Step 3: score below threshold — form_type=unknown")
        return IdentifierResult(
            form_type="unknown",
            detection_confidence=0.0,
            scores_by_form=scores,
        )

    form_type = best_form
    confidence = best_score

    # ------------------------------------------------------------------
    # Step 4 — Supplement-J promotion
    # ------------------------------------------------------------------
    if form_type == "I-485" and any(sig in text.lower() for sig in _SUPPLEMENT_J_SIGNALS):
        _log("Step 4: Supplement J signals found — promoting I-485 -> I-485_SUPP_J")
        form_type = "I-485_SUPP_J"
        # Use the Supp-J score if it's higher, otherwise keep I-485's score
        confidence = max(confidence, scores.get("I-485_SUPP_J", 0.0))

    _log(f"Result: {form_type} (confidence={confidence:.2f}, via keywords)")
    return IdentifierResult(
        form_type=form_type,
        detection_confidence=confidence,
        scores_by_form=scores,
    )

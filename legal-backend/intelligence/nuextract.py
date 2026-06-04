"""
NuExtract field extraction (numind/NuExtract-1.5-tiny).

NuExtract is a purely-extractive structured-output model — it only returns
text that actually appears in the source document, so it cannot hallucinate
values.  It replaces the regex/AcroForm native extractor for any field whose
native score is below the review threshold.

The model is lazy-loaded on first use and cached in the process.  On first
run it downloads ~500 MB to ~/.cache/huggingface/hub/ and takes ~30 s on CPU.
Subsequent runs load in ~5 s and inference is ~2–4 s per form on CPU.

Usage
-----
    from intelligence.nuextract import extract_fields, is_available

    if is_available():
        fields = extract_fields(ocr_text, form_type="I-485")
"""

from __future__ import annotations

import json
import re
import threading
from typing import Any

from models.schemas import FieldResult, Source

_MODEL: Any = None
_TOKENIZER: Any = None
_LOAD_LOCK = threading.Lock()
_MODEL_NAME = "numind/NuExtract-1.5-tiny"


# ---------------------------------------------------------------------------
# Model loader (thread-safe singleton)
# ---------------------------------------------------------------------------

def _load():
    global _MODEL, _TOKENIZER
    if _MODEL is not None:
        return _MODEL, _TOKENIZER
    with _LOAD_LOCK:
        if _MODEL is not None:
            return _MODEL, _TOKENIZER
        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer

            print(f"[NUEXTRACT] Loading {_MODEL_NAME} …")
            _TOKENIZER = AutoTokenizer.from_pretrained(
                _MODEL_NAME, trust_remote_code=True
            )
            dtype = torch.float16 if torch.cuda.is_available() else torch.float32
            _MODEL = AutoModelForCausalLM.from_pretrained(
                _MODEL_NAME,
                torch_dtype=dtype,
                trust_remote_code=True,
            )
            device = "cuda" if torch.cuda.is_available() else "cpu"
            _MODEL = _MODEL.to(device).eval()
            print(f"[NUEXTRACT] Ready on {device}")
            return _MODEL, _TOKENIZER
        except Exception as exc:
            print(f"[NUEXTRACT] Could not load model: {exc}")
            return None, None


# ---------------------------------------------------------------------------
# Low-level inference
# ---------------------------------------------------------------------------

def _run(text: str, schema: dict) -> dict:
    model, tokenizer = _load()
    if model is None:
        return {}
    import torch

    schema_str = json.dumps(schema, indent=2)
    prompt = (
        "<|input|>\n"
        "### Template:\n" + schema_str + "\n"
        "### Text:\n" + text[:8000] + "\n"
        "<|output|>\n"
    )
    device = next(model.parameters()).device
    inputs = tokenizer(
        prompt, return_tensors="pt", max_length=10000, truncation=True
    ).to(device)

    with torch.no_grad():
        out_ids = model.generate(
            **inputs,
            max_new_tokens=512,
            do_sample=False,
            temperature=1.0,
            repetition_penalty=1.1,
        )

    decoded = tokenizer.decode(out_ids[0], skip_special_tokens=True)

    # Pull the JSON between <|output|> … <|end-output|>
    raw = decoded
    if "<|output|>" in decoded:
        raw = decoded.split("<|output|>", 1)[1]
    if "<|end-output|>" in raw:
        raw = raw.split("<|end-output|>")[0]
    raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return {}


# ---------------------------------------------------------------------------
# Per-form extraction schemas
# ---------------------------------------------------------------------------

_FORM_SCHEMAS: dict[str, dict] = {
    # USCIS immigration forms
    "I-485": {
        "alien_registration_number": "",
        "family_name": "",
        "given_name": "",
        "date_of_birth": "",
        "country_of_birth": "",
        "date_of_entry": "",
        "class_of_admission": "",
        "ssn": "",
    },
    "N-400": {
        "family_name": "",
        "given_name": "",
        "date_of_birth": "",
        "country_of_birth": "",
        "alien_registration_number": "",
        "date_became_pr": "",
        "marital_status": "",
    },
    "I-129": {
        "petitioner_name": "",
        "petitioner_ein": "",
        "beneficiary_name": "",
        "beneficiary_alien_number": "",
        "nonimmigrant_classification": "",
        "period_of_stay_requested": "",
        "job_title": "",
        "wage_rate_of_pay": "",
    },
    "I-140": {
        "petitioner_name": "",
        "petitioner_ein": "",
        "beneficiary_name": "",
        "beneficiary_alien_number": "",
        "preference_classification": "",
        "priority_date": "",
        "job_title": "",
        "offered_wage": "",
    },
    "I-797": {
        "receipt_number": "",
        "notice_type": "",
        "applicant_name": "",
        "alien_registration_number": "",
        "case_type": "",
        "notice_date": "",
        "validity_start": "",
        "validity_end": "",
        "action_taken": "",
    },
    "I-751": {
        "alien_registration_number": "",
        "family_name": "",
        "given_name": "",
        "date_of_birth": "",
        "country_of_birth": "",
        "joint_petitioner_name": "",
        "date_card_expires": "",
        "basis_for_petition": "",
    },
    "I-130": {
        "petitioner_family_name": "",
        "petitioner_given_name": "",
        "petitioner_dob": "",
        "petitioner_alien_number": "",
        "relationship_to_beneficiary": "",
        "beneficiary_family_name": "",
        "beneficiary_given_name": "",
        "beneficiary_dob": "",
        "beneficiary_country_of_birth": "",
    },
    "I-131": {
        "family_name": "",
        "given_name": "",
        "alien_registration_number": "",
        "date_of_birth": "",
        "class_of_admission": "",
        "date_of_admission": "",
        "country_of_birth": "",
        "travel_document_type": "",
        "reason_for_travel": "",
    },
    "I-539": {
        "family_name": "",
        "given_name": "",
        "alien_registration_number": "",
        "date_of_birth": "",
        "country_of_birth": "",
        "current_nonimmigrant_status": "",
        "status_expires": "",
        "requested_status": "",
    },
    "I-765": {
        "family_name": "",
        "given_name": "",
        "alien_registration_number": "",
        "date_of_birth": "",
        "country_of_birth": "",
        "ssn": "",
        "eligibility_category": "",
        "date_eligibility_expires": "",
    },
    "I-290B": {
        "receipt_number": "",
        "form_type_appealed": "",
        "applicant_name": "",
        "alien_registration_number": "",
        "date_of_decision": "",
        "reason_for_appeal": "",
        "brief_attached": "",
    },
    "I-129F": {
        "petitioner_family_name": "",
        "petitioner_given_name": "",
        "petitioner_dob": "",
        "beneficiary_family_name": "",
        "beneficiary_given_name": "",
        "beneficiary_dob": "",
        "beneficiary_country_of_birth": "",
        "date_met_beneficiary": "",
        "prior_petitions": "",
    },
    "N-600": {
        "family_name": "",
        "given_name": "",
        "date_of_birth": "",
        "country_of_birth": "",
        "alien_registration_number": "",
        "us_citizen_parent_name": "",
        "parent_citizenship_date": "",
        "basis_for_citizenship": "",
    },
    "I-485_SUPP_J": {
        "alien_registration_number": "",
        "family_name": "",
        "given_name": "",
        "principal_applicant_name": "",
        "job_offer_employer": "",
        "job_offer_title": "",
        "job_offer_soc_code": "",
        "portability_claim": "",
    },
    "I-824": {
        "alien_registration_number": "",
        "family_name": "",
        "given_name": "",
        "original_form_type": "",
        "original_receipt_number": "",
        "original_approval_date": "",
        "action_requested": "",
    },
    "I-90": {
        "alien_registration_number": "",
        "family_name": "",
        "given_name": "",
        "date_of_birth": "",
        "country_of_birth": "",
        "card_expiration_date": "",
        "reason_for_replacement": "",
    },
}

# Shared receipt-record schema used across all USCIS forms
_RECEIPT_SCHEMA: dict = {
    "receipt_number": "",
    "receipt_date": "",
    "receipt_notice_date": "",
    "receipt_for": "",
    "receipt_type": "",
    "receipt_status": "",
    "sent_government_agency": "",
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_fields(text: str, form_type: str) -> dict[str, FieldResult]:
    """
    Extract form-specific fields from *text* using NuExtract.

    Returns {field_name: FieldResult(source='llm', confidence=0.85)} for
    every non-empty value the model finds.  Falls back silently if the model
    is not available or the text is empty.
    """
    if not text or not text.strip():
        return {}
    schema = _FORM_SCHEMAS.get(form_type)
    if schema is None:
        return {}

    print(f"[NUEXTRACT] Extracting fields for {form_type} ({len(text)} chars)")
    raw = _run(text, schema)
    return _to_field_results(raw)


def extract_receipt_fields(text: str) -> dict[str, FieldResult]:
    """Extract USCIS receipt-notice fields from *text* using NuExtract."""
    if not text or not text.strip():
        return {}
    print(f"[NUEXTRACT] Extracting receipt fields ({len(text)} chars)")
    raw = _run(text, _RECEIPT_SCHEMA)
    return _to_field_results(raw)


def is_available() -> bool:
    """True when transformers + torch are importable (model downloads on first call)."""
    try:
        import transformers  # noqa: F401
        import torch         # noqa: F401
        return True
    except ImportError:
        return False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_field_results(raw: dict) -> dict[str, FieldResult]:
    out: dict[str, FieldResult] = {}
    for name, val in raw.items():
        if isinstance(val, list):
            val = val[0] if val else ""
        if isinstance(val, str) and val.strip():
            out[name] = FieldResult(
                value=val.strip(),
                confidence=0.85,
                source=Source.llm,
            )
    return out

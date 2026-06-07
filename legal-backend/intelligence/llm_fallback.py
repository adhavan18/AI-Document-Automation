"""
LLM fallback layer for low-confidence fields.

Takes a typed schema instance (from native.extract), the raw PreprocessResult,
and the form_type string. Returns an updated schema instance with
low-confidence fields improved by Claude, plus a list of escalation_flags for
human review.

Only fields with confidence < CONFIDENCE_THRESHOLD are sent to the LLM.
High-confidence native fields are never re-processed.

Escalation triggers:
  - Any field still below 0.5 after LLM correction
  - Any narrative_flags returned by the LLM
  - Mandatory flags regardless of confidence:
      status_may_be_expired, prior_petitions_yes, invalid_soc_code,
      basis_conflict, no_brief_attached
"""

from __future__ import annotations

import os
from typing import Union

import anthropic
import instructor

from intelligence.preprocessor import PreprocessResult
from models.schemas import (
    FieldResult,
    I129,
    I129F,
    I129FLLM,
    I129LLM,
    I130,
    I130LLM,
    I131,
    I131LLM,
    I140,
    I140LLM,
    I290B,
    I290BLLM,
    I485,
    I485LLM,
    I485SuppJ,
    I485SuppJLLM,
    I539,
    I539LLM,
    I751,
    I751LLM,
    I765,
    I765LLM,
    I797,
    I797LLM,
    I824,
    I824LLM,
    I90,
    I90LLM,
    LLM_SCHEMAS,
    N400,
    N400LLM,
    N600,
    N600LLM,
    NoticeReceiptLLMExtract,
    Source,
)
from intelligence.receipt_fields import RECEIPT_FIELD_NAMES

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MODEL = "claude-sonnet-4-6"
CONFIDENCE_THRESHOLD = 0.7
ESCALATION_THRESHOLD = 0.5

# Narrative flag values that trigger mandatory human review regardless of
# field confidence scores.
MANDATORY_REVIEW_FLAGS: frozenset[str] = frozenset({
    "status_may_be_expired",
    "prior_petitions_yes",
    "invalid_soc_code",
    "basis_conflict",
    "no_brief_attached",
})

AnyFormSchema = Union[
    I485, N400, I129, I140, I797,
    I751, I130, I131, I539, I765,
    I290B, I129F, N600, I485SuppJ, I824, I90,
]
AnyLLMSchema = Union[
    I485LLM, N400LLM, I129LLM, I140LLM, I797LLM,
    I751LLM, I130LLM, I131LLM, I539LLM, I765LLM,
    I290BLLM, I129FLLM, N600LLM, I485SuppJLLM, I824LLM, I90LLM,
]

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------


def _log(msg: str) -> None:
    print(f"[LLM] {msg}")


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

_I765_CODES = (
    "A03 A05 A07 A08 A10 A12 B01 B06 C01 C02 C03 C04 C05 C06 C07 C08 C09 "
    "C10 C11 C12 C14 C16 C17 C18 C19 C20 C22 C24 C25 C26 C28 C29 C31 C33 "
    "C34 C35 C36"
)


def _form_addendum(form_type: str) -> str:
    """
    Return a form-specific instruction paragraph appended to the system
    prompt.  Empty string for forms with no special instructions.
    """
    if form_type == "I-797":
        return (
            " This is a USCIS Notice of Action — a machine-generated document, "
            "not a fillable form completed by an applicant. "
            "Fields such as receipt_number, validity_start, validity_end, and "
            "action_taken are machine-printed and should be extractable with high "
            "precision directly from the notice text. "
            "Do not treat ambiguity in these fields leniently — if the text clearly "
            "states a value, return it with high confidence."
        )

    if form_type == "I-751":
        return (
            " This form may be filed jointly with a spouse or with a waiver "
            "(abuse waiver, hardship waiver, or death of spouse). "
            "Identify the basis_for_petition from the checkbox section. "
            "If a joint_petitioner_name is present but the basis is marked as any "
            "waiver category, add 'basis_conflict' to narrative_flags — this is a "
            "red flag requiring human review."
        )

    if form_type == "I-130":
        return (
            " This form contains two distinct people: the petitioner (the US citizen "
            "or LPR filing) and the beneficiary (the relative being petitioned for). "
            "Extract each person's name, date of birth, and alien number separately. "
            "If the claimed relationship is 'sibling' but the petitioner_dob and "
            "beneficiary_dob are less than 9 months apart, add a narrative flag noting "
            "the implausible age gap."
        )

    if form_type == "I-131":
        return (
            " Identify travel_document_type from the checkbox section — valid values "
            "are advance_parole, reentry_permit, or refugee_travel_document. "
            "If the form lists countries of intended travel, include them in "
            "narrative_flags as 'intended_travel_countries: <list>'."
        )

    if form_type == "I-539":
        return (
            " Check the status_expires date against today's date. "
            "If the status has already expired, add exactly 'status_may_be_expired' "
            "to narrative_flags — this triggers mandatory human review. "
            "Extract current_nonimmigrant_status and requested_status as short visa "
            "codes (e.g. F-1, H-4, B-2)."
        )

    if form_type == "I-765":
        return (
            f" The eligibility_category field contains a short code such as C09 or A03. "
            f"If the field is blank or low confidence, infer the correct code from the "
            f"applicant's stated basis for employment authorization eligibility. "
            f"Valid codes are: {_I765_CODES}. "
            f"Return the code in uppercase (e.g. 'C09'). "
            f"If no valid code can be determined, return null with confidence 0.0."
        )

    if form_type == "I-290B":
        return (
            " This is an appeals document (Notice of Appeal or Motion), not a standard "
            "fillable form. The most important content is the reason for appeal, which "
            "may appear in an attached brief or written statement. "
            "Extract the core legal argument or grounds for appeal from the brief. "
            "If no brief or statement is attached, add exactly 'no_brief_attached' to "
            "narrative_flags — this triggers mandatory human review."
        )

    if form_type == "I-129F":
        return (
            " Extract the date the petitioner and beneficiary first met in person "
            "(date_met_beneficiary). "
            "If prior_petitions is answered 'Yes', add exactly 'prior_petitions_yes' "
            "to narrative_flags — this is a mandatory human review trigger. "
            "Prior approved K-1 petitions are a significant risk signal."
        )

    if form_type == "N-600":
        return (
            " Identify the basis for the citizenship claim: "
            "born_abroad_to_citizen, derived_through_parent, or naturalized_parent. "
            "If a US citizen parent's naturalization certificate number is present "
            "anywhere in the document, include it in narrative_flags as "
            "'parent_cert_number: <value>'."
        )

    if form_type == "I-485_SUPP_J":
        return (
            " This is Supplement J, filed as an attachment to Form I-485. "
            "The job_offer_soc_code must exactly match an O*NET SOC code in the "
            "format XX-XXXX.XX (e.g. 15-1252.00). "
            "If the extracted SOC code does not match this format, add exactly "
            "'invalid_soc_code' to narrative_flags — this triggers mandatory review. "
            "The job_offer_title should correspond to the occupation described by "
            "the SOC code."
        )

    if form_type == "I-824":
        return (
            " Identify what action is being requested: notify_consulate, "
            "transfer_file, or other. "
            "Extract the original_receipt_number from the referenced approved "
            "petition — it will be a 13-character code matching [A-Z]{3}[0-9]{10}."
        )

    if form_type == "I-90":
        return (
            " Identify the reason code for card replacement (01 through 14 per "
            "I-90 instructions). "
            "If reason code 6 (name change) is selected, check whether the name "
            "fields on this form differ from any prior name mentioned in the document. "
            "If code 6 is selected but no name difference is apparent, add a "
            "narrative flag noting the potential inconsistency."
        )

    return ""


def _describe_field(name: str, fr: FieldResult) -> str:
    """One-line description of why a field is being sent for LLM review."""
    val_repr = repr(fr.value) if fr.value else "null"
    reasons = []
    if fr.value is None:
        reasons.append("field was not extracted")
    else:
        reasons.append(f"extracted as {val_repr}")
        if fr.confidence <= 0.4:
            reasons.append("very low confidence — possible OCR character confusion")
        elif fr.confidence < CONFIDENCE_THRESHOLD:
            reasons.append("moderate confidence — needs verification")
    return f"  - {name}: {', '.join(reasons)} (current confidence {fr.confidence:.2f})"


def _build_prompt(
    form_type: str,
    low_fields: dict[str, FieldResult],
    preprocess_result: PreprocessResult,
) -> list[dict]:
    """
    Build the messages list for the instructor call.
    Uses vision content when the PDF is scanned and page 1 image is available.
    """
    field_lines = "\n".join(
        _describe_field(name, fr) for name, fr in low_fields.items()
    )

    addendum = _form_addendum(form_type)

    system = (
        f"You are a specialist in USCIS immigration form data extraction. "
        f"You are reviewing a {form_type} form.{addendum} "
        f"Your task is to extract or correct specific fields that automated "
        f"processing could not read reliably. "
        f"Return honest confidence scores — if a field is genuinely unreadable, "
        f"return null with confidence 0.0. Do not hallucinate values. "
        f"Populate narrative_flags with any risk signals you notice: "
        f"criminal history mentions, inconsistent dates, missing required fields, "
        f"mismatched petitioner and beneficiary names across fields, "
        f"or anything else that warrants human review."
    )

    user_text = (
        f"Form type: {form_type}\n\n"
        f"The following fields need extraction or correction:\n"
        f"{field_lines}\n\n"
        f"Please extract these fields from the document text below. "
        f"Return the corrected values and your confidence for each field.\n\n"
    )

    text_source = preprocess_result["ocr_text"] or preprocess_result["raw_text"]
    if text_source:
        user_text += f"--- DOCUMENT TEXT ---\n{text_source}\n--- END ---\n"
    else:
        user_text += "(No text layer available — rely on the page image if provided.)\n"

    # Vision content: include page 1 image when document is scanned
    content: list[dict] = []
    if preprocess_result["is_scanned"] and preprocess_result["page_images"]:
        first_page_b64 = preprocess_result["page_images"][0]
        if first_page_b64:
            _log("  attaching page 1 image for vision (scanned document)")
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": first_page_b64,
                },
            })

    content.append({"type": "text", "text": user_text})

    return [
        {"role": "user", "content": content},
    ], system


# ---------------------------------------------------------------------------
# Schema field introspection
# ---------------------------------------------------------------------------

def _get_form_fields(schema_instance: AnyFormSchema) -> dict[str, FieldResult]:
    """Return {field_name: FieldResult} for all fields on a form schema."""
    return {
        name: getattr(schema_instance, name)
        for name in schema_instance.model_fields
    }


def _get_low_confidence_fields(
    schema_instance: AnyFormSchema,
) -> dict[str, FieldResult]:
    return {
        name: fr
        for name, fr in _get_form_fields(schema_instance).items()
        if fr.confidence < CONFIDENCE_THRESHOLD
    }


# ---------------------------------------------------------------------------
# Merge LLM result back into the typed schema
# ---------------------------------------------------------------------------

def _merge(
    schema_instance: AnyFormSchema,
    llm_result: AnyLLMSchema,
    low_fields: dict[str, FieldResult],
) -> tuple[AnyFormSchema, list[str]]:
    """
    For each field the LLM was asked about:
      - If LLM confidence > current confidence → update value, confidence, source=llm
    Collect escalation flags for fields still below ESCALATION_THRESHOLD
    and for all narrative_flags.
    """
    escalation_flags: list[str] = []
    updates: dict[str, FieldResult] = {}

    for field_name in low_fields:
        llm_value: str | None = getattr(llm_result, field_name, None)
        llm_conf: float = getattr(llm_result, f"{field_name}_confidence", 0.0)
        current: FieldResult = getattr(schema_instance, field_name)

        if llm_conf > current.confidence:
            new_fr = FieldResult(
                value=llm_value,
                confidence=llm_conf,
                source=Source.llm,
            )
            updates[field_name] = new_fr
            _log(
                f"  updated {field_name}: {current.value!r} ({current.confidence:.2f}) "
                f"-> {llm_value!r} ({llm_conf:.2f})"
            )
        else:
            _log(
                f"  kept native {field_name}: LLM ({llm_conf:.2f}) "
                f"did not beat native ({current.confidence:.2f})"
            )

    # Build updated schema — Pydantic models are immutable, use model_copy
    if updates:
        schema_instance = schema_instance.model_copy(update=updates)

    # Escalation: fields still below threshold after merge
    for field_name in low_fields:
        final_fr: FieldResult = getattr(schema_instance, field_name)
        if final_fr.confidence < ESCALATION_THRESHOLD:
            flag = (
                f"low_confidence:{field_name} "
                f"(value={final_fr.value!r}, confidence={final_fr.confidence:.2f})"
            )
            escalation_flags.append(flag)
            _log(f"  escalation flag: {flag}")

    # Narrative flags from LLM — some trigger mandatory human review
    for narrative in getattr(llm_result, "narrative_flags", []):
        escalation_flags.append(f"narrative:{narrative}")
        _log(f"  narrative flag: {narrative}")
        # Check if this flag token appears in the mandatory set
        flag_lower = narrative.lower()
        for mandatory in MANDATORY_REVIEW_FLAGS:
            if mandatory in flag_lower:
                mandatory_flag = f"mandatory_review:{mandatory}"
                if mandatory_flag not in escalation_flags:
                    escalation_flags.append(mandatory_flag)
                    _log(f"  MANDATORY REVIEW triggered by narrative flag: {mandatory}")
                break

    return schema_instance, escalation_flags


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_llm_fallback(
    schema_instance: AnyFormSchema,
    preprocess_result: PreprocessResult,
    form_type: str,
    api_key: str | None = None,
) -> tuple[AnyFormSchema, list[str]]:
    """
    Run LLM fallback for fields with confidence < CONFIDENCE_THRESHOLD.

    Parameters
    ----------
    schema_instance:
        Typed schema instance from field_mapper.map_fields().
    preprocess_result:
        Full PreprocessResult dict from preprocessor.preprocess().
    form_type:
        Any of the 16 supported USCIS form keys.
    api_key:
        Anthropic API key. Falls back to ANTHROPIC_API_KEY env var.

    Returns
    -------
    (updated_schema_instance, escalation_flags)
        updated_schema_instance — same type as input, with LLM improvements applied
        escalation_flags        — list of strings for human review queue
    """
    _log(f"Starting fallback for form_type={form_type}")

    low_fields = _get_low_confidence_fields(schema_instance)
    if not low_fields:
        _log("All fields above confidence threshold — no LLM call needed.")
        return schema_instance, []

    _log(
        f"Fields below threshold ({CONFIDENCE_THRESHOLD}): "
        + ", ".join(
            f"{k}={v.confidence:.2f}" for k, v in low_fields.items()
        )
    )

    llm_schema_cls: type[AnyLLMSchema] = LLM_SCHEMAS[form_type]

    messages, system_prompt = _build_prompt(form_type, low_fields, preprocess_result)

    resolved_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    raw_client = anthropic.Anthropic(api_key=resolved_key)
    client = instructor.from_anthropic(raw_client, mode=instructor.Mode.ANTHROPIC_TOOLS)

    _log(f"Calling {MODEL} with instructor (response_model={llm_schema_cls.__name__})")
    try:
        llm_result: AnyLLMSchema = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=system_prompt,
            messages=messages,
            response_model=llm_schema_cls,
        )
    except Exception as exc:
        _log(f"LLM call failed: {exc}")
        # Surface all low-confidence fields as escalations rather than crashing
        escalation_flags = [
            f"llm_error:{type(exc).__name__} — "
            + ", ".join(
                f"{k}={v.confidence:.2f}" for k, v in low_fields.items()
            )
        ]
        return schema_instance, escalation_flags

    _log("LLM response received — merging results")
    updated, escalation_flags = _merge(schema_instance, llm_result, low_fields)

    _log(
        f"Done. {len(escalation_flags)} escalation flag(s): "
        + (", ".join(escalation_flags) if escalation_flags else "none")
    )
    return updated, escalation_flags


# ---------------------------------------------------------------------------
# Receipt-focused LLM pass
# ---------------------------------------------------------------------------

# Per-field extraction hints, surfaced to the model so it knows this is a
# USCIS *notice* processing system and must extract receipt info, not the
# applicant data on the underlying form.
_RECEIPT_FIELD_HINTS: dict[str, str] = {
    "primary_flag":
        "Always 'True' when a USCIS notice is detected.",
    "sent_government_agency":
        "MM/DD/YYYY date the notice/form was sent to the government agency, if present.",
    "receipt_for":
        "The applicant or petitioner name — who the receipt is for.",
    "receipt_type":
        "One of: USCIS Receipt Number, J Visa Application Number, NVC Matter Number, "
        "PERM Receipt, Other. Infer from the document: an I-797 USCIS notice -> "
        "'USCIS Receipt Number'; J-visa (DS-2019/SEVIS) -> 'J Visa Application Number'; "
        "NVC transfer -> 'NVC Matter Number'; PERM labor cert -> 'PERM Receipt'; "
        "else 'Other'. REQUIRED — always return a value.",
    "receipt_date":
        "MM/DD/YYYY date on the receipt or notice.",
    "receipt_notice_date":
        "MM/DD/YYYY notice date printed on the document (may differ from receipt_date).",
    "receipt_number":
        "Receipt number. USCIS receipts match [A-Z]{3}[0-9]{10}. Also accept NVC case "
        "numbers, PERM numbers, or J-visa numbers depending on receipt_type.",
    "receipt_status":
        "One of: Pending, Approved, Denied, RFE, Withdrawn, Shipped. Map notice language: "
        "approved->Approved; denied/rejection->Denied; request for evidence/RFE->RFE; "
        "withdrawn->Withdrawn; card was mailed/shipped->Shipped; otherwise->Pending.",
    "expiration_alert":
        "'Yes' if the notice has a validity-end date within 90 days of today, else 'No'.",
    "receipt_notes":
        "Any additional remarks, RFE details, or relevant notice text not captured "
        "by the other fields.",
}


def _build_receipt_prompt(
    form_type: str,
    low_fields: dict[str, FieldResult],
    preprocess_result: PreprocessResult,
) -> tuple[list[dict], str]:
    """Build messages + system prompt for the receipt-extraction pass."""
    field_lines = "\n".join(
        f"  - {name}: {_RECEIPT_FIELD_HINTS.get(name, '')} "
        f"(current value {fr.value!r}, confidence {fr.confidence:.2f})"
        for name, fr in low_fields.items()
    )

    system = (
        "You are a specialist in USCIS notice processing. You are looking at a "
        f"{form_type} document. This is a RECEIPT-tracking system: extract receipt "
        "information about the notice itself — receipt number, dates, status, and type "
        "— NOT the applicant's biographic form data. "
        "Return honest confidence scores; if a value is genuinely absent, return null "
        "with confidence 0.0. Do not hallucinate. Dates must be MM/DD/YYYY. "
        "receipt_type and receipt_status must use the exact enum values given."
    )

    user_text = (
        f"Form type: {form_type}\n\n"
        f"Extract or correct the following receipt fields:\n{field_lines}\n\n"
    )
    text_source = preprocess_result["ocr_text"] or preprocess_result["raw_text"]
    if text_source:
        user_text += f"--- DOCUMENT TEXT ---\n{text_source}\n--- END ---\n"
    else:
        user_text += "(No text layer — rely on the page image if provided.)\n"

    content: list[dict] = []
    if preprocess_result["is_scanned"] and preprocess_result["page_images"]:
        first_page_b64 = preprocess_result["page_images"][0]
        if first_page_b64:
            _log("  attaching page 1 image for vision (scanned document)")
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": first_page_b64,
                },
            })
    content.append({"type": "text", "text": user_text})

    return [{"role": "user", "content": content}], system


def run_receipt_llm_fallback(
    schema_instance: AnyFormSchema,
    preprocess_result: PreprocessResult,
    form_type: str,
    api_key: str | None = None,
) -> tuple[AnyFormSchema, list[str]]:
    """
    Run a receipt-focused LLM pass over the 10 shared receipt fields.

    Uses :class:`NoticeReceiptLLMExtract` as the Instructor response model and
    only sends receipt fields whose native confidence is below
    ``CONFIDENCE_THRESHOLD`` — the merge keeps native values that already win.
    Returns ``(updated_schema, escalation_flags)``, same contract as
    :func:`run_llm_fallback`.
    """
    _log(f"Starting receipt fallback for form_type={form_type}")

    low_fields = {
        name: getattr(schema_instance, name)
        for name in RECEIPT_FIELD_NAMES
        if name in schema_instance.model_fields
        and getattr(schema_instance, name).confidence < CONFIDENCE_THRESHOLD
    }
    if not low_fields:
        _log("All receipt fields above threshold — no LLM call needed.")
        return schema_instance, []

    _log(
        "Receipt fields below threshold: "
        + ", ".join(f"{k}={v.confidence:.2f}" for k, v in low_fields.items())
    )

    messages, system_prompt = _build_receipt_prompt(
        form_type, low_fields, preprocess_result
    )

    resolved_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    raw_client = anthropic.Anthropic(api_key=resolved_key)
    client = instructor.from_anthropic(raw_client, mode=instructor.Mode.ANTHROPIC_TOOLS)

    _log(f"Calling {MODEL} (response_model=NoticeReceiptLLMExtract)")
    try:
        llm_result = client.messages.create(
            model=MODEL,
            max_tokens=1536,
            system=system_prompt,
            messages=messages,
            response_model=NoticeReceiptLLMExtract,
        )
    except Exception as exc:
        _log(f"Receipt LLM call failed: {exc}")
        escalation_flags = [
            f"llm_error:{type(exc).__name__} — "
            + ", ".join(f"{k}={v.confidence:.2f}" for k, v in low_fields.items())
        ]
        return schema_instance, escalation_flags

    _log("Receipt LLM response received — merging results")
    updated, escalation_flags = _merge(schema_instance, llm_result, low_fields)
    _log(
        f"Receipt fallback done. {len(escalation_flags)} escalation flag(s): "
        + (", ".join(escalation_flags) if escalation_flags else "none")
    )
    return updated, escalation_flags

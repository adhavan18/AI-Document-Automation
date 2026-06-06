"""
Gemini 2.0 Flash extraction engine for USCIS form field extraction.

Uses Google's Gemini 2.0 Flash model with response_schema for structured
JSON output matching form-specific schemas. Falls back to NuExtract if
GOOGLE_API_KEY is not set.
"""

from __future__ import annotations

import json
import os
from typing import Any

from models.schemas import FieldResult, Source


def is_available() -> bool:
    """True when GOOGLE_API_KEY is set."""
    return bool(os.environ.get("GOOGLE_API_KEY", "").strip())


def extract_all_fields(
    pdf_bytes: bytes,
    ocr_text: str,
    form_type: str,
) -> tuple[dict[str, FieldResult], dict[str, FieldResult]]:
    """
    Extract form-specific and receipt fields using Gemini 2.0 Flash.

    Returns (form_fields, receipt_fields) as dicts with FieldResult values.
    Falls back gracefully if Gemini is unavailable.
    """
    if not is_available():
        return {}, {}

    try:
        import google.generativeai as genai
        import base64
    except ImportError:
        print("[GEMINI] google-generativeai not installed, falling back to NuExtract")
        return {}, {}

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return {}, {}

    genai.configure(api_key=api_key)

    # Define the extraction schema based on form type
    form_schema = _get_form_schema(form_type)
    receipt_schema = _get_receipt_schema()
    combined_schema = {**form_schema, **receipt_schema}

    # Build the extraction prompt
    prompt = _build_extraction_prompt(form_type, combined_schema)

    try:
        # Use Gemini to extract fields from PDF
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            generation_config=genai.types.GenerationConfig(
                temperature=0,
                response_mime_type="application/json",
                response_schema={
                    "type": "object",
                    "properties": {
                        k: {"type": "string", "description": f"Value for {k}"}
                        for k in combined_schema.keys()
                    },
                    "required": list(combined_schema.keys()),
                },
            ),
        )

        # Use base64 encoding for PDF bytes
        print(f"[GEMINI] Extracting fields for {form_type} from PDF ({len(pdf_bytes)} bytes)")

        response = model.generate_content(
            [
                prompt,
                {
                    "mime_type": "application/pdf",
                    "data": base64.standard_b64encode(pdf_bytes).decode("utf-8"),
                },
            ]
        )

        # Parse the JSON response
        raw_json = response.text
        extracted_data = json.loads(raw_json)
        print(f"[GEMINI] Extracted {len(extracted_data)} fields")

        # Convert to FieldResult objects
        form_fields = {}
        receipt_fields = {}

        for field_name, value in extracted_data.items():
            if not value or value == "Not found":
                continue

            field_result = FieldResult(
                value=str(value).strip(),
                confidence=0.92,  # Gemini's extraction confidence
                source=Source.llm,
            )

            if field_name in receipt_schema:
                receipt_fields[field_name] = field_result
            elif field_name in form_schema:
                form_fields[field_name] = field_result

        return form_fields, receipt_fields

    except Exception as e:
        print(f"[GEMINI] Extraction failed: {e}")
        return {}, {}


def _get_form_schema(form_type: str) -> dict[str, str]:
    """Form-specific extraction schema based on USCIS form type."""
    schemas = {
        "I-797": {
            "notice_type": "USCIS form number (e.g., I-797C, I-797A)",
            "case_type": "Processing center or service center name",
        },
        "I-485": {
            "alien_registration_number": "A-Number (A-########)",
            "family_name": "Last name",
            "given_name": "First name",
            "date_of_birth": "DOB in MM/DD/YYYY format",
            "country_of_birth": "Country name",
            "date_of_entry": "Date entered US (MM/DD/YYYY)",
            "class_of_admission": "Class of admission code",
            "ssn": "Social Security Number",
        },
        "N-400": {
            "family_name": "Last name",
            "given_name": "First name",
            "date_of_birth": "DOB in MM/DD/YYYY format",
            "country_of_birth": "Country name",
            "alien_registration_number": "A-Number (A-########)",
            "date_became_pr": "Date became permanent resident (MM/DD/YYYY)",
            "marital_status": "Current marital status",
        },
    }
    return schemas.get(form_type, {})


def _get_receipt_schema() -> dict[str, str]:
    """Shared receipt field extraction schema for all forms."""
    return {
        "primary_flag": "True or False (is this the primary case?)",
        "sent_government_agency": "Date sent to government agency (MM/DD/YYYY)",
        "receipt_for": "What the receipt is for (applicant name or case description)",
        "receipt_type": "Type of receipt (USCIS Receipt Number, J Visa, NVC Matter, PERM Receipt, or Other)",
        "receipt_date": "Receipt date (MM/DD/YYYY)",
        "receipt_notice_date": "Notice date (MM/DD/YYYY)",
        "receipt_number": "Receipt number (e.g., MSC-##-###-#####)",
        "receipt_status": "Receipt status (Pending, Approved, Denied, RFE, Withdrawn, or Shipped)",
        "expiration_alert": "Yes or No (does receipt expire soon?)",
        "receipt_notes": "Any additional notes from the receipt",
    }


def _build_extraction_prompt(form_type: str, schema: dict[str, str]) -> str:
    """Build a structured extraction prompt for Gemini."""
    schema_str = json.dumps(schema, indent=2)

    return f"""Extract all fields from this {form_type} form or notice.

Return ONLY valid JSON. For any field not found, use "Not found". Do not include explanations or notes outside the JSON.

Fields to extract:
{schema_str}

Extract all values exactly as they appear in the document. For dates, always use MM/DD/YYYY format. For boolean fields (primary_flag, expiration_alert), use "True" or "False"."""

"""
Stage 4 — Exception Matcher + LLM Fallback (combined).

Step A  — Run the existing LLM fallback to correct low-confidence fields.
Step B  — Load exceptions/<form_id>.json and evaluate all exceptions against
           the corrected field values using Claude (instructor-structured call).
Step C  — Return a combined stage-4 result containing the improved schema,
           escalation flags, and the triggered exception list.
"""
from __future__ import annotations

import json
import os
import pathlib
from typing import Any, List, Optional

import anthropic
import instructor
from pydantic import BaseModel

from intelligence.llm_fallback import run_llm_fallback
from intelligence.preprocessor import PreprocessResult
from models.schemas import FieldResult, Source

BASE_DIR = pathlib.Path(__file__).parent.parent
EXCEPTIONS_DIR = BASE_DIR / 'exceptions'

MODEL = "claude-sonnet-4-6"


# ---------------------------------------------------------------------------
# Pydantic schema for structured exception evaluation
# ---------------------------------------------------------------------------

class ExceptionEval(BaseModel):
    seq: int
    triggered: bool
    triggered_by: Optional[str] = None   # "field_name: brief reason" or null


class ExceptionEvalResult(BaseModel):
    evaluations: List[ExceptionEval]


# ---------------------------------------------------------------------------
# Exception catalog loader
# ---------------------------------------------------------------------------

_FORM_ID_TO_FILE: dict[str, str] = {
    'I-485':        'i-485',
    'N-400':        'n-400',
    'I-129':        'i-129',
    'I-140':        'i-140',
    'I-797':        'i-797',
    'I-751':        'i-751',
    'I-130':        'i-130',
    'I-131':        'i-131',
    'I-539':        'i-539',
    'I-765':        'i-765',
    'I-290B':       'i-290b',
    'I-129F':       'i-129f',
    'N-600':        'n-600',
    'I-485_SUPP_J': 'i-485-supp-j',
    'I-824':        'i-824',
    'I-90':         'i-90',
}


def _load_exceptions(form_id: str) -> list[dict]:
    fname = _FORM_ID_TO_FILE.get(form_id, form_id.lower().replace('_', '-'))
    path = EXCEPTIONS_DIR / f'{fname}.json'
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding='utf-8'))


# ---------------------------------------------------------------------------
# Build field summary for the LLM prompt
# ---------------------------------------------------------------------------

def _fields_summary(schema_instance: Any) -> str:
    lines = []
    for fname in schema_instance.model_fields:
        fr: FieldResult = getattr(schema_instance, fname)
        val = repr(fr.value) if fr.value else 'null'
        lines.append(
            f'  {fname}: {val}  [conf={fr.confidence:.2f}, src={fr.source}]'
        )
    return '\n'.join(lines)


# ---------------------------------------------------------------------------
# LLM exception evaluation call
# ---------------------------------------------------------------------------

def _evaluate_exceptions(
    form_id: str,
    schema_instance: Any,
    identity: dict,
    exceptions: list[dict],
    api_key: str | None,
) -> list[dict]:
    """
    Ask Claude to evaluate all catalog exceptions against the extracted fields.
    Returns only triggered exceptions as enriched dicts.
    """
    if not exceptions:
        return []

    fields_text = _fields_summary(schema_instance)
    identity_text = (
        f"  client_name: {identity.get('client_name')}\n"
        f"  alien_number: {identity.get('alien_number')}\n"
        f"  receipt_number: {identity.get('receipt_number')}\n"
        f"  date_of_birth: {identity.get('date_of_birth')}\n"
        f"  ssn_last4: {identity.get('ssn_last4')}\n"
        f"  employer_name: {identity.get('employer_name')}"
    )

    exc_text = '\n'.join(
        f"  [{e['seq']}] ({e['category']}) {e['exception_title']}: "
        f"{e['exception_description']}"
        for e in exceptions
    )

    system = (
        "You are a USCIS document compliance checker. "
        "Your task is to evaluate whether each listed exception applies to the "
        "extracted form data. Be accurate and conservative — only flag an exception "
        "when the extracted data clearly triggers it. "
        "For each exception, set triggered=true only if the condition is met, "
        "and provide a concise triggered_by string (e.g. 'ssn: field is null and required')."
    )

    user = (
        f"Form: {form_id}\n\n"
        f"Identity anchors:\n{identity_text}\n\n"
        f"Extracted fields:\n{fields_text}\n\n"
        f"Exception catalog ({len(exceptions)} exceptions):\n{exc_text}\n\n"
        "Evaluate every exception in the catalog. "
        "Return an evaluation entry for each seq number."
    )

    resolved_key = api_key or os.environ.get('ANTHROPIC_API_KEY')
    raw_client = anthropic.Anthropic(api_key=resolved_key)
    client = instructor.from_anthropic(raw_client, mode=instructor.Mode.ANTHROPIC_TOOLS)

    try:
        result: ExceptionEvalResult = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=system,
            messages=[{'role': 'user', 'content': user}],
            response_model=ExceptionEvalResult,
        )
    except Exception as exc:
        print(f'[EXCEPTION_MATCHER] LLM call failed: {exc}')
        return []

    # Build enriched triggered list
    exc_by_seq = {e['seq']: e for e in exceptions}
    triggered = []
    for ev in result.evaluations:
        if ev.triggered:
            catalog_entry = exc_by_seq.get(ev.seq, {})
            triggered.append({
                'seq': ev.seq,
                'category': catalog_entry.get('category', ''),
                'exception_title': catalog_entry.get('exception_title', ''),
                'exception_description': catalog_entry.get('exception_description', ''),
                'triggered_by': ev.triggered_by or '',
            })

    return sorted(triggered, key=lambda x: x['seq'])


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

class Stage4Result:
    __slots__ = ('schema', 'escalation_flags', 'stage_output')

    def __init__(
        self,
        schema: Any,
        escalation_flags: list[str],
        stage_output: dict,
    ) -> None:
        self.schema = schema
        self.escalation_flags = escalation_flags
        self.stage_output = stage_output


def run(
    schema_instance: Any,
    preprocess_result: PreprocessResult,
    form_id: str,
    identity: dict,
    client_name: str | None = None,
    edition_date: str | None = None,
    api_key: str | None = None,
    run_llm_correction: bool = True,
    run_exception_matching: bool = True,
) -> Stage4Result:
    """
    Run Stage 4: LLM field correction (optional) + exception matching (optional).

    Parameters
    ----------
    schema_instance       : Typed schema from native extraction (Stage 3).
    preprocess_result     : PreprocessResult dict.
    form_id               : Canonical form key e.g. "I-485".
    identity              : Stage 1 IdentityResult dict.
    client_name           : Optional override for display name in output.
    edition_date          : Stage 2 edition_date for output.
    api_key               : Anthropic API key (falls back to env var).
    run_llm_correction    : When False, skip LLM field correction and use
                            native schema as-is. Set False when all fields >= 0.7.
    run_exception_matching: When False, skip the exception catalog evaluation
                            entirely (no LLM call for exceptions). Re-enable by
                            setting _EXCEPTION_MATCHING_ENABLED=True in router.py.
    """
    # ---------------------------------------------------------------- Step A: LLM field correction
    if run_llm_correction:
        print(f'[STAGE4] Running LLM field correction for {form_id}')
        corrected_schema, escalation_flags = run_llm_fallback(
            schema_instance, preprocess_result, form_id, api_key=api_key
        )
        print(f'[STAGE4] LLM correction done — {len(escalation_flags)} escalation flags')
    else:
        print(f'[STAGE4] Skipping LLM correction (all fields high-confidence) for {form_id}')
        corrected_schema = schema_instance
        escalation_flags = []

    # ---------------------------------------------------------------- Step B: Exception matching
    if not run_exception_matching:
        print(f'[STAGE4] Exception matching disabled — skipping')
        triggered_exceptions = []
    else:
        exceptions_catalog = _load_exceptions(form_id)
        if exceptions_catalog:
            print(f'[STAGE4] Evaluating {len(exceptions_catalog)} exceptions for {form_id}')
            triggered_exceptions = _evaluate_exceptions(
                form_id, corrected_schema, identity, exceptions_catalog, api_key
            )
        else:
            print(f'[STAGE4] No exception catalog found for {form_id} — skipping')
            triggered_exceptions = []

    print(f'[STAGE4] {len(triggered_exceptions)} exception(s) triggered')

    # ---------------------------------------------------------------- Step C: Build stage output
    display_name = (
        client_name
        or identity.get('client_name')
        or 'Unknown'
    )

    stage_output = {
        'stage': 'exception_matcher',
        'client_name': display_name,
        'form_id': form_id,
        'edition_date': edition_date,
        'total_exceptions_triggered': len(triggered_exceptions),
        'exceptions': triggered_exceptions,
    }

    return Stage4Result(
        schema=corrected_schema,
        escalation_flags=escalation_flags,
        stage_output=stage_output,
    )

"""
Pipeline orchestrator — 4-stage architecture.

Stage 1  identity_resolver  — Extract identity anchors (name, A-number, DOB …)
Stage 2  classifier         — Identify form type + edition date + supplement
Stage 3  native + skills    — Manifest-driven field extraction
Stage 4  exception_matcher  — LLM field correction + catalog exception matching

Every case enters the human review queue.  escalation_flags drives priority:
  - exception triggered OR LLM narrative flag  → high priority
  - no flags, all fields >= 0.7               → normal priority
"""
from __future__ import annotations

import json
import os
import pathlib
from dataclasses import dataclass, field
from typing import Any, Union

from intelligence import native, preprocessor
from intelligence.classifier import classify, ClassifierResult
from intelligence.exception_matcher import run as run_stage4
from intelligence.identity_resolver import resolve as resolve_identity
from intelligence.preprocessor import PreprocessResult
from models.schemas import (
    FieldResult,
    I129, I129F, I130, I131, I140, I290B,
    I485, I485SuppJ, I539, I751, I765, I797,
    I824, I90, N400, N600,
    Source,
)

try:
    from database.connection import SessionLocal
    from database import crud
    _DB_AVAILABLE = True
except Exception:
    _DB_AVAILABLE = False

AnyFormSchema = Union[
    I485, N400, I129, I140, I797,
    I751, I130, I131, I539, I765,
    I290B, I129F, N600, I485SuppJ, I824, I90,
]

BASE_DIR = pathlib.Path(__file__).parent.parent
SKILLS_DIR = BASE_DIR / 'skills'

_LOW_CONFIDENCE_GATE = 0.7   # default fallback


def _gate() -> float:
    """Live confidence gate from operator Settings (falls back to the default)."""
    try:
        from settings_store import get_threshold
        return get_threshold()
    except Exception:
        return _LOW_CONFIDENCE_GATE


def _log(msg: str) -> None:
    print(f'[ROUTER] {msg}')


# ---------------------------------------------------------------------------
# Return types
# ---------------------------------------------------------------------------

@dataclass
class ProcessingStats:
    fields_total: int = 0
    fields_native: int = 0
    fields_llm: int = 0
    fields_below_threshold: int = 0


@dataclass
class PipelineResult:
    form_type: str
    schema: AnyFormSchema
    needs_human_review: bool
    escalation_flags: list[str]
    stage_log: list[str]
    processing_stats: ProcessingStats
    case_id: str | None = None
    detection_confidence: float = 0.0
    priority: str = 'normal'
    # Stage outputs
    stage1: dict = field(default_factory=dict)
    stage2: dict = field(default_factory=dict)
    stage3: dict = field(default_factory=dict)
    stage4: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Skills manifest loader
# ---------------------------------------------------------------------------

_FORM_ID_TO_SKILL: dict[str, str] = {
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


def _load_skills(form_id: str) -> list[dict]:
    fname = _FORM_ID_TO_SKILL.get(form_id, form_id.lower().replace('_', '-'))
    path = SKILLS_DIR / f'{fname}.json'
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding='utf-8'))
    return data.get('fields', [])


# ---------------------------------------------------------------------------
# Stage 3 helper: build skills_extractor stage output from native schema
# ---------------------------------------------------------------------------

def _build_stage3_output(
    form_id: str,
    schema_instance: AnyFormSchema,
    skills: list[dict],
) -> dict:
    """
    Map the native-extracted schema fields through the skills manifest.
    Only declared fields are included; required fields with null values
    get issue='missing'.
    """
    declared = {f['name']: f for f in skills}
    fields_out: dict[str, dict] = {}

    for skill_field in skills:
        fname = skill_field['name']
        fr: FieldResult | None = getattr(schema_instance, fname, None)
        if fr is None:
            continue
        issue = None
        if fr.value is None:
            issue = 'missing' if skill_field.get('required') else None
        fields_out[fname] = {'value': fr.value, 'issue': issue}

    return {
        'stage': 'skills_extractor',
        'form_id': form_id,
        'fields': fields_out,
    }


# ---------------------------------------------------------------------------
# Schema helpers
# ---------------------------------------------------------------------------

def _all_fields(schema: AnyFormSchema) -> dict[str, FieldResult]:
    return {name: getattr(schema, name) for name in type(schema).model_fields}


def _fields_below(schema: AnyFormSchema, threshold: float) -> list[str]:
    return [
        name for name, fr in _all_fields(schema).items()
        if fr.confidence < threshold
    ]


def _compute_stats(schema: AnyFormSchema) -> ProcessingStats:
    all_f = _all_fields(schema)
    return ProcessingStats(
        fields_total=len(all_f),
        fields_native=sum(1 for fr in all_f.values() if fr.source == Source.native),
        fields_llm=sum(1 for fr in all_f.values() if fr.source == Source.llm),
        fields_below_threshold=sum(
            1 for fr in all_f.values() if fr.confidence < _gate()
        ),
    )




def _mark_case_for_review(
    *,
    case_id: str | None,
    form_type: str,
    pdf_path: str,
    escalation_flags: list[str],
    stage_log: list[str],
    priority: str,
    edition_date: str | None,
) -> str | None:
    """Update a pre-created upload row when classification cannot proceed."""
    if not _DB_AVAILABLE or not case_id:
        return None
    import uuid as _uuid
    try:
        db = SessionLocal()
        try:
            cid = _uuid.UUID(case_id)
            case = crud.get_case(db, cid)
            if case is None:
                return None
            case.form_type = form_type
            case.status = "pending"
            case.pdf_path = pdf_path
            case.edition_date = edition_date
            crud.log_audit_event(
                db,
                event_type="case_created",
                actor="pipeline",
                case_id=case.id,
                payload={
                    "form_type": form_type,
                    "priority": priority,
                    "escalation_flags": escalation_flags,
                    "stage_log": stage_log,
                },
            )
            db.commit()
            return str(case.id)
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
    except Exception as exc:
        _log(f"DB warning: review mark failed — {exc}")
        return None


# ---------------------------------------------------------------------------
# DB helper
# ---------------------------------------------------------------------------

def _persist(
    form_type: str,
    pdf_path: str,
    pre: PreprocessResult,
    final_schema: AnyFormSchema,
    escalation_flags: list[str],
    stage_log: list[str],
    stage4_output: dict,
    edition_date: str | None,
    priority: str,
    preset_case_id: str | None = None,
) -> str | None:
    if not _DB_AVAILABLE:
        return None
    fields_payload = [
        {
            'field_name': name,
            'raw_value': fr.value,
            'normalized_value': fr.value,
            'confidence': fr.confidence,
            'source': fr.source.value if isinstance(fr.source, Source) else str(fr.source),
        }
        for name, fr in _all_fields(final_schema).items()
    ]
    import uuid as _uuid
    try:
        db = SessionLocal()
        try:
            _cid = _uuid.UUID(preset_case_id) if preset_case_id else None

            if _cid is not None:
                # Async path: case row was pre-created in upload handler.
                # UPDATE the existing row instead of inserting a duplicate.
                case = crud.get_case(db, _cid)
                if case is None:
                    raise RuntimeError(f"preset case {_cid} not found in DB")
                case.form_type   = form_type
                case.status      = "pending"
                case.page_count  = len(pre.get('page_images', []))
                case.form_version = pre.get('form_version')
                case.edition_date = edition_date
            else:
                # Synchronous path (no preset): create a fresh case.
                case = crud.create_case(
                    db,
                    form_type=form_type,
                    pdf_path=pdf_path,
                    page_count=len(pre.get('page_images', [])),
                    form_version=pre.get('form_version'),
                    edition_date=edition_date,
                )

            crud.save_extracted_fields(db, case.id, fields_payload)
            crud.log_audit_event(
                db,
                event_type='case_created',
                actor='pipeline',
                case_id=case.id,
                payload={
                    'form_type': form_type,
                    'priority': priority,
                    'escalation_flags': escalation_flags,
                    'stage_log': stage_log,
                },
            )
            if stage4_output.get('exceptions') is not None:
                crud.log_audit_event(
                    db,
                    event_type='exceptions_matched',
                    actor='pipeline',
                    case_id=case.id,
                    payload=stage4_output,
                )
            db.commit()
            return str(case.id)
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
    except Exception as exc:
        _log(f'DB warning: persist failed — {exc}')
        return None


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run(
    pdf_path: str,
    api_key: str | None = None,
    form_type_override: str | None = None,
    preset_case_id: str | None = None,
) -> PipelineResult:
    """
    Run the 4-stage extraction pipeline on a USCIS PDF.
    """
    stage_log: list[str] = []
    escalation_flags: list[str] = []

    def _stage(msg: str) -> None:
        _log(msg)
        stage_log.append(msg)

    # ====================================================================
    # Stage 1 — Identity Resolver
    # ====================================================================
    _stage('Stage 1: running identity resolver')
    pre: PreprocessResult = preprocessor.preprocess(pdf_path)
    identity = resolve_identity(pre)
    _stage(
        f'Stage 1 done: client_name={identity["client_name"]!r} '
        f'alien_number={identity["alien_number"]!r} '
        f'receipt_number={identity["receipt_number"]!r}'
    )

    # ====================================================================
    # Stage 2 — Document Classifier
    # ====================================================================
    _stage('Stage 2: running document classifier')
    cls_result: ClassifierResult = classify(
        pre, form_type_override=form_type_override
    )
    form_id = cls_result['form_id']
    edition_date = cls_result['edition_date']
    detection_confidence = cls_result['_detection_confidence']

    _stage(
        f'Stage 2 done: form_id={form_id!r} '
        f'confidence={cls_result["confidence"]!r} '
        f'edition_date={edition_date!r} '
        f'supplement={cls_result["supplement"]!r}'
    )

    if cls_result['confidence'] == 'low':
        _stage('Stage 2: low confidence — halting pipeline, routing to human review')
        escalation_flags.append('low_classifier_confidence')
        case_id = _mark_case_for_review(
            case_id=preset_case_id,
            form_type=form_id,
            pdf_path=pdf_path,
            escalation_flags=escalation_flags,
            stage_log=stage_log,
            priority="high",
            edition_date=edition_date,
        )
        # Return minimal result — no extraction possible
        stage2_public = {k: v for k, v in cls_result.items() if not k.startswith('_')}
        return PipelineResult(
            form_type=form_id,
            schema=None,  # type: ignore[arg-type]
            needs_human_review=True,
            escalation_flags=escalation_flags,
            stage_log=stage_log,
            processing_stats=ProcessingStats(),
            case_id=case_id,
            detection_confidence=detection_confidence,
            priority='high',
            stage1=dict(identity),
            stage2=stage2_public,
            stage3={},
            stage4={},
        )

    # ====================================================================
    # Stage 3 — Skills Extractor (manifest-driven native extraction)
    # ====================================================================
    _stage(f'Stage 3: loading skills manifest for {form_id!r}')
    skills = _load_skills(form_id)
    _stage(f'Stage 3: manifest has {len(skills)} declared fields')

    _stage('Stage 3: extracting form fields (AcroForm + Textract)')
    textract_fields = {}
    try:
        from intelligence.textract_ocr import is_available as textract_ok, extract_form_fields
        if textract_ok():
            _stage('Stage 3: Textract available — extracting structured fields')
            _, textract_fields = extract_form_fields(pdf_path)
            _stage(f'Stage 3: Textract extracted {len(textract_fields)} form fields')
    except Exception as _te:
        _stage(f'Stage 3: Textract extraction failed (non-blocking) — {_te}')

    _stage('Stage 3: running native extraction (AcroForm + Textract merge)')
    native_schema: AnyFormSchema = native.extract(pre, form_id, textract_fields)
    _threshold = _gate()
    low_fields_pre = _fields_below(native_schema, _threshold)
    _stage(
        f'Stage 3 done: {len(_all_fields(native_schema))} fields extracted, '
        f'{len(low_fields_pre)} below {_threshold} threshold'
    )

    stage3_output = _build_stage3_output(form_id, native_schema, skills)

    # ====================================================================
    # Stage 4 — Claude LLM field correction
    #
    # For any field below the confidence threshold, run_llm_fallback sends
    # only those fields to Claude (via instructor) and merges improvements back.
    # ====================================================================
    from intelligence.llm_fallback import run_llm_fallback, run_receipt_llm_fallback

    if low_fields_pre:
        _stage(
            f'Stage 4: running Claude LLM correction for '
            f'{len(low_fields_pre)} low-confidence field(s)'
        )
        native_schema, llm_flags = run_llm_fallback(
            native_schema, pre, form_id, api_key
        )
        escalation_flags.extend(llm_flags)
        native_schema, receipt_flags = run_receipt_llm_fallback(
            native_schema, pre, form_id, api_key
        )
        escalation_flags.extend(receipt_flags)
        improved = sum(
            1 for fr in _all_fields(native_schema).values()
            if fr.source == Source.llm and fr.value
        )
        _stage(
            f'Stage 4 done: Claude improved {improved} field(s), '
            f'{len(escalation_flags)} escalation flag(s)'
        )
    else:
        _stage('Stage 4: all fields above threshold — Claude correction skipped')

    stats = _compute_stats(native_schema)
    low_fields_final = _fields_below(native_schema, _gate())
    priority = 'high' if (escalation_flags or len(low_fields_final) > 0) else 'normal'

    # ====================================================================
    # Persist to database
    # ====================================================================
    _stage('Persisting to database')
    case_id = _persist(
        form_type=form_id,
        pdf_path=pdf_path,
        pre=pre,
        final_schema=native_schema,
        escalation_flags=escalation_flags,
        stage_log=stage_log,
        stage4_output={},
        edition_date=edition_date,
        priority=priority,
        preset_case_id=preset_case_id,
    )
    if case_id:
        _stage(f'Persisted: case_id={case_id}')
    else:
        _stage('Database unavailable — skipped persist')

    # ====================================================================
    # Routing / priority
    # ====================================================================
    _stage(
        f'Routing: priority={priority!r} '
        f'escalation_flags={escalation_flags} '
        f'low_confidence_fields={len(low_fields_final)}'
    )

    stage2_public = {k: v for k, v in cls_result.items() if not k.startswith('_')}

    return PipelineResult(
        form_type=form_id,
        schema=native_schema,
        needs_human_review=True,
        escalation_flags=escalation_flags,
        stage_log=stage_log,
        processing_stats=stats,
        case_id=case_id,
        detection_confidence=detection_confidence,
        priority=priority,
        stage1=dict(identity),
        stage2=stage2_public,
        stage3=stage3_output,
        stage4={},
    )

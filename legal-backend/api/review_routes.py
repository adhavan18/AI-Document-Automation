"""
Caseworker review queue routes. No authentication required.

Routes
------
GET  /queue                      — paginated list of pending/in_review cases
GET  /queue/{case_id}            — full case detail with fields + audit log
POST /queue/{case_id}/assign     — claim a case, sets status=in_review
POST /queue/{case_id}/confirm    — save confirmed fields, sets status=approved
POST /queue/{case_id}/reject     — sets status=rejected with reason
GET  /queue/{case_id}/pdf        — stream the uploaded PDF to the browser
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from database.connection import get_db
from database.crud import (
    get_case,
    get_extracted_fields,
    log_audit_event,
    save_confirmed_fields,
    update_case_status,
)
from database.models import AuditLog, Case, ExtractedField

router = APIRouter(prefix="/queue", tags=["review"])

_LOW_CONF = 0.7
# Include 'processing' so a freshly-uploaded case shows in the queue immediately
# (with a spinner) instead of disappearing until the pipeline finishes.
_QUEUE_STATUSES = ("processing", "pending", "in_review")
_SYSTEM_ACTOR = "caseworker"

def _system_cw_id(db: Session) -> uuid.UUID:
    """Return a valid caseworker UUID to use as the audit actor when there is no login."""
    from database.crud import get_caseworker_by_email
    cw = get_caseworker_by_email(db, "admin@poc.com")
    if cw:
        return cw.id
    # Fall back: use the first caseworker in the table
    from database.models import Caseworker
    from sqlalchemy import select
    row = db.execute(select(Caseworker).limit(1)).scalar_one_or_none()
    if row:
        return row.id
    raise HTTPException(status_code=500, detail="No caseworker configured in the system")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class QueueItem(BaseModel):
    case_id: str
    form_type: str
    uploaded_at: str
    status: str
    priority: str
    caseworker_id: str | None
    field_count: int
    low_confidence_count: int


class QueueResponse(BaseModel):
    cases: list[QueueItem]
    total: int


class ExtractedFieldOut(BaseModel):
    field_name: str
    raw_value: str | None
    normalized_value: str | None
    confidence: float
    source: str
    page_number: int | None
    is_default: bool = False


class AuditEventOut(BaseModel):
    event_type: str
    actor: str
    payload: dict[str, Any]
    timestamp: str


class ExceptionOut(BaseModel):
    seq: int
    category: str
    exception_title: str
    exception_description: str
    triggered_by: str


class CaseDetailResponse(BaseModel):
    case_id: str
    form_type: str
    status: str
    uploaded_at: str
    reviewed_at: str | None
    caseworker_id: str | None
    form_version: str | None
    edition_date: str | None
    page_count: int
    priority: str
    escalation_flags: list[str]
    pdf_path: str
    extracted_fields: list[ExtractedFieldOut]
    audit_log: list[AuditEventOut]
    exceptions: list[ExceptionOut]
    total_exceptions_triggered: int


class ConfirmFieldIn(BaseModel):
    field_name: str
    confirmed_value: str | None


class ConfirmBody(BaseModel):
    fields: list[ConfirmFieldIn]


class RejectBody(BaseModel):
    reason: str


class AssignResponse(BaseModel):
    case_id: str
    status: str


class ConfirmResponse(BaseModel):
    case_id: str
    status: str
    fields_confirmed: int
    fields_corrected: int


class RejectResponse(BaseModel):
    case_id: str
    status: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_case(db: Session, case_id_str: str) -> Case:
    try:
        cid = uuid.UUID(case_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid case_id format")
    case = get_case(db, cid)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


def _extract_pipeline_meta(db: Session, case_id: uuid.UUID) -> dict[str, Any]:
    row = db.execute(
        select(AuditLog)
        .where(
            AuditLog.case_id == case_id,
            AuditLog.event_type == "case_created",
        )
        .limit(1)
    ).scalar_one_or_none()

    if row is None or not isinstance(row.payload, dict):
        return {"priority": "normal", "escalation_flags": []}

    return {
        "priority": row.payload.get("priority", "normal"),
        "escalation_flags": row.payload.get("escalation_flags", []),
    }


def _extract_exceptions(db: Session, case_id: uuid.UUID) -> list[dict]:
    """Pull triggered exceptions from the exceptions_matched audit event."""
    row = db.execute(
        select(AuditLog)
        .where(
            AuditLog.case_id == case_id,
            AuditLog.event_type == "exceptions_matched",
        )
        .limit(1)
    ).scalar_one_or_none()
    if row is None or not isinstance(row.payload, dict):
        return []
    return row.payload.get("exceptions", [])


def _field_counts(db: Session, case_id: uuid.UUID) -> tuple[int, int]:
    rows: list[ExtractedField] = db.execute(
        select(ExtractedField).where(ExtractedField.case_id == case_id)
    ).scalars().all()
    total = len(rows)
    threshold = _current_threshold()
    low = sum(1 for r in rows if r.confidence < threshold)
    return total, low


def _current_threshold() -> float:
    """Live confidence threshold from the operator Settings (falls back to _LOW_CONF)."""
    try:
        from settings_store import get_threshold
        return get_threshold()
    except Exception:
        return _LOW_CONF


def _dt(dt: Any) -> str | None:
    return dt.isoformat() if dt is not None else None


# ---------------------------------------------------------------------------
# GET /queue
# ---------------------------------------------------------------------------

@router.get("", response_model=QueueResponse)
def list_queue(
    db: Annotated[Session, Depends(get_db)],
    limit: int = 50,
    offset: int = 0,
    status: str = "active",
) -> QueueResponse:
    # `status=active` (default) returns only cases needing review
    # (processing/pending/in_review) — used by the live review queue.
    # `status=all` returns every case including approved/rejected — used by the
    # dashboard so its Completed KPI reflects finished work.
    query = select(Case).order_by(Case.uploaded_at.desc())
    if status != "all":
        query = query.where(Case.status.in_(_QUEUE_STATUSES))
    cases: list[Case] = db.execute(query).scalars().all()

    items: list[QueueItem] = []
    for case in cases:
        meta = _extract_pipeline_meta(db, case.id)
        field_count, low_count = _field_counts(db, case.id)
        items.append(
            QueueItem(
                case_id=str(case.id),
                form_type=case.form_type,
                uploaded_at=_dt(case.uploaded_at),
                status=case.status,
                priority=meta["priority"],
                caseworker_id=str(case.caseworker_id) if case.caseworker_id else None,
                field_count=field_count,
                low_confidence_count=low_count,
            )
        )

    # High priority first; within each band, newest upload first.
    # uploaded_at is an ISO string so it sorts lexicographically by time —
    # negating isn't possible on strings, so sort by time desc then stable-sort by priority.
    items.sort(key=lambda i: i.uploaded_at, reverse=True)
    items.sort(key=lambda i: 0 if i.priority == "high" else 1)
    total = len(items)
    return QueueResponse(cases=items[offset: offset + limit], total=total)


# ---------------------------------------------------------------------------
# GET /queue/{case_id}
# ---------------------------------------------------------------------------

@router.get("/{case_id}", response_model=CaseDetailResponse)
def get_case_detail(
    case_id: str,
    db: Annotated[Session, Depends(get_db)],
) -> CaseDetailResponse:
    case = _require_case(db, case_id)
    meta = _extract_pipeline_meta(db, case.id)

    # Receipt field defaults — always return all 10 fields, filling missing with defaults
    RECEIPT_FIELD_DEFAULTS = {
        'primary_flag': ('True', 0.0),
        'sent_government_agency': ('', 0.0),
        'receipt_for': ('', 0.0),
        'receipt_type': ('', 0.0),
        'receipt_date': ('', 0.0),
        'receipt_notice_date': ('', 0.0),
        'receipt_number': ('', 0.0),
        'receipt_status': ('', 0.0),
        'expiration_alert': ('No', 0.0),
        'receipt_notes': ('', 0.0),
    }

    extracted = {
        f.field_name: ExtractedFieldOut(
            field_name=f.field_name,
            raw_value=f.raw_value,
            normalized_value=f.normalized_value,
            confidence=round(f.confidence, 4),
            source=f.source,
            page_number=f.page_number,
            is_default=False,
        )
        for f in get_extracted_fields(db, case.id)
    }

    fields_out = []
    for field_name, (default_val, default_conf) in RECEIPT_FIELD_DEFAULTS.items():
        if field_name in extracted:
            fields_out.append(extracted[field_name])
        else:
            fields_out.append(
                ExtractedFieldOut(
                    field_name=field_name,
                    raw_value=default_val,
                    normalized_value=default_val,
                    confidence=default_conf,
                    source='native',
                    page_number=None,
                    is_default=True,
                )
            )

    audit_out = [
        AuditEventOut(
            event_type=a.event_type,
            actor=a.actor,
            payload=a.payload if isinstance(a.payload, dict) else {},
            timestamp=_dt(a.timestamp),
        )
        for a in db.execute(
            select(AuditLog)
            .where(AuditLog.case_id == case.id)
            .order_by(AuditLog.timestamp.asc())
        ).scalars().all()
    ]

    raw_exceptions = _extract_exceptions(db, case.id)
    exceptions_out = [
        ExceptionOut(
            seq=e.get("seq", 0),
            category=e.get("category", ""),
            exception_title=e.get("exception_title", ""),
            exception_description=e.get("exception_description", ""),
            triggered_by=e.get("triggered_by", ""),
        )
        for e in raw_exceptions
    ]

    return CaseDetailResponse(
        case_id=str(case.id),
        form_type=case.form_type,
        status=case.status,
        uploaded_at=_dt(case.uploaded_at),
        reviewed_at=_dt(case.reviewed_at),
        caseworker_id=str(case.caseworker_id) if case.caseworker_id else None,
        form_version=case.form_version,
        edition_date=case.edition_date,
        page_count=case.page_count,
        priority=meta["priority"],
        escalation_flags=meta["escalation_flags"],
        pdf_path=case.pdf_path,
        extracted_fields=fields_out,
        audit_log=audit_out,
        exceptions=exceptions_out,
        total_exceptions_triggered=len(exceptions_out),
    )


# ---------------------------------------------------------------------------
# POST /queue/{case_id}/assign
# ---------------------------------------------------------------------------

@router.post("/{case_id}/assign", response_model=AssignResponse)
def assign_case(
    case_id: str,
    db: Annotated[Session, Depends(get_db)],
) -> AssignResponse:
    case = _require_case(db, case_id)

    if case.status not in ("pending", "in_review"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Case is already {case.status!r} and cannot be assigned",
        )

    update_case_status(db, case.id, "in_review")
    log_audit_event(
        db,
        event_type="case_assigned",
        actor=_SYSTEM_ACTOR,
        case_id=case.id,
        payload={},
    )
    db.commit()
    return AssignResponse(case_id=str(case.id), status="in_review")


# ---------------------------------------------------------------------------
# POST /queue/{case_id}/confirm
# ---------------------------------------------------------------------------

@router.post("/{case_id}/confirm", response_model=ConfirmResponse)
def confirm_case(
    case_id: str,
    body: ConfirmBody,
    db: Annotated[Session, Depends(get_db)],
) -> ConfirmResponse:
    case = _require_case(db, case_id)

    if case.status not in ("pending", "in_review"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Case is {case.status!r} and cannot be confirmed",
        )

    extracted_map: dict[str, str | None] = {
        f.field_name: f.normalized_value
        for f in get_extracted_fields(db, case.id)
    }

    fields_payload: list[dict] = []
    corrected_count = 0
    for field in body.fields:
        original = extracted_map.get(field.field_name)
        was_corrected = field.confirmed_value != original
        if was_corrected:
            corrected_count += 1
        fields_payload.append({
            "field_name": field.field_name,
            "confirmed_value": field.confirmed_value,
            "original_extracted_value": original,
            "was_corrected": was_corrected,
        })

    save_confirmed_fields(db, case.id, _system_cw_id(db), fields_payload)
    update_case_status(db, case.id, "approved")
    log_audit_event(
        db,
        event_type="case_confirmed",
        actor=_SYSTEM_ACTOR,
        case_id=case.id,
        payload={"fields_confirmed": len(fields_payload), "fields_corrected": corrected_count},
    )
    db.commit()

    return ConfirmResponse(
        case_id=str(case.id),
        status="approved",
        fields_confirmed=len(fields_payload),
        fields_corrected=corrected_count,
    )


# ---------------------------------------------------------------------------
# POST /queue/{case_id}/reject
# ---------------------------------------------------------------------------

@router.post("/{case_id}/reject", response_model=RejectResponse)
def reject_case(
    case_id: str,
    body: RejectBody,
    db: Annotated[Session, Depends(get_db)],
) -> RejectResponse:
    case = _require_case(db, case_id)

    if case.status not in ("pending", "in_review"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Case is already {case.status!r} and cannot be rejected",
        )

    update_case_status(db, case.id, "rejected")
    log_audit_event(
        db,
        event_type="case_rejected",
        actor=_SYSTEM_ACTOR,
        case_id=case.id,
        payload={"reason": body.reason},
    )
    db.commit()
    return RejectResponse(case_id=str(case.id), status="rejected")


# ---------------------------------------------------------------------------
# GET /queue/{case_id}/pdf
# ---------------------------------------------------------------------------

@router.get("/{case_id}/pdf")
def stream_pdf(
    case_id: str,
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse | FileResponse:
    case = _require_case(db, case_id)

    # Try S3 first (post-processing files)
    if case.s3_key:
        try:
            import s3_store
            body = s3_store.stream_object(case.s3_key)
            filename = case.s3_key.split("/")[-1]
            return StreamingResponse(
                body.iter_chunks(65536),
                media_type="application/pdf",
                headers={"Content-Disposition": f'inline; filename="{filename}"'},
            )
        except Exception as s3_err:
            print(f"[S3] stream_pdf fallback for {case_id[:8]}: {s3_err}", flush=True)

    # Fall back to local disk (file still being processed or S3 unavailable)
    path = Path(case.pdf_path)
    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail="PDF not available (not yet processed or S3 unreachable)",
        )
    return FileResponse(
        path=str(path),
        media_type="application/pdf",
        filename=path.name,
        headers={"Content-Disposition": f'inline; filename="{path.name}"'},
    )

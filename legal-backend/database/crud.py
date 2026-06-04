"""
CRUD helpers for the legal-processing database.

All functions accept an explicit Session so callers control transaction scope.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from database.models import AuditLog, Case, Caseworker, ConfirmedField, ExtractedField


# ---------------------------------------------------------------------------
# Cases
# ---------------------------------------------------------------------------

def create_case(
    db: Session,
    *,
    form_type: str,
    pdf_path: str,
    page_count: int = 0,
    form_version: str | None = None,
    edition_date: str | None = None,
    case_id: uuid.UUID | None = None,
    status: str = "pending",
) -> Case:
    case = Case(
        id=case_id or uuid.uuid4(),
        form_type=form_type,
        status=status,
        pdf_path=pdf_path,
        page_count=page_count,
        form_version=form_version,
        edition_date=edition_date,
    )
    db.add(case)
    db.flush()
    return case


def get_case(db: Session, case_id: uuid.UUID) -> Case | None:
    return db.get(Case, case_id)


def update_case_status(
    db: Session,
    case_id: uuid.UUID,
    status: str,
    *,
    caseworker_id: uuid.UUID | None = None,
) -> Case | None:
    case = db.get(Case, case_id)
    if case is None:
        return None
    case.status = status
    if status in ("approved", "rejected", "in_review"):
        case.reviewed_at = datetime.now(timezone.utc)
    if caseworker_id is not None:
        case.caseworker_id = caseworker_id
    db.flush()
    return case


# ---------------------------------------------------------------------------
# Extracted fields
# ---------------------------------------------------------------------------

def save_extracted_fields(
    db: Session,
    case_id: uuid.UUID,
    fields: list[dict[str, Any]],
) -> list[ExtractedField]:
    """
    Upsert extracted fields for a case. Existing rows are deleted first so
    re-processing a case doesn't leave stale data.

    Each dict in `fields` should contain:
        field_name, raw_value, normalized_value, confidence, source
    Optional: page_number, bounding_box
    """
    db.query(ExtractedField).filter(ExtractedField.case_id == case_id).delete()
    rows = [
        ExtractedField(
            id=uuid.uuid4(),
            case_id=case_id,
            field_name=f["field_name"],
            raw_value=f.get("raw_value"),
            normalized_value=f.get("normalized_value"),
            confidence=f["confidence"],
            source=f["source"],
            page_number=f.get("page_number"),
            bounding_box=f.get("bounding_box"),
        )
        for f in fields
    ]
    db.add_all(rows)
    db.flush()
    return rows


def get_extracted_fields(
    db: Session, case_id: uuid.UUID
) -> list[ExtractedField]:
    return (
        db.execute(
            select(ExtractedField)
            .where(ExtractedField.case_id == case_id)
            .order_by(ExtractedField.field_name)
        )
        .scalars()
        .all()
    )


# ---------------------------------------------------------------------------
# Confirmed fields
# ---------------------------------------------------------------------------

def save_confirmed_fields(
    db: Session,
    case_id: uuid.UUID,
    caseworker_id: uuid.UUID,
    fields: list[dict[str, Any]],
) -> list[ConfirmedField]:
    """
    Replace all confirmed fields for a case with the supplied list.

    Each dict should contain:
        field_name, confirmed_value, original_extracted_value, was_corrected
    """
    db.query(ConfirmedField).filter(ConfirmedField.case_id == case_id).delete()
    rows = [
        ConfirmedField(
            id=uuid.uuid4(),
            case_id=case_id,
            caseworker_id=caseworker_id,
            field_name=f["field_name"],
            confirmed_value=f.get("confirmed_value"),
            original_extracted_value=f.get("original_extracted_value"),
            was_corrected=f.get("was_corrected", False),
            confirmed_at=datetime.now(timezone.utc),
        )
        for f in fields
    ]
    db.add_all(rows)
    db.flush()
    return rows


def get_confirmed_fields(
    db: Session, case_id: uuid.UUID
) -> list[ConfirmedField]:
    return (
        db.execute(
            select(ConfirmedField)
            .where(ConfirmedField.case_id == case_id)
            .order_by(ConfirmedField.field_name)
        )
        .scalars()
        .all()
    )


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

def log_audit_event(
    db: Session,
    *,
    event_type: str,
    actor: str,
    payload: dict[str, Any] | None = None,
    case_id: uuid.UUID | None = None,
) -> AuditLog:
    entry = AuditLog(
        id=uuid.uuid4(),
        case_id=case_id,
        event_type=event_type,
        actor=actor,
        payload=payload or {},
        timestamp=datetime.now(timezone.utc),
    )
    db.add(entry)
    db.flush()
    return entry


# ---------------------------------------------------------------------------
# Review queue
# ---------------------------------------------------------------------------

def get_review_queue(
    db: Session,
    *,
    status: str = "pending",
    limit: int = 50,
    offset: int = 0,
) -> list[Case]:
    """Return cases matching `status`, oldest first."""
    return (
        db.execute(
            select(Case)
            .where(Case.status == status)
            .order_by(Case.uploaded_at.asc())
            .limit(limit)
            .offset(offset)
        )
        .scalars()
        .all()
    )


# ---------------------------------------------------------------------------
# Caseworkers
# ---------------------------------------------------------------------------

def get_caseworker_by_email(db: Session, email: str) -> Caseworker | None:
    return db.execute(
        select(Caseworker).where(Caseworker.email == email)
    ).scalar_one_or_none()

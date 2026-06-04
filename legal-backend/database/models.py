from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Caseworker(Base):
    __tablename__ = "caseworkers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # admin | reviewer
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    cases: Mapped[list[Case]] = relationship("Case", back_populates="caseworker")
    confirmed_fields: Mapped[list[ConfirmedField]] = relationship(
        "ConfirmedField", back_populates="caseworker"
    )


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    form_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # pending | in_review | approved | rejected
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    caseworker_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("caseworkers.id"), nullable=True
    )
    pdf_path: Mapped[str] = mapped_column(Text, nullable=False)
    form_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    edition_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    page_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    caseworker: Mapped[Caseworker | None] = relationship(
        "Caseworker", back_populates="cases"
    )
    extracted_fields: Mapped[list[ExtractedField]] = relationship(
        "ExtractedField", back_populates="case", cascade="all, delete-orphan"
    )
    confirmed_fields: Mapped[list[ConfirmedField]] = relationship(
        "ConfirmedField", back_populates="case", cascade="all, delete-orphan"
    )
    audit_log: Mapped[list[AuditLog]] = relationship(
        "AuditLog", back_populates="case"
    )


class ExtractedField(Base):
    __tablename__ = "extracted_fields"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False
    )
    field_name: Mapped[str] = mapped_column(String(255), nullable=False)
    raw_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    normalized_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    # native | llm | human
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bounding_box: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    case: Mapped[Case] = relationship("Case", back_populates="extracted_fields")


class ConfirmedField(Base):
    __tablename__ = "confirmed_fields"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False
    )
    field_name: Mapped[str] = mapped_column(String(255), nullable=False)
    confirmed_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_extracted_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    was_corrected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    caseworker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("caseworkers.id"), nullable=False
    )
    confirmed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    case: Mapped[Case] = relationship("Case", back_populates="confirmed_fields")
    caseworker: Mapped[Caseworker] = relationship(
        "Caseworker", back_populates="confirmed_fields"
    )


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    case_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    actor: Mapped[str] = mapped_column(String(255), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    case: Mapped[Case | None] = relationship("Case", back_populates="audit_log")

"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-06-02
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, UUID

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "caseworkers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("email", name="uq_caseworkers_email"),
    )

    op.create_table(
        "cases",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("form_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "caseworker_id",
            UUID(as_uuid=True),
            sa.ForeignKey("caseworkers.id"),
            nullable=True,
        ),
        sa.Column("pdf_path", sa.Text, nullable=False),
        sa.Column("form_version", sa.String(50), nullable=True),
        sa.Column("edition_date", sa.String(50), nullable=True),
        sa.Column("page_count", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_cases_status", "cases", ["status"])
    op.create_index("ix_cases_caseworker_id", "cases", ["caseworker_id"])

    op.create_table(
        "extracted_fields",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "case_id",
            UUID(as_uuid=True),
            sa.ForeignKey("cases.id"),
            nullable=False,
        ),
        sa.Column("field_name", sa.String(255), nullable=False),
        sa.Column("raw_value", sa.Text, nullable=True),
        sa.Column("normalized_value", sa.Text, nullable=True),
        sa.Column("confidence", sa.Float, nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("page_number", sa.Integer, nullable=True),
        sa.Column("bounding_box", JSON, nullable=True),
    )
    op.create_index("ix_extracted_fields_case_id", "extracted_fields", ["case_id"])

    op.create_table(
        "confirmed_fields",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "case_id",
            UUID(as_uuid=True),
            sa.ForeignKey("cases.id"),
            nullable=False,
        ),
        sa.Column("field_name", sa.String(255), nullable=False),
        sa.Column("confirmed_value", sa.Text, nullable=True),
        sa.Column("original_extracted_value", sa.Text, nullable=True),
        sa.Column("was_corrected", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "caseworker_id",
            UUID(as_uuid=True),
            sa.ForeignKey("caseworkers.id"),
            nullable=False,
        ),
        sa.Column(
            "confirmed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_confirmed_fields_case_id", "confirmed_fields", ["case_id"])

    op.create_table(
        "audit_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "case_id",
            UUID(as_uuid=True),
            sa.ForeignKey("cases.id"),
            nullable=True,
        ),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("actor", sa.String(255), nullable=False),
        sa.Column("payload", JSON, nullable=False, server_default=sa.text("'{}'")),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_audit_log_case_id", "audit_log", ["case_id"])
    op.create_index("ix_audit_log_timestamp", "audit_log", ["timestamp"])


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("confirmed_fields")
    op.drop_table("extracted_fields")
    op.drop_table("cases")
    op.drop_table("caseworkers")

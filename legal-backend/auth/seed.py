"""
Seed script — creates the default admin caseworker.

Usage:
    python -m auth.seed

Requires DATABASE_URL to be set in the environment.
Idempotent: skips creation if admin@poc.com already exists.
"""

from __future__ import annotations

import sys
import uuid

from database.connection import SessionLocal
from database.models import Caseworker
from auth.auth import hash_password


ADMIN_EMAIL = "admin@poc.com"
ADMIN_PASSWORD = "admin123"
ADMIN_NAME = "Admin"
ADMIN_ROLE = "admin"


def seed() -> None:
    db = SessionLocal()
    try:
        existing = db.query(Caseworker).filter_by(email=ADMIN_EMAIL).first()
        if existing:
            print(f"[seed] {ADMIN_EMAIL} already exists — skipping.")
            return

        admin = Caseworker(
            id=uuid.uuid4(),
            name=ADMIN_NAME,
            email=ADMIN_EMAIL,
            hashed_password=hash_password(ADMIN_PASSWORD),
            role=ADMIN_ROLE,
        )
        db.add(admin)
        db.commit()
        print(f"[seed] Created admin caseworker: {ADMIN_EMAIL}")
    except Exception as exc:
        db.rollback()
        print(f"[seed] ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed()

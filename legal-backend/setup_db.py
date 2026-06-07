"""
Database setup script — run once on a fresh deployment.

Usage:
    cd legal-backend
    python setup_db.py

What it does:
    1. Creates all tables (idempotent — safe to re-run)
    2. Seeds the default admin caseworker if none exists
    3. Prints a summary of what was done

Requires DATABASE_URL in the environment (or in .env next to this file).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Load .env from the same directory
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip())

if not os.environ.get("DATABASE_URL"):
    print("ERROR: DATABASE_URL is not set. Add it to legal-backend/.env or export it.")
    sys.exit(1)

from sqlalchemy import inspect, text
from database.connection import engine
from database.models import Base, Caseworker


def create_tables() -> list[str]:
    inspector = inspect(engine)
    existing = set(inspector.get_table_names())
    Base.metadata.create_all(engine)
    inspector = inspect(engine)
    return [t for t in inspector.get_table_names() if t not in existing]


def seed_admin() -> bool:
    import hashlib
    from sqlalchemy.orm import Session

    with Session(engine) as db:
        if db.query(Caseworker).count() > 0:
            return False
        pw_hash = hashlib.sha256(b"admin123").hexdigest()
        db.add(Caseworker(
            name="Admin",
            email="admin@poc.com",
            hashed_password=pw_hash,
            role="admin",
        ))
        db.commit()
        return True


def main() -> None:
    print("=" * 55)
    print("  GIP Platform — Database Setup")
    print("=" * 55)

    print("\n[1/3] Testing database connection…")
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("      OK —", os.environ["DATABASE_URL"].split("@")[-1])
    except Exception as exc:
        print(f"      FAILED: {exc}")
        sys.exit(1)

    print("\n[2/3] Creating tables…")
    created = create_tables()
    if created:
        for t in created:
            print(f"      + {t}")
    else:
        print("      All tables already exist.")

    print("\n[3/3] Seeding default admin caseworker…")
    if seed_admin():
        print("      Created admin@poc.com  password: admin123")
        print("      ⚠  Change this password before going to production.")
    else:
        print("      Caseworkers already exist — skipped.")

    print("\nSetup complete.\n")


if __name__ == "__main__":
    main()

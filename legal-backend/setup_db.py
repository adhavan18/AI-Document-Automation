"""
Database setup script — run this once on a new machine.

What it does
------------
1. Reads (or asks for) PostgreSQL connection details.
2. Creates the 'legal_processing' database if it does not exist.
3. Runs Alembic migrations to create all tables.
4. Seeds a default admin caseworker so you can log in immediately.

Usage
-----
    python setup_db.py

Requirements
------------
    pip install psycopg2-binary alembic sqlalchemy passlib[bcrypt] python-dotenv
    (all already in requirements.txt)
"""

from __future__ import annotations

import os
import secrets
import sys
import textwrap
import uuid
from pathlib import Path

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hr(char: str = "-", width: int = 60) -> None:
    print(char * width)


def _ok(msg: str) -> None:
    print(f"  [OK]  {msg}")


def _info(msg: str) -> None:
    print(f"  [..]  {msg}")


def _err(msg: str) -> None:
    print(f"  [!!]  {msg}", file=sys.stderr)


def _ask(prompt: str, default: str = "") -> str:
    display = f"{prompt} [{default}]: " if default else f"{prompt}: "
    answer = input(display).strip()
    return answer or default


def _ask_password(prompt: str, default: str = "") -> str:
    import getpass
    display = f"{prompt} [{('*' * len(default)) if default else ''}]: "
    answer = getpass.getpass(display).strip()
    return answer or default


# ---------------------------------------------------------------------------
# Step 0 — load .env if present
# ---------------------------------------------------------------------------

ENV_PATH = Path(__file__).parent / ".env"

def _load_env_file() -> dict[str, str]:
    if not ENV_PATH.exists():
        return {}
    values: dict[str, str] = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        values[key.strip()] = val.strip().strip('"').strip("'")
    return values


# ---------------------------------------------------------------------------
# Step 1 — gather connection parameters
# ---------------------------------------------------------------------------

def _gather_params() -> dict:
    _hr("=")
    print("  USCIS Legal Processing — Database Setup")
    _hr("=")
    print()
    print("  This script will CREATE the database and run all migrations.")
    print("  Press Enter to accept the default value shown in [brackets].")
    print()

    env = _load_env_file()

    # Parse DATABASE_URL if present
    db_url = env.get("DATABASE_URL", "")
    url_host = "localhost"
    url_port = "5432"
    url_user = "postgres"
    url_pass = ""
    url_db   = "legal_processing"

    if db_url.startswith("postgresql://"):
        try:
            from urllib.parse import urlparse
            parsed = urlparse(db_url)
            url_host = parsed.hostname or url_host
            url_port = str(parsed.port or 5432)
            url_user = parsed.username or url_user
            url_pass = parsed.password or url_pass
            url_db   = parsed.path.lstrip("/") or url_db
        except Exception:
            pass

    _hr()
    print("  PostgreSQL connection (needs CREATE DATABASE privilege)")
    _hr()
    host     = _ask("  Host",     url_host)
    port     = _ask("  Port",     url_port)
    admin_user = _ask("  Admin user", url_user)
    admin_pass = _ask_password("  Admin password", url_pass)
    db_name  = _ask("  Database name to create", url_db)

    print()
    _hr()
    print("  Application user (the .env DATABASE_URL account)")
    _hr()
    print("  If you want a dedicated DB user, enter different credentials.")
    print("  Press Enter to use the same admin account (simplest for local dev).")
    app_user = _ask("  App DB user",     admin_user)
    app_pass = _ask_password("  App DB password", admin_pass)
    print()

    return {
        "host":       host,
        "port":       port,
        "admin_user": admin_user,
        "admin_pass": admin_pass,
        "db_name":    db_name,
        "app_user":   app_user,
        "app_pass":   app_pass,
        "app_url":    f"postgresql://{app_user}:{app_pass}@{host}:{port}/{db_name}",
    }


# ---------------------------------------------------------------------------
# Step 2 — create database
# ---------------------------------------------------------------------------

def _create_database(p: dict) -> None:
    _hr()
    print("  Step 1 — Create database")
    _hr()

    try:
        import psycopg2
        from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    except ImportError:
        _err("psycopg2 not installed. Run:  pip install psycopg2-binary")
        sys.exit(1)

    # Connect to 'postgres' maintenance db to issue CREATE DATABASE
    _info(f"Connecting to {p['host']}:{p['port']} as {p['admin_user']} ...")
    try:
        conn = psycopg2.connect(
            host=p["host"],
            port=int(p["port"]),
            user=p["admin_user"],
            password=p["admin_pass"],
            dbname="postgres",
        )
    except Exception as exc:
        _err(f"Could not connect: {exc}")
        _err("Check that PostgreSQL is running and the credentials are correct.")
        sys.exit(1)

    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    # Check if DB already exists
    cur.execute(
        "SELECT 1 FROM pg_database WHERE datname = %s", (p["db_name"],)
    )
    exists = cur.fetchone() is not None

    if exists:
        _ok(f"Database '{p['db_name']}' already exists — skipping CREATE.")
    else:
        _info(f"Creating database '{p['db_name']}' ...")
        cur.execute(f'CREATE DATABASE "{p["db_name"]}"')
        _ok(f"Database '{p['db_name']}' created.")

    # Create app user if different from admin
    if p["app_user"] != p["admin_user"]:
        cur.execute(
            "SELECT 1 FROM pg_roles WHERE rolname = %s", (p["app_user"],)
        )
        if cur.fetchone() is None:
            _info(f"Creating role '{p['app_user']}' ...")
            cur.execute(
                f"CREATE ROLE \"{p['app_user']}\" "
                f"WITH LOGIN PASSWORD %s",
                (p["app_pass"],),
            )
            cur.execute(
                f'GRANT ALL PRIVILEGES ON DATABASE "{p["db_name"]}" '
                f'TO "{p["app_user"]}"'
            )
            _ok(f"Role '{p['app_user']}' created and granted privileges.")
        else:
            _ok(f"Role '{p['app_user']}' already exists — skipping CREATE.")

    cur.close()
    conn.close()


# ---------------------------------------------------------------------------
# Step 3 — run Alembic migrations
# ---------------------------------------------------------------------------

def _run_migrations(p: dict) -> None:
    _hr()
    print("  Step 2 — Run Alembic migrations")
    _hr()

    # Temporarily set DATABASE_URL so Alembic picks it up
    os.environ["DATABASE_URL"] = p["app_url"]

    script_dir = Path(__file__).parent
    ini_path   = script_dir / "alembic.ini"
    if not ini_path.exists():
        _err("alembic.ini not found — are you in the project root?")
        sys.exit(1)

    _info("Running:  alembic upgrade head")
    try:
        from alembic.config import Config
        from alembic import command

        alembic_cfg = Config(str(ini_path))
        alembic_cfg.set_main_option("sqlalchemy.url", p["app_url"])
        command.upgrade(alembic_cfg, "head")
        _ok("All migrations applied successfully.")
    except Exception as exc:
        _err(f"Migration failed: {exc}")
        sys.exit(1)


# ---------------------------------------------------------------------------
# Step 4 — seed default admin caseworker
# ---------------------------------------------------------------------------

_DEFAULT_ADMIN_EMAIL    = "admin@uscis.local"
_DEFAULT_ADMIN_NAME     = "Admin"
_DEFAULT_ADMIN_PASSWORD = "Admin1234!"


def _seed_admin(p: dict) -> None:
    _hr()
    print("  Step 3 — Seed default admin caseworker")
    _hr()

    os.environ["DATABASE_URL"] = p["app_url"]

    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.orm import sessionmaker
        from passlib.context import CryptContext

        engine = create_engine(p["app_url"])
        Session = sessionmaker(bind=engine)
        db = Session()

        # Check if admin already seeded
        row = db.execute(
            text("SELECT id FROM caseworkers WHERE email = :e"),
            {"e": _DEFAULT_ADMIN_EMAIL},
        ).fetchone()

        if row:
            _ok(f"Admin caseworker '{_DEFAULT_ADMIN_EMAIL}' already exists — skipping.")
            db.close()
            return

        pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hashed  = pwd_ctx.hash(_DEFAULT_ADMIN_PASSWORD)

        db.execute(
            text(
                "INSERT INTO caseworkers (id, name, email, hashed_password, role) "
                "VALUES (:id, :name, :email, :pw, :role)"
            ),
            {
                "id":   str(uuid.uuid4()),
                "name": _DEFAULT_ADMIN_NAME,
                "email": _DEFAULT_ADMIN_EMAIL,
                "pw":   hashed,
                "role": "admin",
            },
        )
        db.commit()
        db.close()
        _ok(f"Admin caseworker created: {_DEFAULT_ADMIN_EMAIL}")
    except Exception as exc:
        _err(f"Seeding failed: {exc}")
        _err("The database and tables were created — seed manually if needed.")


# ---------------------------------------------------------------------------
# Step 5 — write / update .env
# ---------------------------------------------------------------------------

def _update_env(p: dict) -> None:
    _hr()
    print("  Step 4 — Update .env file")
    _hr()

    existing = ENV_PATH.read_text(encoding="utf-8") if ENV_PATH.exists() else ""

    jwt_secret = os.environ.get("JWT_SECRET") or secrets.token_hex(32)

    new_env = textwrap.dedent(f"""\
        # Generated by setup_db.py
        ANTHROPIC_API_KEY={os.environ.get('ANTHROPIC_API_KEY', 'sk-ant-api03-REPLACE-ME')}
        JWT_SECRET={jwt_secret}
        DATABASE_URL={p['app_url']}
        PORT=8001
    """)

    if "DATABASE_URL" in existing:
        _ok(".env already exists — not overwriting (edit DATABASE_URL manually if needed).")
        _info(f"  Your DATABASE_URL should be: {p['app_url']}")
    else:
        ENV_PATH.write_text(new_env, encoding="utf-8")
        _ok(f".env written with DATABASE_URL={p['app_url']}")


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def _summary(p: dict) -> None:
    _hr("=")
    print("  Setup complete!")
    _hr("=")
    print()
    print("  Database  :", p["app_url"])
    print("  Tables    : caseworkers, cases, extracted_fields,")
    print("              confirmed_fields, audit_log")
    print()
    print("  Default admin login:")
    print(f"    Email   : {_DEFAULT_ADMIN_EMAIL}")
    print(f"    Password: {_DEFAULT_ADMIN_PASSWORD}")
    print()
    print("  Start the server:")
    print("    python -m uvicorn app:app --host 0.0.0.0 --port 8001")
    print()
    print("  Then open:  http://localhost:8001")
    _hr("=")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    try:
        params = _gather_params()
        _create_database(params)
        _run_migrations(params)
        _seed_admin(params)
        _update_env(params)
        _summary(params)
    except KeyboardInterrupt:
        print("\n\n  Cancelled.")
        sys.exit(0)

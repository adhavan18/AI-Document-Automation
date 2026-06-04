-- =============================================================================
-- USCIS Legal Processing — Full Database Schema
-- =============================================================================
-- Run this file once on a fresh PostgreSQL server to create everything.
--
-- Usage (psql):
--   psql -U postgres -f schema.sql
--
-- Or inside psql:
--   \i /path/to/schema.sql
--
-- What this script does:
--   1. Creates the 'legal_processing' database
--   2. Creates a dedicated app user 'uscis' (change password before deploy)
--   3. Enables the pgcrypto extension (needed for gen_random_uuid())
--   4. Creates all 5 tables with indexes and foreign keys
--   5. Stamps the Alembic migration version so 'alembic upgrade head' won't
--      re-run the migration
--   6. Inserts a default admin caseworker
-- =============================================================================


-- =============================================================================
-- SECTION 1 — Database and user
-- (Run as PostgreSQL superuser, e.g. postgres)
-- =============================================================================

-- Create the application role / user
-- Change 'StrongPassword123!' to your real password before deploying.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'uscis') THEN
        CREATE ROLE uscis WITH LOGIN PASSWORD 'StrongPassword123!';
    END IF;
END
$$;

-- Create the database owned by the app user
SELECT 'CREATE DATABASE legal_processing OWNER uscis'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'legal_processing')\gexec

-- Grant all privileges on the database to the app user
GRANT ALL PRIVILEGES ON DATABASE legal_processing TO uscis;


-- =============================================================================
-- Switch into the new database before running the rest.
-- In psql:  \c legal_processing
-- =============================================================================
\c legal_processing


-- =============================================================================
-- SECTION 2 — Extensions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- uuid_generate_v4() (fallback)


-- =============================================================================
-- SECTION 3 — Tables
-- =============================================================================

-- ---------------------------------------------------------------------------
-- caseworkers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS caseworkers (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255)  NOT NULL,
    email           VARCHAR(255)  NOT NULL,
    hashed_password VARCHAR(255)  NOT NULL,
    role            VARCHAR(50)   NOT NULL,          -- 'admin' | 'reviewer'
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT uq_caseworkers_email UNIQUE (email)
);


-- ---------------------------------------------------------------------------
-- cases
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cases (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    form_type      VARCHAR(50)  NOT NULL,
    status         VARCHAR(50)  NOT NULL DEFAULT 'pending',
                                -- pending | in_review | approved | rejected | failed
    uploaded_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    reviewed_at    TIMESTAMPTZ,
    caseworker_id  UUID         REFERENCES caseworkers(id),
    pdf_path       TEXT         NOT NULL,
    form_version   VARCHAR(50),
    edition_date   VARCHAR(50),
    page_count     INTEGER      NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_cases_status        ON cases (status);
CREATE INDEX IF NOT EXISTS ix_cases_caseworker_id ON cases (caseworker_id);
CREATE INDEX IF NOT EXISTS ix_cases_uploaded_at   ON cases (uploaded_at DESC);


-- ---------------------------------------------------------------------------
-- extracted_fields
-- Pipeline-extracted field values for each case.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS extracted_fields (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id          UUID          NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    field_name       VARCHAR(255)  NOT NULL,
    raw_value        TEXT,
    normalized_value TEXT,
    confidence       DOUBLE PRECISION NOT NULL,
    source           VARCHAR(50)   NOT NULL,   -- 'native' | 'llm' | 'human'
    page_number      INTEGER,
    bounding_box     JSONB
);

CREATE INDEX IF NOT EXISTS ix_extracted_fields_case_id   ON extracted_fields (case_id);
CREATE INDEX IF NOT EXISTS ix_extracted_fields_field_name ON extracted_fields (field_name);


-- ---------------------------------------------------------------------------
-- confirmed_fields
-- Caseworker-reviewed and confirmed field values.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS confirmed_fields (
    id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id                 UUID         NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    field_name              VARCHAR(255) NOT NULL,
    confirmed_value         TEXT,
    original_extracted_value TEXT,
    was_corrected           BOOLEAN      NOT NULL DEFAULT false,
    caseworker_id           UUID         NOT NULL REFERENCES caseworkers(id),
    confirmed_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_confirmed_fields_case_id ON confirmed_fields (case_id);


-- ---------------------------------------------------------------------------
-- audit_log
-- Immutable event log — every pipeline and caseworker action is recorded here.
-- event_type values:
--   upload_received | case_created | exceptions_matched | case_assigned |
--   case_confirmed  | case_rejected | pipeline_error
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id     UUID         REFERENCES cases(id) ON DELETE SET NULL,
    event_type  VARCHAR(100) NOT NULL,
    actor       VARCHAR(255) NOT NULL,
    payload     JSONB        NOT NULL DEFAULT '{}',
    timestamp   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_audit_log_case_id   ON audit_log (case_id);
CREATE INDEX IF NOT EXISTS ix_audit_log_timestamp ON audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS ix_audit_log_event     ON audit_log (event_type);


-- =============================================================================
-- SECTION 4 — Alembic version stamp
-- Tells Alembic that migration 0001 is already applied so it won't re-run.
-- =============================================================================

CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) PRIMARY KEY
);

INSERT INTO alembic_version (version_num)
VALUES ('0001')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- SECTION 5 — Default admin caseworker
--
-- Email   : admin@uscis.local
-- Password: Admin1234!
--
-- The hashed_password below is a bcrypt hash of 'Admin1234!'.
-- Change both the plain password AND the hash before deploying to production.
--
-- To generate a new hash in Python:
--   from passlib.context import CryptContext
--   print(CryptContext(schemes=['bcrypt']).hash('YourNewPassword'))
-- =============================================================================

INSERT INTO caseworkers (id, name, email, hashed_password, role)
VALUES (
    gen_random_uuid(),
    'Admin',
    'admin@uscis.local',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfXtGkScpPFi.y8Aq',
    'admin'
)
ON CONFLICT (email) DO NOTHING;


-- =============================================================================
-- SECTION 6 — Grant table-level permissions to the app user
-- =============================================================================

GRANT USAGE  ON SCHEMA public TO uscis;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO uscis;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO uscis;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO uscis;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT                  ON SEQUENCES TO uscis;


-- =============================================================================
-- Done.
-- =============================================================================
\echo ''
\echo '============================================================'
\echo ' Database setup complete.'
\echo ' Tables created: caseworkers, cases, extracted_fields,'
\echo '                 confirmed_fields, audit_log'
\echo ' Default login : admin@uscis.local / Admin1234!'
\echo ' CHANGE THE PASSWORD before going to production.'
\echo '============================================================'
\echo ''

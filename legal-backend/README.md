# USCIS Legal Processing System

An AI-powered pipeline for processing, extracting, and reviewing USCIS immigration forms. Uploaded PDFs are run through a 4-stage intelligence pipeline and routed to a caseworker review queue with exception flagging.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [4-Stage Pipeline](#4-stage-pipeline)
- [Supported Forms](#supported-forms)
- [Project Structure](#project-structure)
- [Setup (New Machine)](#setup-new-machine)
- [Running the Server](#running-the-server)
- [API Reference](#api-reference)
- [Review Queue UI](#review-queue-ui)
- [Exception Catalog](#exception-catalog)
- [Environment Variables](#environment-variables)

---

## Architecture Overview

```
PDF Upload
    │
    ▼
┌─────────────────────────────────────────────┐
│              4-Stage Pipeline               │
│                                             │
│  Stage 1 ── Identity Resolver               │
│  Stage 2 ── Document Classifier             │
│  Stage 3 ── Skills Extractor                │
│  Stage 4 ── Exception Matcher + LLM         │
└─────────────────────────────────────────────┘
    │
    ▼
PostgreSQL (cases, fields, exceptions, audit log)
    │
    ▼
Caseworker Review Queue UI  ──  Approve / Reject
```

**Stack:** FastAPI · PostgreSQL · SQLAlchemy · Alembic · Anthropic Claude · instructor · pdfplumber · pytesseract

---

## 4-Stage Pipeline

### Stage 1 — Identity Resolver (`intelligence/identity_resolver.py`)

Scans AcroForm fields and raw/OCR text to extract identity anchors. Returns `null` for anything not confidently found — no guessing.

| Field | Description |
|---|---|
| `client_name` | Full legal name of the petitioner or applicant |
| `alien_number` | A-Number in format `A-XXX-XXX-XXX` |
| `receipt_number` | USCIS receipt number (`XAC`/`WAC`/`LIN`/`SRC` + 10 digits) |
| `date_of_birth` | DOB normalized to `YYYY-MM-DD` |
| `ssn_last4` | Last 4 digits of SSN only — full SSN is never exposed |
| `employer_name` | Petitioning company name |

---

### Stage 2 — Document Classifier (`intelligence/classifier.py`)

Identifies the USCIS form type from AcroForm field patterns and keyword scoring. Adds metadata the raw identifier didn't provide.

| Field | Description |
|---|---|
| `form_id` | Canonical form number e.g. `I-129`, `I-485`, `N-400` |
| `form_title` | Official USCIS title |
| `edition_date` | Edition date printed on the form e.g. `04/01/24` |
| `supplement` | Supplement label if applicable e.g. `Supplement J` |
| `confidence` | `high` \| `medium` \| `low` |
| `reason` | One sentence explaining how the form was identified |

> **If `confidence` is `low` the pipeline halts** and the case is immediately routed to high-priority human review.

---

### Stage 3 — Skills Extractor

Loads the field manifest from `skills/<form_id>.json` and runs native AcroForm + regex extraction against the declared fields only.

**Manifest format (`skills/i-485.json` example):**
```json
{
  "form_id": "I-485",
  "form_title": "Application to Register Permanent Residence or Adjust Status",
  "fields": [
    {
      "name": "alien_registration_number",
      "required": true,
      "type": "string",
      "hint": "Part 1, Item 1 — A-Number (A-XXXXXXXXX)"
    }
  ]
}
```

Required fields with a `null` extracted value are flagged with `"issue": "missing"`.

---

### Stage 4 — Exception Matcher + LLM Fallback (`intelligence/exception_matcher.py`)

Two sub-steps run in sequence:

**Step A — LLM Field Correction**  
Fields with confidence below `0.7` are sent to Claude (`claude-sonnet-4-6`) via `instructor` for correction. The LLM also emits `narrative_flags` for risk signals (expired status, prior petitions, invalid SOC codes, etc.).

**Step B — Exception Catalog Evaluation**  
Loads `exceptions/<form_id>.json` (15 exceptions per form, sourced from the USCIS exception catalog). Claude evaluates every exception against the corrected field values in a single structured call and returns which ones are triggered and why.

**Stage 4 output:**
```json
{
  "stage": "exception_matcher",
  "client_name": "SMITH, John",
  "form_id": "I-485",
  "edition_date": "09/17/19",
  "total_exceptions_triggered": 2,
  "exceptions": [
    {
      "seq": 1,
      "category": "Structural",
      "exception_title": "Missing Medical Exam I-693 Seal",
      "exception_description": "...",
      "triggered_by": "alien_registration_number: field is null and required"
    }
  ]
}
```

---

## Supported Forms

16 USCIS forms are fully supported, each with a `skills/*.json` manifest and `exceptions/*.json` catalog:

| Form | Title |
|---|---|
| I-129 | Petition for a Nonimmigrant Worker |
| I-129F | Petition for Alien Fiance(e) |
| I-130 | Petition for Alien Relative |
| I-131 | Application for Travel Document |
| I-140 | Immigrant Petition for Alien Workers |
| I-290B | Notice of Appeal or Motion |
| I-485 | Application to Register Permanent Residence or Adjust Status |
| I-485 Supp J | Supplement J — Job Offer / Portability Confirmation |
| I-539 | Application to Extend/Change Nonimmigrant Status |
| I-751 | Petition to Remove Conditions on Residence |
| I-765 | Application for Employment Authorization |
| I-797 | Notice of Action |
| I-824 | Application for Action on an Approved Application or Petition |
| I-90 | Application to Replace Permanent Resident Card |
| N-400 | Application for Naturalization |
| N-600 | Application for Certificate of Citizenship |

---

## Project Structure

```
legal-processing/
│
├── app.py                        # FastAPI app, upload endpoint, review queue UI
├── schema.sql                    # Raw SQL to create the database (for deployment)
├── setup_db.py                   # Interactive Python setup script (for new machines)
├── requirements.txt
├── alembic.ini
│
├── intelligence/
│   ├── identity_resolver.py      # Stage 1 — identity anchors
│   ├── classifier.py             # Stage 2 — form type + edition date
│   ├── native.py                 # AcroForm + regex field extraction
│   ├── llm_fallback.py           # LLM field correction (used in Stage 4)
│   ├── exception_matcher.py      # Stage 4 — exception catalog evaluation
│   ├── router.py                 # Pipeline orchestrator (wires all 4 stages)
│   ├── preprocessor.py           # PDF → text / AcroForm / images
│   └── identifier.py             # Low-level form-type identifier
│
├── skills/                       # Field manifests — one JSON per form
│   ├── i-485.json
│   ├── i-129.json
│   └── ... (16 total)
│
├── exceptions/                   # Exception catalogs — one JSON per form
│   ├── i-485.json                # 15 exceptions per form
│   ├── i-129.json
│   └── ... (16 total)
│
├── api/
│   └── review_routes.py          # GET/POST /queue endpoints (exposes exceptions)
│
├── database/
│   ├── models.py                 # SQLAlchemy ORM models
│   ├── crud.py                   # DB helper functions
│   ├── connection.py             # Engine + session factory
│   └── migrations/               # Alembic migration scripts
│
└── models/
    └── schemas.py                # Pydantic schemas for all 16 forms
```

---

## Setup (New Machine)

### Option A — SQL script (recommended for deployment)

```bash
# Run against your PostgreSQL server as superuser
psql -U postgres -f schema.sql
```

This creates the database, all tables, the `uscis` app user, and a default admin account.

### Option B — Interactive Python script (recommended for local dev)

```bash
pip install -r requirements.txt
python setup_db.py
```

Prompts for connection details, creates the DB, runs Alembic migrations, and seeds the admin account.

### Option C — Alembic (if DB already exists)

```bash
pip install -r requirements.txt
# Set DATABASE_URL in .env first
python -m alembic upgrade head
```

**System packages also required:**

```bash
# Ubuntu / Debian
apt-get install -y poppler-utils tesseract-ocr

# macOS
brew install poppler tesseract
```

---

## Running the Server

```bash
# 1. Copy and fill in environment variables
cp .env.example .env

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Start the server
python -m uvicorn app:app --host 0.0.0.0 --port 8001
```

Open **http://localhost:8001** for the Review Queue UI.

---

## API Reference

### `POST /upload`

Upload a PDF. Runs the full 4-stage pipeline synchronously.

**Response:**
```json
{
  "case_id": "uuid",
  "form_type": "I-485",
  "status": "pending",
  "priority": "high",
  "escalation_flags": [],
  "fields_extracted": 8,
  "exceptions_triggered": 2,
  "stage1": { "stage": "identity_resolver", "client_name": "...", ... },
  "stage2": { "stage": "document_classifier", "form_id": "...", ... },
  "stage3": { "stage": "skills_extractor", "fields": { ... } },
  "stage4": { "stage": "exception_matcher", "exceptions": [ ... ] }
}
```

### `GET /queue`

Returns the review queue (pending + in_review cases), sorted by priority then upload time.

### `GET /queue/{case_id}`

Full case detail including extracted fields, triggered exceptions, and audit log.

**New exception fields in response:**
```json
{
  "total_exceptions_triggered": 2,
  "exceptions": [
    {
      "seq": 1,
      "category": "Structural",
      "exception_title": "...",
      "exception_description": "...",
      "triggered_by": "field_name: reason"
    }
  ]
}
```

### `POST /queue/{case_id}/assign`
Claim a case for review — sets status to `in_review`.

### `POST /queue/{case_id}/confirm`
Confirm all fields (with optional corrections) — sets status to `approved`.

### `POST /queue/{case_id}/reject`
Reject a case with a reason — sets status to `rejected`.

### `GET /queue/{case_id}/pdf`
Stream the original uploaded PDF to the browser.

---

## Review Queue UI

The built-in UI at `http://localhost:8001` provides:

- **Sidebar** — filterable case list (All / Pending / In Review / High Priority)
- **Queue table** — cases with form type, status badge, priority, confidence, and exception count
- **Case review panel** — split view with PDF viewer (PDF.js) and field cards
- **Exception table** — triggered exceptions grouped with category badges (color-coded by type), expandable detail rows, and a summary badge (green = 0, amber = 1–3, red = 4+)
- **Confirm / Reject** — caseworker actions with audit trail

---

## Exception Catalog

Each form has 15 exceptions across these categories:

| Category | Description |
|---|---|
| Structural | Missing sections, supplements, or attachments |
| Field-Level | Invalid formats, codes, or values in individual fields |
| Numeric & Arithmetic | Fee calculation errors, date arithmetic anomalies |
| Identity & Entity | Name or ID mismatches across fields |
| Contextual / Tax Logic | Business/legal rule violations |
| Formatting & OCR | OCR artifacts, digit transpositions, missing diacritics |
| Cross-Document | Conflicts between fields across the document |
| LLM Interpretation | Ambiguous language requiring AI judgment |
| Engagement Integrity | Workflow and business integrity checks |
| Workflow State | Status and state transition issues |
| Cross-Year | Date range and multi-year consistency |
| Security & Compliance | Compliance and security rule violations |
| LLM-Specific Domain | Domain-specific AI evaluation checks |
| Multi-Tenant | Multi-organization data integrity |
| Data Persistence & Schema | Data storage and schema validation |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for LLM stages |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | 32+ byte hex string for JWT signing |
| `PORT` | No | Uvicorn port (default: `8001`) |

---

## Default Credentials

After running `schema.sql` or `setup_db.py`:

| Field | Value |
|---|---|
| Email | `admin@uscis.local` |
| Password | `Admin1234!` |

**Change this before deploying to production.**

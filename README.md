# GIP — AI Document Intelligence (Immigration)

AI-powered USCIS notice/form processing. Upload a PDF, the pipeline OCRs it,
extracts structured fields, and presents them in a review queue for a caseworker
to confirm.

---

## Architecture

Three services run together, all in this repo:

| Service | Tech | Port | Purpose |
|---------|------|------|---------|
| `frontend/` | Static HTML (GIP console) + Vite dev server | 3003 | UI. Proxies `/api` → Node, `/legal` → FastAPI |
| `backend/` | Node + Express | 3002 | Dashboard, deadlines, search, PDF generation |
| `legal-backend/` | FastAPI + PostgreSQL | 8001 | USCIS Notice Processing — the extraction pipeline |

The extraction pipeline runs **in a background thread** so `/upload` returns
in under a second; the UI polls for completion. Requires a running PostgreSQL.

---

## What changed in this branch (`made`)

### 1. OCR backend: Tesseract → EasyOCR
- Replaced the Tesseract binary dependency with **EasyOCR** (pure-Python, neural).
  No system binary install required — it downloads its model on first run.
- File: `legal-backend/intelligence/easyocr_text.py`

### 2. Field extraction: added NuExtract (Stage 4)
- Added **NuExtract** (`numind/NuExtract-1.5-tiny`) as a structured-extraction
  stage. It is purely extractive (no hallucination) and fills low-confidence
  fields from the OCR text.
- File: `legal-backend/intelligence/nuextract.py`
- Runs on CPU; downloads ~0.5 GB model weights on first use to
  `~/.cache/huggingface/`.

### 3. OCR-tolerant native extraction
- EasyOCR introduces predictable noise (`A-/123456789`, `|03/15/1990`, `IIndia`).
  Added `_clean_ocr()` plus OCR-tolerant regex for the I-485 form so it now
  reliably extracts Family Name, Given Name, A-Number, Date of Birth, Country
  of Birth, etc. — a real I-485 now yields **10 populated fields at 0.95
  confidence** instead of 5 defaults.
- Files: `legal-backend/intelligence/native.py`, `nuextract.py`

### 4. Async upload — fixes the "Network Error" / slow upload
- `POST /upload` now creates the case immediately, fires the pipeline in a
  background thread, and returns the `case_id` right away (< 1 s). The frontend
  polls `GET /cases/{id}/status` every 5 s until it leaves `processing`.
- Files: `legal-backend/app.py`, `intelligence/router.py`,
  `database/crud.py` (accepts a preset `case_id`)

### 5. Form-type detection from PDF content (not just filename)
- The classifier no longer halts with "Case not found" on documents whose
  filename lacks the form number. Form type is inferred from filename →
  PDF metadata → AcroForm field names → first-page text.
- File: `legal-backend/app.py`

### 6. Queue shows uploads instantly, newest-first
- The review queue now includes `processing` cases and is ordered
  **newest-first**, so a freshly uploaded document appears at the **top**
  immediately (with a spinner) and its PDF is shown right away.
- File: `legal-backend/api/review_routes.py`

### 7. New frontend — GIP console (static HTML)
- Replaced the React app with the **GIP static-HTML console** served from
  `frontend/public/`. No build step; loads instantly.
  - `gip-notice.html` — Notice Processing (live: upload, queue, PDF viewer,
    extracted-fields panel, save). Served as the root `index.html`.
  - `gip-dashboard.html` — live queue counts + recent documents
  - `gip-compliance.html`, `gip-autofiling.html` — UI screens
- Upload uses a persistent hidden file input + button (reliable file picker),
  and the viewer shows the uploaded PDF immediately while extraction runs.

### 8. Tax-form scaffolding (not wired into the live pipeline)
- Pydantic schemas + skill manifests for IRS forms (1040, W-2, W-4, 1099-*,
  Schedule A/C/D) exist under `legal-backend/models/tax_schemas.py` and
  `legal-backend/skills/` for future use. The live pipeline is USCIS-only.
- A `forms/` project folder holds per-form sample subdirectories
  (`forms/uscis/...`) for documents uploaded in the future.

---

## Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.11+ and **pip**
- **PostgreSQL** 14+ running locally
- ~1 GB free disk for the EasyOCR + NuExtract model downloads (first run only)
- No Tesseract or Poppler needed — EasyOCR is pure Python.

---

## Setup (one time)

```bash
# 1. Install all deps (Node frontend + backend, Python legal-backend)
npm run install:all
# This also pip-installs easyocr, transformers, and torch.

# 2. Create the legal-backend .env
#    (Windows: copy legal-backend\.env.example legal-backend\.env)
cp legal-backend/.env.example legal-backend/.env
```

Fill `legal-backend/.env`:

```ini
ANTHROPIC_API_KEY=sk-ant-...           # optional — only for manual Claude correction
JWT_SECRET=<32+ byte hex string>
DATABASE_URL=postgresql://uscis:password@localhost:5432/legal_processing
PORT=8001
```

```bash
# 3. Create the database + tables + default admin user
cd legal-backend
python setup_db_auto.py     # non-interactive; or: python setup_db.py
cd ..
```

> `setup_db_auto.py` connects as the `postgres` superuser to create the
> `uscis` role and `legal_processing` database, runs the Alembic migrations,
> and seeds an admin caseworker. Edit the connection constants at the top of
> the file if your local Postgres uses a different superuser/password.

---

## Run

### All three services at once

```bash
npm run dev
```

- Frontend → **http://localhost:3003**  ← open this
- Node backend → http://localhost:3002
- FastAPI backend → http://localhost:8001

### Or run each service individually

```bash
npm run dev:web     # frontend (Vite) on 3003
npm run dev:node    # Node/Express on 3002
npm run dev:api     # FastAPI on 8001  (cd legal-backend && python start_server.py)
```

### Windows (PowerShell), starting each in its own window

```powershell
# FastAPI
cd legal-backend; python start_server.py

# Node backend (new terminal)
cd backend; node server.js

# Frontend (new terminal)
cd frontend; npm run dev
```

---

## Using the app

1. Open **http://localhost:3003** (hard-refresh with **Ctrl+Shift+R** if you
   previously had the old UI cached).
2. Click **Upload** and choose any PDF (the filename does not need the form
   number — type is detected from the document).
3. The case appears at the **top** of the queue immediately with a
   "Processing" spinner, and the **PDF shows in the center** right away.
4. The pipeline runs in the background:
   - Native AcroForm/regex extraction (fast)
   - **EasyOCR** for scanned/image PDFs (~10 s/page on CPU)
   - **NuExtract** Stage 4 to fill low-confidence fields
5. When extraction finishes (~1–2 min for a scanned 24-page form), the spinner
   clears and the **Extracted Fields** panel fills with values, confidence
   bars, and Native/LLM source badges.
6. Edit any field and click **Save Fields** to confirm.

### First upload is slow — that's expected
The first document triggers a one-time download of the EasyOCR (~100 MB) and
NuExtract (~0.5 GB) models. Subsequent uploads are much faster.

---

## Extraction pipeline (legal-backend)

`intelligence/router.py` orchestrates four stages:

| Stage | Module | Does |
|-------|--------|------|
| 1 — Identity | `identity_resolver.py` | Extract name, A-number, receipt number anchors |
| 2 — Classify | `classifier.py` / `identifier.py` | Determine the USCIS form type |
| 3 — Native | `native.py` + `receipt_fields.py` | AcroForm + OCR-tolerant regex extraction |
| 4 — NuExtract | `nuextract.py` | Fill low-confidence fields from OCR text |

OCR text comes from `preprocessor.py`, which uses **pypdf** for digital text
and falls back to **EasyOCR** (`easyocr_text.py`) for scanned pages.

---

## Notes & limitations

- **NuExtract-tiny (0.5 B)** struggles with very noisy form OCR even after
  cleaning, so for I-485 the native regex extractors do most of the work.
  NuExtract is most effective on cleaner notice documents (e.g. I-797 receipt
  notices). For stronger LLM extraction on noisy scans, swap in the larger
  `numind/NuExtract-1.5` (4 B) in `nuextract.py` (slower on CPU).
- The pipeline is **USCIS-only** in the live path. Tax-form schemas exist but
  are not wired into classification/extraction.
- No Celery/Redis — extraction runs in a background thread inside the FastAPI
  process.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| UI shows old React app | Hard-refresh (**Ctrl+Shift+R**) or use a private window |
| Upload does nothing | Open DevTools → Console; you should see `[GIP] Notice page JS loaded — build v3`. If not, the browser is serving cached HTML. |
| "Network Error" on upload | Ensure FastAPI (8001) is running; upload now returns instantly so timeouts shouldn't occur |
| Queue empty after upload | Confirm Postgres is running and `DATABASE_URL` is correct |
| Fields stay empty | Scanned PDF with poor OCR — EasyOCR runs but text may be unreadable; check the FastAPI log for `[NUEXTRACT]` / `[NATIVE]` lines |

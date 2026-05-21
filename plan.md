# Plan — Immigration Paralegal Audit & Feature Roadmap

## Context

The app is a three-module AI pilot console for an immigration law firm (GIP). The three
existing modules are functional but the app is not yet usable as a daily working tool:

- **UC1 Notice Ingestion** — Upload I-797 notices, AI extracts 10 fields, verify/route
- **UC2 Compliance Doc Generation** — Upload LCA, generate H-1B Public Access File PDF
- **UC3 Cross-Validation** — AI compares H4-EAD questionnaire against passport/I-94/utility bill, flags mismatches, fills I-765 via AcroForm

A paralegal's day-to-day involves: intake new clients, collect required documents,
prepare forms, track deadlines (I-94 expiry, visa stamp expiry, filing windows),
manage attorney review/approval workflow, assemble filing packages, and track
post-filing case status. The current app covers fragments of this but has critical
gaps that make it unusable for real daily work.

---

## Gap Analysis — What a Paralegal Needs vs. What Exists

### CRITICAL (blocks daily use entirely)

| Gap | Impact |
|-----|--------|
| **No persistent storage** — in-memory store resets on every server restart | All work lost on restart; unusable in production |
| **Single hardcoded case** — UC3 only has Priya Subramanian; no way to add new clients | Can't serve any real client |
| **No client/matter creation** — no intake form, no way to add new matters | Paralegal can't onboard anyone |
| **No deadline tracking** — no expiry alerts, no calendar view | Visa expirations/RFE deadlines missed |
| **No case dashboard** — no at-a-glance view of all open cases and their statuses | No situational awareness |

### HIGH (severely limits usefulness)

| Gap | Impact |
|-----|--------|
| **No document checklist** — no tracking of which docs collected vs. outstanding | Manual mental overhead; docs get missed |
| **No attorney review workflow** — UC2 has a single "approve" button; no real review loop | Attorney can't annotate, request changes, or sign off properly |
| **No questionnaire intake UI** — UC3 questionnaire data is hardcoded in store.js | New H4 EAD clients impossible to add |
| **Search bar not wired up** — header search does nothing | Frustrating for users |
| **No additional form support** — only I-765 is generated; no I-129, I-539, I-485 | Most caseload unserved |
| **No USCIS case status lookup** — no way to check USCIS processing status | Manual lookup for every receipt number |

### MEDIUM (notable quality-of-life gaps)

| Gap | Impact |
|-----|--------|
| **No RFE workflow** — no way to track or respond to Requests for Evidence | High-stakes deadlines untracked |
| **No filing package assembly** — can't bundle cover letter + forms + exhibits into one PDF | Manual assembly still required |
| **No client communication templates** — no email drafts to request missing docs | Paralegal writes every email from scratch |
| **Dead code still in repo** — `i765-html.js`, `i765_p*.png` still exist | Confusing for devs |
| **Only 2 hardcoded users** — no way to add attorneys or paralegals | Multi-user firm can't use it |

---

## Implementation Plan

Implement in three phases, each independently shippable.

---

### Phase 1 — Make It Real (persistent data + client management)

**Goal:** A paralegal can onboard a new client, enter their data, and not lose it on restart.

#### 1A. Persistent Storage (SQLite via `better-sqlite3`)

Replace `backend/lib/store.js` in-memory store with SQLite.

- Install: `npm install better-sqlite3` in backend
- DB file at `backend/data/app.db` (gitignored, created on first run)
- Schema:
  ```sql
  CREATE TABLE matters (
    id TEXT PRIMARY KEY,
    employer TEXT, job_title TEXT, worksite_city TEXT, worksite_state TEXT,
    validity_start TEXT, validity_end TEXT, retain_until TEXT,
    soc_code TEXT, wage_range TEXT, prevailing_wage TEXT,
    posting_start TEXT, posting_end TEXT,
    lca_filename TEXT, status TEXT DEFAULT 'draft',
    paf_generated_at TEXT, approved_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE notices (
    id TEXT PRIMARY KEY,
    filename TEXT, mime TEXT, file_b64 TEXT,
    beneficiary TEXT, petitioner TEXT, receipt_number TEXT,
    receipt_notice_date TEXT, received_on TEXT, receipt_type TEXT,
    government_form TEXT, service_center TEXT, status_field TEXT,
    priority_date TEXT,
    extraction_status TEXT DEFAULT 'new',
    flagged INTEGER DEFAULT 0, manual_review INTEGER DEFAULT 0,
    verified_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE cases (
    id TEXT PRIMARY KEY,
    applicant TEXT, visa_type TEXT DEFAULT 'H-4 EAD',
    questionnaire TEXT,   -- JSON blob
    rows TEXT,            -- JSON blob
    resolved TEXT,        -- JSON blob
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE deadlines (
    id TEXT PRIMARY KEY,
    case_id TEXT REFERENCES cases(id),
    label TEXT, due_date TEXT, type TEXT,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  ```
- `backend/lib/db.js` — thin wrapper exporting `db` (synchronous sqlite3 instance)
- `backend/lib/store.js` refactored to call db instead of in-memory maps; keep same exported API so routes don't change

**Files:** `backend/lib/db.js` (NEW), `backend/lib/store.js` (REWRITE), `backend/data/.gitkeep` (NEW)

---

#### 1B. Client Intake Form for UC3

Currently the UC3 case is seeded with hardcoded Priya data. Replace with:

**Backend:**
- `POST /api/uc3/cases` — create new case with questionnaire fields
- `GET /api/uc3/cases` — list all cases with status summary
- `GET /api/uc3/cases/:id` — get single case (rename existing `/case` → `/cases/:id`)
- `POST /api/uc3/cases/:id/run` — run extraction (existing logic, now per case)
- `POST /api/uc3/cases/:id/resolve` — resolve mismatch (existing logic, now per case)
- `POST /api/uc3/cases/:id/save` — generate I-765 PDF (existing logic)

Questionnaire fields required at intake:
```
Full Legal Name, Date of Birth, Passport Number, Passport Expiry,
Country of Birth, Most Recent Entry Date, Visa Class on Entry, Current Address,
USCIS Receipt Number (spouse H-1B), Attorney Email
```

**Frontend UC3:**
- Replace single-case view with case list + "New Case" button
- New case modal/form with all questionnaire fields
- Selecting a case from the list opens the existing validation view

**Files:** `backend/routes/uc3.js` (extend), `frontend/src/console/modules/Uc3CrossValidation.jsx` (extend)

---

#### 1C. Case Dashboard (home screen)

Replace the empty default state when no module is selected with a dashboard showing:

- **Stats bar**: Open cases, Pending attorney review, Deadlines this week, Notices in queue
- **Urgent items table**: Cases with deadlines in the next 30 days (sorted by urgency)
- **Recent activity feed**: Last 5 actions across all modules

**Files:** `frontend/src/console/modules/Dashboard.jsx` (NEW), `ConsoleApp.jsx` (add as default module), `backend/routes/dashboard.js` (NEW) with `GET /api/dashboard/summary`

---

### Phase 2 — Deadline Tracking + Document Checklist

**Goal:** A paralegal never misses a filing deadline and always knows what documents are outstanding.

#### 2A. Deadline Management

**Backend:**
- Deadlines table (already in schema above)
- `GET /api/deadlines` — all deadlines, sorted by due_date
- `POST /api/deadlines` — create deadline (case_id, label, due_date, type)
- `PATCH /api/deadlines/:id/complete` — mark done
- Auto-create deadlines when a case is created:
  - I-94 expiration (from Most Recent Entry Date + standard duration)
  - Passport expiry (from Passport Expiry field)
  - I-765 filing window (based on H-4 validity)

**Frontend:**
- Sidebar item: **Deadlines** (calendar icon)
- Timeline view: color-coded by urgency (red < 7 days, amber 7–30, green > 30)
- Inline "Mark complete" button per deadline
- Dashboard stat card links to filtered deadline view

**Files:** `backend/routes/deadlines.js` (NEW), `frontend/src/console/modules/Deadlines.jsx` (NEW)

---

#### 2B. Document Checklist per Case

**Backend:**
- `GET /api/uc3/cases/:id/checklist` — return checklist items with status
- `PATCH /api/uc3/cases/:id/checklist/:item` — mark item received/outstanding
- Standard H4-EAD checklist items:
  - Passport (bio page)
  - I-94 printout
  - Proof of address (utility bill)
  - Spouse I-129 approval notice (I-797)
  - Spouse EAD (if applicable)
  - Photos (2×2 inch)
  - Filing fee check/money order
  - Completed questionnaire

**Frontend:**
- Checklist panel in UC3 case detail view (left sidebar, below document upload)
- Checkbox per item + "Upload" button to attach the document
- Progress bar showing X of Y items received

**Files:** `backend/routes/uc3.js` (extend), `frontend/src/console/modules/Uc3CrossValidation.jsx` (extend)

---

### Phase 3 — Attorney Review Workflow + USCIS Status

**Goal:** Complete the attorney sign-off loop and enable post-filing tracking.

#### 3A. Attorney Review Workflow

Current UC2 "Approve" button is a single click with no review interface.

**Backend:**
- `POST /api/uc2/matters/:id/submit-review` — paralegal submits for attorney review (status: `pending_review`)
- `POST /api/uc2/matters/:id/approve` — attorney approves with optional note
- `POST /api/uc2/matters/:id/request-changes` — attorney sends back with change notes
- Add `review_notes TEXT, submitted_at TEXT, reviewed_at TEXT, reviewed_by TEXT` columns to matters table

**Frontend:**
- UC2 status flow: `draft` → `extracted` → `generated` → `pending_review` → `approved` (or `changes_requested`)
- When `senior attorney` user is logged in: show Approve + Request Changes buttons with text area
- When `paralegal` user is logged in: show "Submit for Review" button
- Changes-requested state shows attorney's notes inline

**Files:** `backend/routes/uc2.js` (extend), `frontend/src/console/modules/Uc2ComplianceGeneration.jsx` (extend)

---

#### 3B. USCIS Case Status Lookup

Paralegals check USCIS.gov case status manually for every receipt number.

**Backend:**
- `GET /api/uscis/status/:receiptNumber` — scrape/proxy USCIS case status
- USCIS has a public status API: `https://egov.uscis.gov/casestatus/mycasestatus.do` (POST with `appReceiptNum`)
- Parse response HTML to extract status text and last updated date
- Cache result for 1 hour (in-memory is fine — status doesn't change that fast)

**Frontend:**
- UC1: after a notice is verified, show a "Check USCIS Status" button that uses the extracted receipt number
- Results show status string + last updated date inline

**Files:** `backend/routes/uscis.js` (NEW), `frontend/src/console/modules/Uc1NoticeIngestion.jsx` (extend)

---

#### 3C. Wire Up Search

Header search bar currently does nothing.

- `GET /api/search?q=<query>` — search across notices (beneficiary/petitioner/receipt), matters (employer/job title), cases (applicant name)
- Returns unified results list with type + id + label
- Frontend: clicking a result navigates to the relevant module + item

**Files:** `backend/routes/search.js` (NEW), `frontend/src/console/ConsoleApp.jsx` (wire search input)

---

## Critical Files

### Backend
- `backend/lib/db.js` — NEW (SQLite connection)
- `backend/lib/store.js` — REWRITE (persistent-backed)
- `backend/routes/uc3.js` — EXTEND (multi-case, intake)
- `backend/routes/uc2.js` — EXTEND (review workflow)
- `backend/routes/dashboard.js` — NEW
- `backend/routes/deadlines.js` — NEW
- `backend/routes/uscis.js` — NEW
- `backend/routes/search.js` — NEW
- `backend/server.js` — add new route mounts

### Frontend
- `frontend/src/console/modules/Dashboard.jsx` — NEW
- `frontend/src/console/modules/Deadlines.jsx` — NEW
- `frontend/src/console/modules/Uc3CrossValidation.jsx` — EXTEND (case list + intake form + checklist)
- `frontend/src/console/modules/Uc2ComplianceGeneration.jsx` — EXTEND (review workflow)
- `frontend/src/console/modules/Uc1NoticeIngestion.jsx` — EXTEND (USCIS status lookup)
- `frontend/src/console/ConsoleApp.jsx` — EXTEND (dashboard as default, deadlines in sidebar, wire search)
- `frontend/src/console/api.js` — EXTEND (new API calls)

---

## Implementation Order

1. **Phase 1A** — SQLite persistence (unblocks everything; do first)
2. **Phase 1B** — UC3 multi-case intake (highest daily paralegal impact)
3. **Phase 1C** — Dashboard (immediate orientation when logging in)
4. **Phase 2A** — Deadline tracking (prevents missed deadlines)
5. **Phase 2B** — Document checklist (rounds out UC3)
6. **Phase 3A** — Attorney review workflow (completes UC2)
7. **Phase 3B** — USCIS status lookup (high-value, relatively simple)
8. **Phase 3C** — Search (quality of life)

---

## Verification

After Phase 1:
1. Start backend, create a new H4 EAD case via UC3 intake form
2. Restart backend — case should survive restart (SQLite persisted)
3. Run AI extraction on the new case — results save to DB
4. Verify dashboard shows the case

After Phase 2:
5. Check that deadlines auto-create when a case is added
6. Mark a deadline complete — verify it persists across restart
7. Add documents via checklist — verify progress bar updates

After Phase 3:
8. Log in as paralegal, submit UC2 PAF for attorney review
9. Log in as attorney (`admin@lawfirm.com`), approve with a note
10. Verify USCIS status lookup returns a status string for a valid receipt number (e.g., IOE0000000001)
11. Search for "Priya" — verify it returns the UC3 case
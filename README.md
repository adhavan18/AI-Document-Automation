# Legal Document Intelligence

App showcasing AI document processing for immigration workflows.

## Architecture

Three services run together, all in this repo:

| Service | Tech | Port | Purpose |
|---------|------|------|---------|
| `frontend/` | React + Vite | 3003 | UI. Proxies `/api` → Node, `/legal` → FastAPI |
| `backend/` | Node + Express | 3002 | UC1/UC2/UC3, dashboard, deadlines, search |
| `legal-backend/` | FastAPI + PostgreSQL | 8001 | USCIS Notice Processing (4-stage extraction pipeline) |

> `legal-backend/` runs its extraction pipeline **synchronously** inside the `/upload`
> request — no Celery/Redis. Requires a running PostgreSQL.

## Quick Start

### One-time setup

```bash
# Node deps (frontend + backend) and Python deps (legal-backend)
npm run install:all

# Each backend needs its own .env (copy the example and fill in secrets):
cp backend/.env.example backend/.env             # ANTHROPIC_API_KEY, GOOGLE_GEMINI_API_KEY
cp legal-backend/.env.example legal-backend/.env  # ANTHROPIC_API_KEY, JWT_SECRET, DATABASE_URL

# PostgreSQL must be running for legal-backend. Either use your own, or:
cd legal-backend && docker compose up -d postgres && python setup_db.py
```

### Run everything (one command)

```bash
npm run dev
```

Starts all three services with interleaved logs:
- Frontend → http://localhost:3003
- Node backend → http://localhost:3002
- FastAPI backend → http://localhost:8001

(You can also run any one service alone: `npm run dev:web`, `npm run dev:node`, `npm run dev:api`.)

### Required environment variables (legal-backend)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key for the LLM fallback stage |
| `JWT_SECRET` | 32+ byte hex string for JWT signing |
| `DATABASE_URL` | PostgreSQL connection string |

(No `REDIS_URL` — Celery/Redis were removed.)

## Demo Flow (12 minutes)

**Before the demo:** Open http://localhost:5173. Press Ctrl+Shift+D to show the demo banner.

**Tab 1 — Notice Extraction (3 min)**
1. Click "Notice Extraction" tab
2. Click "Use Sample I-797"
3. Click "Extract Fields"
4. Walk through the 5 extracted fields and confidence badges
   - Talking point: "What used to take 5 minutes of manual entry, the AI did in 8 seconds."

**Tab 2 — Compliance Document (3 min)**
1. Click "Compliance Document" tab
2. Select "Matter 001 — H-1B Extension · Acme Corp"
3. Click "Generate Document"
4. Walk through the rendered compliance document
5. Click "Download PDF" to show the downloadable output
   - Talking point: "Every field on this PDF came from data that already existed. No reviewer typed anything."

**Tab 3 — Automate Filing (H4 EAD) (3 min)**
1. Click "Automate Filing (H4 EAD)" tab
2. Click "Use Sample Passport"
3. Click "Run Validation"
4. Walk through the comparison table — point out the 3 red mismatch rows
   - Talking point: "Three mismatches — the human reviewer would have caught one, maybe two. The AI caught all three."

**Close (1 min)**
- "The pilot adds breadth, integrations, and production stability. Today you saw the core."

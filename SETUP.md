# Local Development Setup

## Prerequisites

- **Node.js** 16+ and npm
- **Python** 3.11+ (with pip)
- **PostgreSQL** 14+ running locally

## One-time Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/<org>/ai-document-automation.git
cd ai-document-automation/AI-Document
npm run install:all
```

This installs:
- Frontend (`frontend/`) and Node backend (`backend/`) npm packages
- FastAPI backend (`legal-backend/`) Python packages

### 2. Set up environment variables

#### Node backend (`backend/.env`)
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your secrets:
#   ANTHROPIC_API_KEY=sk-ant-...
#   GOOGLE_GEMINI_API_KEY=...
```

#### FastAPI backend (`legal-backend/.env`)
```bash
cp legal-backend/.env.example legal-backend/.env
# Edit legal-backend/.env with your secrets:
#   ANTHROPIC_API_KEY=sk-ant-...
#   JWT_SECRET=<32+ byte hex string>
#   DATABASE_URL=postgresql://uscis:uscis_dev_pass@localhost:5432/legal_processing
#   PORT=8001
```

### 3. Initialize the PostgreSQL database

The FastAPI backend needs a running PostgreSQL database. You have two options:

**Option A: Docker (recommended)**
```bash
cd legal-backend
docker compose up -d postgres    # starts only the Postgres service
python setup_db.py               # create database and run migrations
cd ..
```

**Option B: Existing local Postgres**
```bash
cd legal-backend
python setup_db.py               # assumes DATABASE_URL env var is set
cd ..
```

Verify: `psql -U uscis -d legal_processing -c "SELECT 1"` should connect without error.

## Running Everything

### Single command (all three services)

```bash
npm run dev
```

This starts:
- **Frontend** (React + Vite) on http://localhost:3003
- **Node backend** (Express) on http://localhost:3002  
- **FastAPI backend** (Notice Processing) on http://localhost:8001

All logs are interleaved with colored labels: `[web]`, `[node]`, `[api]`.

### Individual services (if you need to debug one)

```bash
npm run dev:web    # Vite only
npm run dev:node   # Node backend only
npm run dev:api    # FastAPI backend only
```

## Architecture

| Service | Tech | Port | Purpose |
|---------|------|------|---------|
| `frontend/` | React + Vite | 3003 | UI; proxies `/api` → Node, `/legal` → FastAPI |
| `backend/` | Node + Express | 3002 | Cases, compliance docs, cross-validation |
| `legal-backend/` | FastAPI + PostgreSQL | 8001 | USCIS Notice Processing (4-stage extraction) |

### Data Flow: Notice Upload

1. User uploads PDF in React UI
2. Frontend POSTs to `/legal/upload` (proxied by Vite to :8001)
3. FastAPI extracts:
   - **Stage 1**: Identify notice type (classifier)
   - **Stage 2**: Extract global receipt fields (OCR/LLM fallback)
   - **Stage 3**: Extract form-specific fields
   - **Stage 4**: Match exceptions
4. Results saved to PostgreSQL
5. Case appears in review queue

**Note:** The extraction pipeline runs **synchronously** inside the HTTP request (no background queue). Large PDFs may take 30–300 seconds.

## Troubleshooting

### "Port already in use"
Kill the old process:
```bash
# Windows
netstat -ano | findstr ":3003"     # find PID
taskkill /PID <pid> /F

# macOS/Linux
lsof -i :3003 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### "PostgreSQL connection refused"
```bash
# Check Postgres is running
psql -c "SELECT version();"

# Or start Docker Postgres
cd legal-backend && docker compose up -d postgres
```

### "celery" or "redis" import errors
You may have an old installation. Clean and reinstall:
```bash
cd legal-backend
rm -rf venv .venv
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

### FastAPI crashes on Windows
Ensure `legal-backend/.env` is in place and `PORT=8001` is set (default).

### Upload returns "unknown" form type
The classifier returned low confidence. Try a well-scanned PDF. Check
`legal-backend/intelligence/classifier.py` for the scoring logic.

## Testing the Integration

### Via CLI
```bash
# Upload a test PDF
curl -X POST -F "file=@legal-backend/tests/sample_forms/filled/n400_filled.pdf" \
  http://localhost:3003/legal/upload

# Fetch pending cases
curl http://localhost:3003/legal/queue

# Confirm a case (replace <case-id>)
curl -X POST http://localhost:3003/legal/queue/<case-id>/assign
curl -X POST -H "Content-Type: application/json" \
  -d '{"fields":[{"field_name":"receipt_number","confirmed_value":"IOE12345678"}]}' \
  http://localhost:3003/legal/queue/<case-id>/confirm
```

### Via Browser
1. Open http://localhost:3003
2. Navigate to "Notice Processing" tab
3. Click "Use Sample PDF" or upload your own
4. Review extracted fields, edit if needed, click Save

## Production Considerations

- **Synchronous uploads:** Consider adding a job queue (Celery/RQ) for very large PDFs (100+ MB)
- **Secrets:** Never commit `.env` files; use a secrets manager (Vault, AWS Secrets, etc.)
- **Database:** Use a managed PostgreSQL (AWS RDS, Google Cloud SQL, Heroku) in production
- **API keys:** Rotate ANTHROPIC_API_KEY and JWT_SECRET regularly

## Support

For issues or questions, check the README at the repo root or contact the team.

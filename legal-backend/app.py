"""
FastAPI application — USCIS form processing pipeline.

POST /upload              — save PDF, run the extraction pipeline synchronously,
                            persist results, and return the completed case
GET  /cases/{id}/status   — poll processing progress
GET  /                    — full review queue UI
"""

from __future__ import annotations

import uuid
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse

# Uploads directory — persisted across requests
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

app = FastAPI(title="USCIS Form Processor")

# Routers — imported lazily so missing env vars don't break the demo UI
try:
    from auth.routes import router as auth_router
    from api.review_routes import router as review_router
    app.include_router(auth_router)
    app.include_router(review_router)
except Exception as _router_exc:
    import warnings
    warnings.warn(f"Could not load API routers: {_router_exc}", stacklevel=1)


# ---------------------------------------------------------------------------
# Model pre-warm
#
# The extraction pipeline lazy-loads two heavy models on first use: the
# NuExtract transformer (intelligence/nuextract.py) and the EasyOCR reader
# (intelligence/easyocr_text.py). On a cold process that first upload can hang
# for 1–3 minutes while weights download/load. We warm both at startup in a
# daemon thread so the server stays responsive and the first real upload only
# pays for inference, not model loading.
# ---------------------------------------------------------------------------

def _warm_models() -> None:
    import time
    t0 = time.time()
    print("[WARMUP] pre-loading extraction models…", flush=True)

    # AWS Textract — no model to pre-warm (API-based)

    print(f"[WARMUP] models ready ({time.time() - t0:.0f}s)", flush=True)


@app.on_event("startup")
def _on_startup() -> None:
    import threading
    threading.Thread(target=_warm_models, daemon=True).start()


# ---------------------------------------------------------------------------
# POST /upload
# ---------------------------------------------------------------------------

_FORM_MAP: list[tuple[str, str]] = [
    ('I485SUPPJ', 'I-485_SUPP_J'), ('I290B', 'I-290B'), ('I129F', 'I-129F'),
    ('I485', 'I-485'), ('I797', 'I-797'), ('N400', 'N-400'),
    ('I129', 'I-129'), ('I130', 'I-130'), ('I131', 'I-131'),
    ('I140', 'I-140'), ('I539', 'I-539'), ('I751', 'I-751'),
    ('I765', 'I-765'), ('I824', 'I-824'), ('I90', 'I-90'),
    ('N600', 'N-600'),
]


def _match_form_keys(text: str) -> str | None:
    """Return the first matching form ID from a normalised uppercase string."""
    norm = text.upper().replace('-', '').replace('_', '').replace(' ', '')
    for key, fid in _FORM_MAP:
        if key in norm:
            return fid
    return None


def _detect_form_type(filename: str, pdf_path: str | None = None) -> str | None:
    """
    Infer USCIS form type using three sources in priority order:
      1. Filename
      2. PDF document metadata (Title / Subject)
      3. AcroForm field names and first-page text content
    Falls back to None if no match found (classifier will handle it).
    """
    # 1 — filename
    result = _match_form_keys(filename)
    if result:
        return result

    if not pdf_path:
        return None

    # 2 — PDF metadata
    try:
        import pypdf
        reader = pypdf.PdfReader(pdf_path, strict=False)
        meta = reader.metadata or {}
        meta_text = ' '.join(str(v) for v in meta.values() if v)
        result = _match_form_keys(meta_text)
        if result:
            return result
        # Also check AcroForm field names (contain form number for most USCIS PDFs)
        acro_keys = ''
        try:
            fields = reader.get_fields() or {}
            acro_keys = ' '.join(fields.keys())
        except Exception:
            pass
        result = _match_form_keys(acro_keys)
        if result:
            return result
    except Exception:
        pass

    # 3 — First two pages of text (pdfplumber, no OCR required)
    try:
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            pages = pdf.pages[:2]
            text = ' '.join((p.extract_text() or '') for p in pages)
        result = _match_form_keys(text)
        if result:
            return result
    except Exception:
        pass

    return None


def _pipeline_background(
    case_id_str: str,
    pdf_path_str: str,
    form_type_override: str | None,
    api_key: str | None,
) -> None:
    """
    Run the extraction pipeline in a background thread.
    _persist in router.py updates the pre-created case row (UPDATE, not INSERT).
    """
    from intelligence.router import run as run_pipeline

    try:
        run_pipeline(
            pdf_path_str,
            api_key=api_key,
            form_type_override=form_type_override,
            preset_case_id=case_id_str,
        )
        print(f'[UPLOAD] Pipeline complete for {case_id_str[:8]}')
    except Exception as exc:
        print(f'[UPLOAD] Pipeline failed for {case_id_str}: {exc}')
        try:
            from database.connection import SessionLocal
            from database import crud
            _db = SessionLocal()
            _case = crud.get_case(_db, uuid.UUID(case_id_str))
            if _case:
                _case.status = 'failed'
                _db.commit()
            _db.close()
        except Exception:
            pass


@app.post("/upload", status_code=200)
async def upload(
    file: UploadFile = File(...),
    background_tasks=None,
) -> JSONResponse:
    """
    Accept a PDF upload, immediately create a 'processing' case in the DB,
    fire the extraction pipeline as a background task, and return the case_id
    right away — no more network timeouts on large or scanned PDFs.
    """
    import os
    from fastapi import BackgroundTasks  # import here to keep top-level clean

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF.")

    case_id  = uuid.uuid4()
    pdf_path = UPLOADS_DIR / f"{case_id}.pdf"
    contents = await file.read()
    pdf_path.write_bytes(contents)

    # Detect form type from filename / PDF content (fast — no OCR)
    form_type_override = _detect_form_type(file.filename, str(pdf_path))

    # Create a placeholder case immediately so the queue shows it straight away
    try:
        from database.connection import SessionLocal
        from database import crud
        _db = SessionLocal()
        try:
            crud.create_case(
                _db,
                form_type=form_type_override or 'processing',
                pdf_path=str(pdf_path),
                case_id=case_id,
                status='processing',
            )
            _db.commit()
            print(f'[UPLOAD] Pre-created case {str(case_id)[:8]} (form={form_type_override or "processing"})', flush=True)
        except Exception as _ce:
            _db.rollback()
            import traceback
            print(f'[UPLOAD] create_case FAILED for {str(case_id)[:8]}: {_ce}', flush=True)
            traceback.print_exc()
        finally:
            _db.close()
    except Exception as _e:
        print(f'[UPLOAD] Could not pre-create case: {_e}', flush=True)

    # Schedule the heavy pipeline work in the background
    import threading
    _t = threading.Thread(
        target=_pipeline_background,
        args=(str(case_id), str(pdf_path), form_type_override,
              os.environ.get("ANTHROPIC_API_KEY")),
        daemon=True,
    )
    _t.start()

    # Return immediately — frontend polls /cases/{id}/status
    return JSONResponse(content={
        "case_id": str(case_id),
        "form_type": form_type_override or "processing",
        "status": "processing",
        "priority": "normal",
        "escalation_flags": [],
        "fields_extracted": 0,
        "exceptions_triggered": 0,
        "stage1": {}, "stage2": {}, "stage3": {}, "stage4": {},
    })


# ---------------------------------------------------------------------------
# GET /cases/{case_id}/status
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Settings — operator-tunable platform config (confidence threshold, …)
# Read live by the pipeline + review queue so changes apply everywhere.
# ---------------------------------------------------------------------------

@app.get("/settings")
async def get_settings_endpoint() -> JSONResponse:
    from settings_store import get_settings
    s = get_settings()
    # also surface the threshold as whole-percent for the UI slider
    s = dict(s)
    s["confidence_threshold_pct"] = round(s.get("confidence_threshold", 0.7) * 100)
    return JSONResponse(content=s)


@app.post("/settings")
async def update_settings_endpoint(request: Request) -> JSONResponse:
    from settings_store import update_settings
    try:
        body = await request.json()
    except Exception:
        body = {}
    # accept either {confidence_threshold: 0.85} or {confidence_threshold_pct: 85}
    patch: dict = {}
    if "confidence_threshold" in body:
        patch["confidence_threshold"] = body["confidence_threshold"]
    elif "confidence_threshold_pct" in body:
        patch["confidence_threshold"] = body["confidence_threshold_pct"]
    updated = update_settings(patch)
    updated = dict(updated)
    updated["confidence_threshold_pct"] = round(updated.get("confidence_threshold", 0.7) * 100)
    return JSONResponse(content=updated)


@app.get("/cases/{case_id}/status")
async def case_status(case_id: str) -> JSONResponse:
    """
    Return the current processing status and basic metadata for a case.

    Statuses
    --------
    pending     — extraction done, awaiting caseworker review
    in_review   — assigned to a caseworker
    approved    — caseworker confirmed fields
    rejected    — caseworker rejected the case
    failed      — pipeline error (see audit log for details)
    """
    try:
        cid = uuid.UUID(case_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid case_id format")

    try:
        from database.connection import SessionLocal
        from database import crud

        db = SessionLocal()
        try:
            case = crud.get_case(db, cid)
        finally:
            db.close()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}")

    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    payload: dict = {
        "case_id":     str(case.id),
        "status":      case.status,
        "form_type":   case.form_type,
        "uploaded_at": case.uploaded_at.isoformat() if case.uploaded_at else None,
    }

    if case.status == "processing":
        payload["message"] = "Extraction pipeline is running. Check back in a few seconds."
    elif case.status == "failed":
        payload["message"] = "Pipeline failed. See audit log for details."
    else:
        payload["message"] = "Processing complete."
        payload["reviewed_at"]  = case.reviewed_at.isoformat() if case.reviewed_at else None
        payload["caseworker_id"] = str(case.caseworker_id) if case.caseworker_id else None

    return JSONResponse(content=payload)


# ---------------------------------------------------------------------------
# GET / — Review queue UI
# ---------------------------------------------------------------------------

_HTML = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>USCIS Review Queue</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<style>
/* ---- Reset ---- */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  background: #f0f2f7;
  color: #1a1a2e;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ---- App shell ---- */
#app {
  display: flex;
  flex: 1;
  overflow: hidden;
  flex-direction: row;
}

/* ---- Sidebar ---- */
#sidebar {
  width: 260px;
  min-width: 260px;
  background: #1a1a2e;
  color: #c8cfe0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sidebar-header {
  padding: 22px 20px 16px;
  border-bottom: 1px solid #252d44;
  flex-shrink: 0;
}
.sidebar-header h1 { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .03em; }
.sidebar-header p  { font-size: 10px; color: #4a5570; margin-top: 2px; }


.sidebar-filters {
  padding: 12px 14px 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex-shrink: 0;
}
.filter-btn {
  background: #20283c;
  border: 1px solid #2e3a56;
  border-radius: 4px;
  color: #6b7a99;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .04em;
  text-transform: uppercase;
  padding: 4px 8px;
  cursor: pointer;
  transition: all .15s;
}
.filter-btn.active { background: #5b8dee; border-color: #5b8dee; color: #fff; }
.filter-btn:hover:not(.active) { background: #252d44; color: #aab; }

#sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0 12px;
}
.sidebar-item {
  padding: 10px 20px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background .1s, border-color .1s;
}
.sidebar-item:hover { background: #1e2640; }
.sidebar-item.active { background: #1e2640; border-left-color: #5b8dee; }
.si-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 3px;
}
.si-form { font-size: 12px; font-weight: 600; color: #d0d8ee; }
.si-date { font-size: 10px; color: #4a5570; }
.si-bottom { display: flex; align-items: center; gap: 6px; }
.pill {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 10px;
}
.pill-pending   { background: #252d44; color: #8899bb; }
.pill-in_review { background: #2a3820; color: #7ecb6a; }
.pill-approved  { background: #1e4a30; color: #5de89a; }
.pill-rejected  { background: #4a1e1e; color: #f08080; }
.pill-high      { background: #4a2000; color: #f0a030; }
.pill-normal    { background: #1e2640; color: #5a6880; }
.si-conf { font-size: 10px; color: #4a5570; margin-left: auto; }

.sidebar-empty {
  padding: 24px 20px;
  color: #3a4560;
  font-size: 11px;
  text-align: center;
}

.upload-area {
  padding: 10px 14px;
  border-bottom: 1px solid #252d44;
  flex-shrink: 0;
}
.upload-btn {
  width: 100%;
  background: #5b8dee;
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition: background .15s;
}
.upload-btn:hover { background: #4a7be0; }
.upload-btn:disabled { opacity: .5; cursor: not-allowed; }
#upload-status {
  margin-top: 6px;
  font-size: 10px;
  color: #5a7090;
  min-height: 14px;
}

.sidebar-footer {
  padding: 10px 20px;
  border-top: 1px solid #252d44;
  font-size: 10px;
  color: #3a4560;
  flex-shrink: 0;
}

/* ---- Main area ---- */
#main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f0f2f7;
}

/* ---- Queue dashboard ---- */
#view-queue {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}
.view-topbar {
  background: #fff;
  border-bottom: 1px solid #e2e6ef;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}
.view-topbar h2 { font-size: 15px; font-weight: 700; }
.topbar-meta { font-size: 11px; color: #8899aa; margin-left: 4px; }
.refresh-btn {
  margin-left: auto;
  background: none;
  border: 1px solid #d0d8e8;
  border-radius: 5px;
  padding: 5px 10px;
  font-size: 11px;
  color: #5a6880;
  cursor: pointer;
}
.refresh-btn:hover { background: #f0f2f7; }

#queue-table-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}
.queue-table {
  width: 100%;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e2e6ef;
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
}
.queue-table thead th {
  padding: 9px 14px;
  text-align: left;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #8899aa;
  background: #fafbfd;
  border-bottom: 1px solid #e2e6ef;
}
.queue-table tbody tr {
  border-bottom: 1px solid #f0f2f8;
  cursor: pointer;
  transition: background .1s;
}
.queue-table tbody tr:last-child { border-bottom: none; }
.queue-table tbody tr:hover { background: #f5f7fc; }
.queue-table td { padding: 11px 14px; vertical-align: middle; }
.qt-form { font-weight: 600; font-size: 13px; }
.qt-date { font-size: 11px; color: #8899aa; }
.qt-conf { font-size: 11px; }
.qt-conf .hi { color: #22a05a; }
.qt-conf .lo { color: #e05555; }
.qt-flags { font-size: 11px; }
.qt-flags .none { color: #bbc4d4; }
.qt-flags .some { color: #f0a030; font-weight: 600; }
.qt-action button {
  background: #5b8dee;
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 5px 12px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.qt-action button:hover { background: #4a7be0; }
.queue-empty {
  text-align: center;
  padding: 60px 0;
  color: #bbc4d4;
  font-size: 13px;
}

/* ---- Case review ---- */
#view-case {
  display: none;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}
.case-topbar {
  background: #fff;
  border-bottom: 1px solid #e2e6ef;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.back-btn {
  background: none;
  border: 1px solid #d0d8e8;
  border-radius: 5px;
  padding: 5px 10px;
  font-size: 11px;
  color: #5a6880;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.back-btn:hover { background: #f0f2f7; }
.case-title { font-size: 14px; font-weight: 700; }
.case-meta  { font-size: 11px; color: #8899aa; }
#assign-btn {
  margin-left: auto;
  background: #e8f4ff;
  color: #1a5c9a;
  border: 1px solid #b8d8f8;
  border-radius: 5px;
  padding: 5px 12px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
#assign-btn:hover { background: #d0e8ff; }
#assign-btn:disabled { opacity: .4; cursor: default; }

.case-panels {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* PDF panel */
#pdf-panel {
  width: 50%;
  background: #2a2a2a;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid #1a1a1a;
}
.pdf-toolbar {
  background: #1e1e1e;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.pdf-toolbar button {
  background: #3a3a3a;
  border: 1px solid #4a4a4a;
  color: #ccc;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
}
.pdf-toolbar button:disabled { opacity: .35; cursor: default; }
.pdf-toolbar button:not(:disabled):hover { background: #4a4a4a; }
#pdf-page-info { font-size: 11px; color: #888; }
#pdf-canvas-wrap {
  flex: 1;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  padding: 16px;
}
#pdf-canvas { max-width: 100%; box-shadow: 0 2px 20px rgba(0,0,0,.5); }
#pdf-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 12px;
}

/* Fields panel */
#fields-panel {
  width: 50%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f0f2f7;
}
.fields-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Escalation banners */
.flag-banner {
  background: #fdeaea;
  border: 1px solid #f5c6c6;
  border-radius: 6px;
  padding: 8px 12px;
  color: #8b0000;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.flag-banner::before {
  content: "!";
  background: #e05555;
  color: #fff;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  flex-shrink: 0;
}

/* Field cards */
.field-card {
  background: #fff;
  border: 1px solid #e2e6ef;
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.field-card.corrected { border-left: 3px solid #f0a030; }
.fc-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fc-label {
  font-size: 11px;
  font-weight: 600;
  color: #5a6880;
  flex: 1;
}
.conf-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.conf-hi  { background: #e6f7ee; color: #1a7a45; }
.conf-mid { background: #fff3e0; color: #9a5000; }
.conf-lo  { background: #fdeaea; color: #9a0000; }
.src-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.src-native { background: #e8f4ff; color: #1a5c9a; }
.src-llm    { background: #f0e8ff; color: #6020a0; }
.src-human  { background: #fff3e0; color: #a05010; }
.fc-orig {
  font-size: 11px;
  color: #8899aa;
  font-style: italic;
}
.fc-orig span { color: #5a6880; font-style: normal; }
.fc-input {
  width: 100%;
  border: 1px solid #d0d8e8;
  border-radius: 5px;
  padding: 7px 9px;
  font-size: 12px;
  outline: none;
  background: #fafbfd;
  transition: border-color .15s;
}
.fc-input:focus { border-color: #5b8dee; background: #fff; }
.fc-input.changed { border-color: #f0a030; background: #fffbf0; }
.fc-corrected-label {
  font-size: 10px;
  color: #f0a030;
  font-weight: 600;
  display: none;
}
.field-card.corrected .fc-corrected-label { display: block; }

/* ---- Receipt grid layout (10-field notice panel) ---- */
.rc-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
  align-items: start;
}
.rc-row-1 { grid-template-columns: 1fr; }
.rc-cell { min-width: 0; }
.rc-cell.field-card { gap: 6px; }
/* spec: label dark blue + bold */
.rc-cell .fc-label { color: #204496; font-weight: 700; font-size: 11.5px; }
.rc-cell .req { color: #e14a28; }
.fc-badges { display: flex; align-items: center; gap: 6px; }
.fc-low {
  font-size: 10.5px;
  color: #e14a28;
  font-weight: 600;
  margin-top: 2px;
}
.rc-cell textarea.fc-input { resize: vertical; min-height: 64px; font-family: inherit; }
.rc-cell select.fc-input { cursor: pointer; background: #fafbfd; }
.btn-cancel {
  background: #fff;
  color: #5a6880;
  border: 1px solid #d0d8e8;
  border-radius: 6px;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.btn-cancel:hover { background: #f4f6fa; }
.btn-confirm { flex: 0 0 auto; padding: 10px 24px; }

/* Exception table */
.exc-section {
  padding: 12px 16px 4px;
  border-top: 2px solid #e2e6ef;
  flex-shrink: 0;
  background: #fff;
}
.exc-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.exc-header h4 { font-size: 12px; font-weight: 700; color: #1a1a2e; }
.exc-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  letter-spacing: .04em;
}
.exc-badge-0   { background: #e6f7ee; color: #1a7a45; }
.exc-badge-low { background: #fff3e0; color: #9a5000; }
.exc-badge-hi  { background: #fdeaea; color: #9a0000; }
.exc-table-wrap { max-height: 220px; overflow-y: auto; margin-bottom: 4px; }
.exc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.exc-table thead th {
  text-align: left;
  padding: 5px 8px;
  background: #f5f7fc;
  border-bottom: 1px solid #e2e6ef;
  font-size: 10px;
  font-weight: 700;
  color: #8899aa;
  text-transform: uppercase;
  letter-spacing: .05em;
  position: sticky; top: 0;
}
.exc-table tbody tr { border-bottom: 1px solid #f0f2f8; cursor: pointer; }
.exc-table tbody tr:last-child { border-bottom: none; }
.exc-table tbody tr:hover { background: #f5f7fc; }
.exc-table td { padding: 7px 8px; vertical-align: top; }
.exc-seq { font-weight: 700; color: #5a6880; width: 28px; }
.exc-cat-badge {
  display: inline-block;
  font-size: 9px; font-weight: 700; padding: 2px 5px; border-radius: 3px;
  text-transform: uppercase; letter-spacing: .03em; white-space: nowrap;
}
.cat-structural    { background: #fdeaea; color: #9a0000; }
.cat-field         { background: #e8f4ff; color: #1a5c9a; }
.cat-numeric       { background: #fff3e0; color: #9a5000; }
.cat-identity      { background: #f0e8ff; color: #6020a0; }
.cat-contextual    { background: #e6f7ee; color: #1a7a45; }
.cat-formatting    { background: #f5f7fc; color: #5a6880; }
.cat-cross         { background: #ffeaea; color: #8b0000; }
.cat-llm           { background: #e8f0ff; color: #1a3c9a; }
.cat-default       { background: #f0f2f7; color: #5a6880; }
.exc-title { font-weight: 600; color: #1a1a2e; }
.exc-triggered { color: #8899aa; font-size: 10px; }
.exc-detail {
  display: none; background: #f8f9fd; padding: 8px 12px;
  font-size: 11px; color: #5a6880; border-top: 1px dashed #e2e6ef;
}
.exc-detail.open { display: table-row; }
.exc-detail td { padding: 8px 12px; }

/* Fields action bar */
.fields-actions {
  padding: 12px 16px;
  border-top: 1px solid #e2e6ef;
  background: #fff;
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}
.btn-confirm {
  flex: 1;
  background: #1a7a45;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.btn-confirm:hover { background: #166038; }
.btn-confirm:disabled { opacity: .4; cursor: default; }
.btn-reject {
  background: #fff;
  color: #e05555;
  border: 1px solid #e05555;
  border-radius: 6px;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.btn-reject:hover { background: #fdeaea; }

/* ---- Modal ---- */
#modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.45);
  z-index: 100;
  align-items: center;
  justify-content: center;
}
#modal-overlay.open { display: flex; }
.modal {
  background: #fff;
  border-radius: 10px;
  padding: 28px 32px;
  width: 420px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.modal h3 { font-size: 15px; font-weight: 700; }
.modal p  { font-size: 12px; color: #8899aa; }
#reject-reason {
  width: 100%;
  border: 1px solid #d0d8e8;
  border-radius: 6px;
  padding: 9px 12px;
  font-size: 13px;
  resize: vertical;
  min-height: 80px;
  outline: none;
}
#reject-reason:focus { border-color: #e05555; }
.modal-btns { display: flex; gap: 10px; justify-content: flex-end; }
.btn-cancel {
  background: #f0f2f7;
  border: none;
  border-radius: 5px;
  padding: 8px 16px;
  font-size: 12px;
  cursor: pointer;
}
.btn-cancel:hover { background: #e2e6ef; }
.btn-danger {
  background: #e05555;
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.btn-danger:hover { background: #c44; }

/* ---- Toast ---- */
#toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #1a1a2e;
  color: #fff;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 4px 20px rgba(0,0,0,.2);
  transform: translateY(80px);
  opacity: 0;
  transition: transform .2s, opacity .2s;
  z-index: 200;
}
#toast.show { transform: translateY(0); opacity: 1; }
#toast.success { background: #1a7a45; }
#toast.error   { background: #a00; }

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #c8d0e0; border-radius: 3px; }
#sidebar ::-webkit-scrollbar-thumb { background: #2e3a56; }
</style>
</head>
<body>

<!-- ======================================================== APP ========= -->
<div id="app">

  <!-- Sidebar -->
  <aside id="sidebar">
    <div class="sidebar-header">
      <h1>Review Queue</h1>
      <p>USCIS Form Processing</p>
    </div>
    <div class="upload-area">
      <input type="file" id="upload-input" accept=".pdf" style="display:none" onchange="doUpload(this)">
      <button class="upload-btn" id="upload-btn" onclick="document.getElementById('upload-input').click()">+ Upload PDF</button>
      <div id="upload-status"></div>
    </div>
    <div class="sidebar-filters">
      <button class="filter-btn active" data-filter="all" onclick="setFilter(this)">All</button>
      <button class="filter-btn" data-filter="pending" onclick="setFilter(this)">Pending</button>
      <button class="filter-btn" data-filter="in_review" onclick="setFilter(this)">In Review</button>
      <button class="filter-btn" data-filter="high" onclick="setFilter(this)">High Priority</button>
    </div>
    <div id="sidebar-list"><div class="sidebar-empty">Loading…</div></div>
    <div class="sidebar-footer" id="sidebar-footer">Auto-refresh in <span id="refresh-countdown">30</span>s</div>
  </aside>

  <!-- Main -->
  <main id="main">

    <!-- Queue dashboard -->
    <div id="view-queue">
      <div class="view-topbar">
        <h2>Cases</h2>
        <span class="topbar-meta" id="queue-count"></span>
        <button class="refresh-btn" onclick="loadQueue()">Refresh</button>
      </div>
      <div id="queue-table-wrap">
        <table class="queue-table">
          <thead>
            <tr>
              <th>Form Type</th>
              <th>Uploaded</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Confidence</th>
              <th>Flags</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="queue-tbody"></tbody>
        </table>
      </div>
    </div>

    <!-- Case review -->
    <div id="view-case">
      <div class="case-topbar">
        <button class="back-btn" onclick="showQueue()">&#8592; Queue</button>
        <span class="case-title" id="case-title">—</span>
        <span class="case-meta" id="case-meta"></span>
        <button id="assign-btn" onclick="assignCase()">Assign to Me</button>
      </div>
      <div class="case-panels">
        <!-- PDF viewer -->
        <div id="pdf-panel">
          <div class="pdf-toolbar">
            <button id="pdf-prev" onclick="pdfPrev()" disabled>&#8592;</button>
            <span id="pdf-page-info">— / —</span>
            <button id="pdf-next" onclick="pdfNext()" disabled>&#8594;</button>
          </div>
          <div id="pdf-canvas-wrap">
            <div id="pdf-loading">Loading PDF…</div>
            <canvas id="pdf-canvas" style="display:none"></canvas>
          </div>
        </div>

        <!-- Fields panel -->
        <div id="fields-panel">
          <div class="fields-scroll" id="fields-scroll"></div>

          <!-- Exception table -->
          <div class="exc-section" id="exc-section" style="display:none">
            <div class="exc-header">
              <h4>Exceptions</h4>
              <span class="exc-badge exc-badge-0" id="exc-badge">0 triggered</span>
            </div>
            <div class="exc-table-wrap">
              <table class="exc-table">
                <thead>
                  <tr>
                    <th>#</th><th>Category</th><th>Exception</th><th>Triggered by</th>
                  </tr>
                </thead>
                <tbody id="exc-tbody"></tbody>
              </table>
            </div>
          </div>

          <div class="fields-actions">
            <button class="btn-reject" onclick="openRejectModal()">Reject Case</button>
            <span style="flex:1"></span>
            <button class="btn-cancel" onclick="cancelEdits()">Cancel</button>
            <button class="btn-confirm" id="confirm-btn" onclick="confirmCase()">Save</button>
          </div>
        </div>
      </div>
    </div>

  </main>
</div>

<!-- Reject modal -->
<div id="modal-overlay">
  <div class="modal">
    <h3>Reject Case</h3>
    <p>Provide a reason for rejection. This will be recorded in the audit log.</p>
    <textarea id="reject-reason" placeholder="Reason for rejection…"></textarea>
    <div class="modal-btns">
      <button class="btn-cancel" onclick="closeRejectModal()">Cancel</button>
      <button class="btn-danger" onclick="submitReject()">Confirm Rejection</button>
    </div>
  </div>
</div>

<!-- Toast -->
<div id="toast"></div>

<script>
// ============================================================ State
const STATE = {
  cases: [],
  filter: 'all',
  activeCaseId: null,
  caseDetail: null,
  pdfDoc: null,
  pdfPage: 1,
  pdfLoadingTask: null,   // tracks in-flight PDF load so we can cancel on case switch
  countdownTimer: null,
  countdown: 30,
};

// PDF.js worker — point at the matching CDN worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ============================================================ Navigation
function showApp() {
  loadQueue();
  startRefresh();
}

function showQueue() {
  document.getElementById('view-queue').style.display = 'flex';
  document.getElementById('view-case').style.display  = 'none';
  STATE.activeCaseId = null;
  renderSidebar();
}

function showCase(caseId) {
  STATE.activeCaseId = caseId;
  document.getElementById('view-queue').style.display = 'none';
  document.getElementById('view-case').style.display  = 'flex';
  loadCaseDetail(caseId);
  renderSidebar();
}

// ============================================================ Queue loading
async function apiGet(path) {
  const resp = await fetch(path);
  if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error(d.detail || resp.statusText); }
  return resp.json();
}

async function apiPost(path, body) {
  const resp = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error(d.detail || resp.statusText); }
  return resp.json();
}

async function loadQueue() {
  try {
    const data = await apiGet('/queue?limit=200');
    STATE.cases = data.cases || [];
    renderSidebar();
    renderQueueTable();
    resetCountdown();
  } catch (e) {
    if (e.message !== 'Session expired') showToast(e.message, 'error');
  }
}

function filteredCases() {
  const f = STATE.filter;
  if (f === 'all')      return STATE.cases;
  if (f === 'high')     return STATE.cases.filter(c => c.priority === 'high');
  return STATE.cases.filter(c => c.status === f);
}

function setFilter(btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  STATE.filter = btn.dataset.filter;
  renderSidebar();
  renderQueueTable();
}

// ============================================================ Sidebar
function renderSidebar() {
  const list = document.getElementById('sidebar-list');
  const cases = filteredCases();
  if (!cases.length) {
    list.innerHTML = '<div class="sidebar-empty">No cases</div>';
    return;
  }
  list.innerHTML = cases.map(c => {
    const active = c.case_id === STATE.activeCaseId ? ' active' : '';
    const date   = fmtDate(c.uploaded_at);
    const hi = c.field_count - c.low_confidence_count;
    return `<div class="sidebar-item${active}" onclick="showCase('${c.case_id}')">
      <div class="si-top">
        <span class="si-form">${c.form_type}</span>
        <span class="si-date">${date}</span>
      </div>
      <div class="si-bottom">
        <span class="pill pill-${c.status}">${fmtStatus(c.status)}</span>
        <span class="pill pill-${c.priority}">${c.priority}</span>
        <span class="si-conf">${hi}/${c.field_count} high conf</span>
      </div>
    </div>`;
  }).join('');
}

// ============================================================ Queue table
function renderQueueTable() {
  const cases = filteredCases();
  const tbody = document.getElementById('queue-tbody');
  document.getElementById('queue-count').textContent =
    cases.length + ' case' + (cases.length !== 1 ? 's' : '');

  if (!cases.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="queue-empty">No cases in queue</td></tr>';
    return;
  }

  tbody.innerHTML = cases.map(c => {
    const hi = c.field_count - c.low_confidence_count;
    const confHtml = c.field_count
      ? `<span class="hi">${hi}</span> / ${c.field_count} high`
      : '<span style="color:#bbc4d4">—</span>';
    const flagsHtml = c.escalation_flags_count > 0
      ? `<span class="some">${c.escalation_flags_count} flag${c.escalation_flags_count !== 1 ? 's' : ''}</span>`
      : '<span class="none">None</span>';
    return `<tr onclick="showCase('${c.case_id}')">
      <td class="qt-form">${c.form_type}</td>
      <td class="qt-date">${fmtDate(c.uploaded_at)}</td>
      <td><span class="pill pill-${c.status}">${fmtStatus(c.status)}</span></td>
      <td><span class="pill pill-${c.priority}">${c.priority}</span></td>
      <td class="qt-conf">${confHtml}</td>
      <td class="qt-flags">${flagsHtml}</td>
      <td class="qt-action"><button onclick="event.stopPropagation();showCase('${c.case_id}')">Review</button></td>
    </tr>`;
  }).join('');
}

// ============================================================ Case detail
async function loadCaseDetail(caseId) {
  // Cancel any in-flight PDF load from a previous case
  if (STATE.pdfLoadingTask) {
    try { STATE.pdfLoadingTask.destroy(); } catch (_) {}
    STATE.pdfLoadingTask = null;
  }
  STATE.pdfDoc  = null;
  STATE.pdfPage = 1;
  document.getElementById('pdf-loading').style.display = 'flex';
  document.getElementById('pdf-loading').textContent = 'Loading PDF…';
  document.getElementById('pdf-canvas').style.display  = 'none';
  document.getElementById('pdf-prev').disabled = true;
  document.getElementById('pdf-next').disabled = true;
  document.getElementById('pdf-page-info').textContent = '— / —';
  document.getElementById('fields-scroll').innerHTML = '<div style="padding:24px;color:#8899aa;font-size:12px">Loading…</div>';
  document.getElementById('confirm-btn').disabled = true;

  try {
    const detail = await apiGet('/queue/' + caseId);

    // User switched to a different case while this fetch was in flight — discard
    if (STATE.activeCaseId !== caseId) return;

    STATE.caseDetail = detail;

    // Topbar
    document.getElementById('case-title').textContent =
      detail.form_type + ' — ' + caseId.slice(0, 8) + '…';
    document.getElementById('case-meta').textContent =
      fmtStatus(detail.status) + ' · ' + fmtDate(detail.uploaded_at) +
      (detail.priority === 'high' ? ' · HIGH PRIORITY' : '');

    // Assign button
    const assignBtn = document.getElementById('assign-btn');
    if (detail.status === 'pending') {
      assignBtn.disabled = false;
      assignBtn.textContent = 'Assign to Me';
    } else if (detail.status === 'in_review') {
      assignBtn.disabled = true;
      assignBtn.textContent = 'In Review';
    } else {
      assignBtn.disabled = true;
      assignBtn.textContent = fmtStatus(detail.status);
    }

    // Fields panel
    renderFieldCards(detail);
    renderExceptions(detail.exceptions || []);
    document.getElementById('confirm-btn').disabled =
      (detail.status === 'approved' || detail.status === 'rejected');

    // PDF
    loadPdf(caseId);
  } catch (e) {
    document.getElementById('fields-scroll').innerHTML =
      `<div style="padding:24px;color:#e05555;font-size:12px">Error loading case: ${escHtml(e.message)}</div>`;
    showToast(e.message, 'error');
  }
}

// The 10 USCIS notice-receipt fields and their input config (matches the
// React panel and the target screenshots).
const RECEIPT_TYPE_OPTIONS   = ['USCIS Receipt Number','J Visa Application Number','NVC Matter Number','PERM Receipt','Other'];
const RECEIPT_STATUS_OPTIONS = ['Pending','Approved','Denied','RFE','Withdrawn','Shipped'];
const EXPIRATION_OPTIONS     = ['No','Yes'];
const RECEIPT_FIELD_CFG = {
  primary_flag:           { label:'Primary Flag',          type:'text' },
  sent_government_agency: { label:'Sent Government Agency', type:'date' },
  receipt_for:            { label:'Receipt For',           type:'search' },
  receipt_type:           { label:'Receipt Type',          type:'enum', required:true, options:RECEIPT_TYPE_OPTIONS },
  receipt_date:           { label:'Receipt Date',          type:'date' },
  receipt_notice_date:    { label:'Receipt Notice Date',   type:'date' },
  receipt_number:         { label:'Receipt Number',        type:'text' },
  receipt_status:         { label:'Receipt Status',        type:'enum', options:RECEIPT_STATUS_OPTIONS },
  expiration_alert:       { label:'Expiration Alert',      type:'enum', options:EXPIRATION_OPTIONS },
  receipt_notes:          { label:'Receipt Notes',         type:'textarea' },
};
// Grid rows: each entry is [left, right]; null = empty cell; single = full width.
const RECEIPT_ROWS = [
  ['primary_flag'],
  [null, 'sent_government_agency'],
  ['receipt_for', 'receipt_type'],
  ['receipt_date', 'receipt_notice_date'],
  ['receipt_number', 'receipt_status'],
  ['expiration_alert', null],
  ['receipt_notes'],
];

function receiptInputHtml(cfg, name, val) {
  const common = `class="fc-input" oninput="onFieldInput(this)" onchange="onFieldInput(this)" `
    + `data-field="${escAttr(name)}" data-orig="${escAttr(val)}"`;
  if (cfg.type === 'enum') {
    const opts = ['<option value="">— select —</option>']
      .concat(cfg.options.map(o => `<option value="${escAttr(o)}"${o===val?' selected':''}>${escHtml(o)}</option>`))
      .join('');
    return `<select ${common}>${opts}</select>`;
  }
  if (cfg.type === 'textarea') {
    return `<textarea ${common} rows="3">${escHtml(val)}</textarea>`;
  }
  if (cfg.type === 'date') {
    return `<input ${common} type="text" placeholder="MM/DD/YYYY" value="${escAttr(val)}">`;
  }
  if (cfg.type === 'search') {
    return `<input ${common} type="text" list="dl-${escId(name)}" placeholder="Type to search…" value="${escAttr(val)}">`
      + `<datalist id="dl-${escId(name)}">${val?`<option value="${escAttr(val)}">`:''}</datalist>`;
  }
  return `<input ${common} type="text" value="${escAttr(val)}">`;
}

function receiptFieldCell(name, byName) {
  if (!name) return '<div class="rc-cell"></div>';
  const cfg = RECEIPT_FIELD_CFG[name];
  const f   = byName[name] || {};
  const conf = (f.confidence != null) ? f.confidence : null;
  const val  = (f.normalized_value != null ? f.normalized_value : (f.raw_value || '')) || '';
  const hasF = (f.field_name != null);
  let badges = '';
  if (hasF) {
    const pct    = Math.round(conf * 100);
    const confCls = conf >= 0.8 ? 'conf-hi' : conf >= 0.5 ? 'conf-mid' : 'conf-lo';
    const srcCls  = 'src-' + (f.source || 'native');
    badges = `<span class="src-badge ${srcCls}">${escHtml(f.source || 'native')}</span>`
           + `<span class="conf-badge ${confCls}">${pct}%</span>`;
  }
  const low = hasF && conf < 0.8;
  const req = cfg.required ? ' <span class="req">*</span>' : '';
  return `
    <div class="rc-cell field-card" data-field="${escAttr(name)}" data-orig="${escAttr(val)}">
      <div class="fc-top">
        <span class="fc-label">${escHtml(cfg.label)}${req}</span>
        <span class="fc-badges">${badges}</span>
      </div>
      ${receiptInputHtml(cfg, name, val)}
      ${low ? '<div class="fc-low">&#9651; Low confidence — verify against original</div>' : ''}
    </div>`;
}

function renderFieldCards(detail) {
  const scroll = document.getElementById('fields-scroll');
  const frags  = [];

  // Escalation banners first
  (detail.escalation_flags || []).forEach(f => {
    frags.push(`<div class="flag-banner">${escHtml(f)}</div>`);
  });

  const byName = {};
  (detail.extracted_fields || []).forEach(f => { byName[f.field_name] = f; });

  RECEIPT_ROWS.forEach(row => {
    const single = row.length === 1;
    const cells = single
      ? receiptFieldCell(row[0], byName)
      : row.map(n => receiptFieldCell(n, byName)).join('');
    frags.push(`<div class="rc-row${single?' rc-row-1':''}">${cells}</div>`);
  });

  scroll.innerHTML = frags.join('');
}

function onFieldInput(input) {
  const card = input.closest('.field-card');
  const orig = input.dataset.orig;
  const changed = input.value !== orig;
  card.classList.toggle('corrected', changed);
}

// ============================================================ PDF viewer
async function loadPdf(caseId) {
  const loadingEl = document.getElementById('pdf-loading');
  if (typeof pdfjsLib === 'undefined') {
    loadingEl.textContent = 'PDF.js failed to load — check network connection';
    return;
  }
  try {
    const url = '/queue/' + caseId + '/pdf';
    const task = pdfjsLib.getDocument({ url });
    STATE.pdfLoadingTask = task;
    const pdfDoc = await task.promise;
    // If case switched while loading, discard this result
    if (STATE.activeCaseId !== caseId) return;
    STATE.pdfDoc  = pdfDoc;
    STATE.pdfPage = 1;
    STATE.pdfLoadingTask = null;
    loadingEl.style.display = 'none';
    document.getElementById('pdf-canvas').style.display = 'block';
    updatePdfNav();
    renderPdfPage();
  } catch (e) {
    if (e && e.name === 'AbortException') return; // cancelled intentionally
    loadingEl.textContent = 'Could not load PDF: ' + (e.message || e);
  }
}

async function renderPdfPage() {
  if (!STATE.pdfDoc) return;
  const page   = await STATE.pdfDoc.getPage(STATE.pdfPage);
  const scale  = Math.min(1.5, document.getElementById('pdf-canvas-wrap').clientWidth / page.getViewport({ scale: 1 }).width * 0.92);
  const vp     = page.getViewport({ scale });
  const canvas = document.getElementById('pdf-canvas');
  canvas.width  = vp.width;
  canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  updatePdfNav();
}

function updatePdfNav() {
  const n = STATE.pdfDoc ? STATE.pdfDoc.numPages : 0;
  document.getElementById('pdf-page-info').textContent = n ? `${STATE.pdfPage} / ${n}` : '— / —';
  document.getElementById('pdf-prev').disabled = STATE.pdfPage <= 1;
  document.getElementById('pdf-next').disabled = !n || STATE.pdfPage >= n;
}

function pdfPrev() { if (STATE.pdfPage > 1) { STATE.pdfPage--; renderPdfPage(); } }
function pdfNext() {
  if (STATE.pdfDoc && STATE.pdfPage < STATE.pdfDoc.numPages) {
    STATE.pdfPage++;
    renderPdfPage();
  }
}

// ============================================================ Case actions
async function assignCase() {
  const id  = STATE.activeCaseId;
  const btn = document.getElementById('assign-btn');
  btn.disabled = true;
  try {
    await apiPost('/queue/' + id + '/assign', {});
    showToast('Case assigned', 'success');
    loadCaseDetail(id);
    loadQueue();
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
  }
}

async function confirmCase() {
  const id = STATE.activeCaseId;
  const inputs = document.querySelectorAll('#fields-scroll .fc-input');
  const fields = Array.from(inputs).map(inp => ({
    field_name:      inp.dataset.field,
    confirmed_value: inp.value || null,
  }));
  const btn = document.getElementById('confirm-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const result = await apiPost('/queue/' + id + '/confirm', { fields });
    showToast(
      `Confirmed ${result.fields_confirmed} fields` +
      (result.fields_corrected ? ` (${result.fields_corrected} corrected)` : ''),
      'success'
    );
    loadCaseDetail(id);
    loadQueue();
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

function cancelEdits() {
  if (STATE.activeCaseId) loadCaseDetail(STATE.activeCaseId);
}

function openRejectModal()  { document.getElementById('modal-overlay').classList.add('open'); }
function closeRejectModal() { document.getElementById('modal-overlay').classList.remove('open'); }

async function submitReject() {
  const reason = document.getElementById('reject-reason').value.trim();
  if (!reason) { showToast('Enter a rejection reason', 'error'); return; }
  closeRejectModal();
  try {
    await apiPost('/queue/' + STATE.activeCaseId + '/reject', { reason });
    showToast('Case rejected', 'success');
    document.getElementById('reject-reason').value = '';
    loadCaseDetail(STATE.activeCaseId);
    loadQueue();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// Close modal on overlay click
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeRejectModal();
});

// ============================================================ Auto-refresh
function startRefresh() {
  stopRefresh();
  STATE.countdown = 30;
  STATE.countdownTimer = setInterval(() => {
    STATE.countdown--;
    const el = document.getElementById('refresh-countdown');
    if (el) el.textContent = STATE.countdown;
    if (STATE.countdown <= 0) { loadQueue(); STATE.countdown = 30; }
  }, 1000);
}

function stopRefresh() {
  if (STATE.countdownTimer) clearInterval(STATE.countdownTimer);
  STATE.countdownTimer = null;
}

function resetCountdown() {
  STATE.countdown = 30;
  const el = document.getElementById('refresh-countdown');
  if (el) el.textContent = 30;
}

// ============================================================ Toast
let _toastTimer = null;
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + (type || '');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = ''; }, 3500);
}

// ============================================================ Helpers
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escAttr(s) { return escHtml(s || ''); }
function escId(s)   { return s.replace(/[^a-zA-Z0-9_-]/g, '_'); }

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtStatus(s) {
  return { pending: 'Pending', in_review: 'In Review', approved: 'Approved', rejected: 'Rejected' }[s] || s;
}

function humanLabel(key) {
  const MAP = {
    alien_registration_number:   'Alien Registration No.',
    beneficiary_alien_number:    'Beneficiary Alien No.',
    family_name:                 'Family Name',
    given_name:                  'Given Name',
    date_of_birth:               'Date of Birth',
    country_of_birth:            'Country of Birth',
    date_of_entry:               'Date of Entry',
    class_of_admission:          'Class of Admission',
    ssn:                         'Social Security No.',
    date_became_pr:              'Date Became PR',
    marital_status:              'Marital Status',
    petitioner_name:             'Petitioner Name',
    petitioner_ein:              'Petitioner EIN',
    beneficiary_name:            'Beneficiary Name',
    nonimmigrant_classification: 'Nonimmigrant Class.',
    period_of_stay_requested:    'Period of Stay',
    job_title:                   'Job Title',
    wage_rate_of_pay:            'Wage Rate of Pay',
    preference_classification:   'Preference Class.',
    priority_date:               'Priority Date',
    offered_wage:                'Offered Wage',
    receipt_number:              'Receipt No.',
    notice_type:                 'Notice Type',
    applicant_name:              'Applicant Name',
    case_type:                   'Case Type',
    notice_date:                 'Notice Date',
    validity_start:              'Valid From',
    validity_end:                'Valid To',
    action_taken:                'Action Taken',
    basis_for_removal:           'Basis for Removal',
    joint_petitioner_name:       'Joint Petitioner',
    relationship:                'Relationship',
    document_type:               'Document Type',
    travel_countries:            'Travel Countries',
    departure_date:              'Departure Date',
    return_date:                 'Return Date',
    current_status:              'Current Status',
    status_expiry_date:          'Status Expiry',
    eligibility_category:        'EAD Category',
    brief_reason:                'Brief Reason',
    appeal_type:                 'Appeal Type',
    decision_date:               'Decision Date',
    date_met_beneficiary:        'Date Met Beneficiary',
    country_of_citizenship:      'Country of Citizenship',
    parent_name:                 'Parent Name',
    parent_citizenship_date:     'Parent Citizenship Date',
    parent_cert_number:          'Parent Cert. No.',
    basis_for_citizenship:       'Basis for Citizenship',
    job_offer_employer:          'Employer',
    soc_code:                    'SOC Code',
    job_description:             'Job Description',
    action_requested:            'Action Requested',
    original_receipt_number:     'Original Receipt No.',
    reason_code:                 'Reason Code',
    name_change_new:             'New Name',
  };
  return MAP[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// ============================================================ Upload
async function doUpload(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';  // reset so same file can be re-selected

  const btn    = document.getElementById('upload-btn');
  const status = document.getElementById('upload-status');
  btn.disabled = true;
  btn.textContent = 'Processing…';
  status.textContent = 'Uploading ' + file.name + '…';

  const form = new FormData();
  form.append('file', file);

  try {
    const resp = await fetch('/upload', { method: 'POST', body: form });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || resp.statusText);
    status.textContent = data.form_type + ' — ' + data.fields_extracted + ' fields extracted';
    showToast('Uploaded: ' + data.form_type + ' · ' + data.fields_extracted + ' fields', 'success');
    // Refresh queue then open the case immediately
    await loadQueue();
    if (data.case_id) showCase(data.case_id);
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '+ Upload PDF';
  }
}

// ============================================================ Exceptions
const _CAT_CLASS = {
  'Structural': 'cat-structural',
  'Field-Level': 'cat-field',
  'Numeric & Arithmetic': 'cat-numeric',
  'Identity & Entity': 'cat-identity',
  'Contextual / Tax Logic': 'cat-contextual',
  'Formatting & OCR': 'cat-formatting',
  'Cross-Document': 'cat-cross',
  'LLM Interpretation': 'cat-llm',
  'LLM-Specific Domain': 'cat-llm',
};

function catClass(cat) { return _CAT_CLASS[cat] || 'cat-default'; }

function renderExceptions(exceptions) {
  const section = document.getElementById('exc-section');
  const badge   = document.getElementById('exc-badge');
  const tbody   = document.getElementById('exc-tbody');

  if (!exceptions || exceptions.length === 0) {
    section.style.display = 'none';
    badge.textContent = '0 triggered';
    badge.className = 'exc-badge exc-badge-0';
    tbody.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  const n = exceptions.length;
  badge.textContent = n + ' triggered';
  badge.className = 'exc-badge ' + (n === 0 ? 'exc-badge-0' : n <= 3 ? 'exc-badge-low' : 'exc-badge-hi');

  tbody.innerHTML = exceptions.map((e, i) => {
    const rowId = 'exc-detail-' + i;
    return `<tr onclick="toggleExcDetail('${rowId}')">
      <td class="exc-seq">${e.seq}</td>
      <td><span class="exc-cat-badge ${catClass(e.category)}">${escHtml(e.category)}</span></td>
      <td class="exc-title">${escHtml(e.exception_title)}</td>
      <td class="exc-triggered">${escHtml(e.triggered_by || '')}</td>
    </tr>
    <tr class="exc-detail" id="${rowId}">
      <td colspan="4">${escHtml(e.exception_description)}</td>
    </tr>`;
  }).join('');
}

function toggleExcDetail(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

// ============================================================ Boot
(function init() {
  showApp();
})();
</script>
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
async def index() -> HTMLResponse:
    return HTMLResponse(content=_HTML)

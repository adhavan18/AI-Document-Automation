import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import multer from 'multer';
import { callWithFallback } from '../lib/ai-with-fallback.js';
import { toUnit, severityFor, noteFor } from '../lib/confidence.js';
import {
  getCases, getCase, createCase,
  setCaseRows, setCaseResolved, computeCaseCounts, getCaseChecklist, setCaseChecklistItem, SAMPLES_DIR,
} from '../lib/store.js';
import { fillAcroForm } from '../lib/pdf-acroform.js';
import { buildI765FormData } from '../templates/i765-fields.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function detectMime(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg';
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf';
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
  return 'image/jpeg';
}

function safeParseJSON(raw) {
  try { return JSON.parse(raw); } catch {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  }
}

function normalize(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ─── GET /api/uc3/cases ───────────────────────────────────────────────────────
router.get('/cases', (req, res) => {
  const cases = getCases().map((c) => {
    const counts = computeCaseCounts(c.id);
    return { ...c, counts, statusLabel: counts.status };
  });
  res.json({ cases });
});

// ─── POST /api/uc3/cases ──────────────────────────────────────────────────────
router.post('/cases', (req, res) => {
  const { applicant, primary, visaType, questionnaire } = req.body;
  if (!applicant) return res.status(400).json({ error: 'applicant name required' });
  const c = createCase({ applicant, primary, visaType, questionnaire });
  res.status(201).json({ case: c });
});

// ─── GET /api/uc3/cases/:id ───────────────────────────────────────────────────
router.get('/cases/:id', (req, res) => {
  const c = getCase(req.params.id);
  if (!c) return res.status(404).json({ error: 'Case not found' });
  const counts = computeCaseCounts(c.id);
  res.json({ case: c, counts, status: counts.status });
});

// GET /api/uc3/cases/:id/checklist
router.get('/cases/:id/checklist', (req, res) => {
  const c = getCase(req.params.id);
  if (!c) return res.status(404).json({ error: 'Case not found' });
  res.json({ checklist: getCaseChecklist(c.id) });
});

// PATCH /api/uc3/cases/:id/checklist/:item
router.patch('/cases/:id/checklist/:item', upload.single('file'), (req, res) => {
  const c = getCase(req.params.id);
  if (!c) return res.status(404).json({ error: 'Case not found' });

  const received = req.body.received == null
    ? !!req.file
    : ['1', 'true', true].includes(req.body.received);

  const updated = setCaseChecklistItem(c.id, req.params.item, {
    received,
    filename: req.file?.originalname || req.body.filename || null,
    updatedAt: new Date().toISOString(),
  });

  if (!updated) return res.status(404).json({ error: 'Checklist item not found' });
  res.json({ case: updated, checklist: updated.checklist });
});

// ─── POST /api/uc3/cases/:id/run ─────────────────────────────────────────────
router.post('/cases/:id/run', upload.single('file'), async (req, res) => {
  try {
    const c = getCase(req.params.id);
    if (!c) return res.status(404).json({ error: 'Case not found' });

    let passportBuffer, passportMime;
    if (req.file) {
      passportBuffer = req.file.buffer;
      passportMime   = detectMime(req.file.buffer);
    } else {
      passportBuffer = readFileSync(join(SAMPLES_DIR, 'priya-passport.jpg'));
      passportMime   = detectMime(passportBuffer);
    }

    const passportB64 = passportBuffer.toString('base64');
    const passportBlock = passportMime === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: passportB64 } }
      : { type: 'image',    source: { type: 'base64', media_type: passportMime,       data: passportB64 } };

    const passportPrompt = `Extract exactly these 5 fields from this passport image and return ONLY valid JSON, no markdown:
{
  "fields": [
    { "label": "Full Legal Name",  "value": "<value>", "confidence": <0-100> },
    { "label": "Date of Birth",    "value": "<value>", "confidence": <0-100> },
    { "label": "Passport Number",  "value": "<value>", "confidence": <0-100> },
    { "label": "Passport Expiry",  "value": "<value>", "confidence": <0-100> },
    { "label": "Country of Birth", "value": "<value>", "confidence": <0-100> }
  ]
}
Format dates as YYYY-MM-DD. If a field is not found use "Not found" and confidence 0.`;

    const i94Buffer = readFileSync(join(SAMPLES_DIR, 'priya-i94.jpg'));
    const i94Mime   = detectMime(i94Buffer);
    const i94B64    = i94Buffer.toString('base64');
    const i94Block  = { type: 'image', source: { type: 'base64', media_type: i94Mime, data: i94B64 } };
    const i94Prompt = `Extract exactly these 2 fields from this I-94 document and return ONLY valid JSON, no markdown:
{
  "fields": [
    { "label": "Most Recent Entry Date", "value": "<value>", "confidence": <0-100> },
    { "label": "Visa Class on Entry",    "value": "<value>", "confidence": <0-100> }
  ]
}
Format dates as YYYY-MM-DD. "Most Recent Entry Date" is the latest arrival date. "Visa Class on Entry" is the class of admission (e.g. H-4). If not found use "Not found" and confidence 0.`;

    const utilBuffer = readFileSync(join(SAMPLES_DIR, 'priya-utility-bill.jpg'));
    const utilMime   = detectMime(utilBuffer);
    const utilB64    = utilBuffer.toString('base64');
    const utilBlock  = { type: 'image', source: { type: 'base64', media_type: utilMime, data: utilB64 } };
    const utilPrompt = `Extract exactly 1 field from this utility bill and return ONLY valid JSON, no markdown:
{
  "fields": [
    { "label": "Current Address", "value": "<full service address>", "confidence": <0-100> }
  ]
}
Include street, city, state, and ZIP. If not found use "Not found" and confidence 0.`;

    const start = Date.now();
    const [passportResult, i94Result, utilResult] = await Promise.all([
      callWithFallback(
        { model: 'claude-opus-4-5', max_tokens: 512, messages: [{ role: 'user', content: [passportBlock, { type: 'text', text: passportPrompt }] }] },
        () => [{ inlineData: { mimeType: passportMime, data: passportB64 } }, passportPrompt]
      ),
      callWithFallback(
        { model: 'claude-opus-4-5', max_tokens: 256, messages: [{ role: 'user', content: [i94Block, { type: 'text', text: i94Prompt }] }] },
        () => [{ inlineData: { mimeType: 'image/jpeg', data: i94B64 } }, i94Prompt]
      ),
      callWithFallback(
        { model: 'claude-opus-4-5', max_tokens: 256, messages: [{ role: 'user', content: [utilBlock, { type: 'text', text: utilPrompt }] }] },
        () => [{ inlineData: { mimeType: 'image/jpeg', data: utilB64 } }, utilPrompt]
      ),
    ]);
    const elapsed = Date.now() - start;
    console.log(`[uc3/run] 3 extractions via ${passportResult.provider} in ${elapsed}ms`);

    function makeRow(f, source) {
      const questionnaire = c.questionnaire[f.label] ?? '';
      const extracted     = f.value;
      const unit          = toUnit(f.confidence);
      const match         = normalize(extracted) === normalize(questionnaire);
      const severity      = severityFor(match, unit, f.label);
      return {
        field: f.label,
        questionnaire,
        extracted,
        source,
        conf: unit,
        match,
        ...(severity ? { severity } : {}),
        ...(!match && severity ? { note: noteFor({ field: f.label, extracted, questionnaire, severity }) } : {}),
      };
    }

    const passportFields = (safeParseJSON(passportResult.text).fields || []).map((f) => makeRow(f, 'Passport · p1'));
    const i94Fields      = (safeParseJSON(i94Result.text).fields || []).map((f) => makeRow(f, 'I-94 latest entry'));
    const utilFields     = (safeParseJSON(utilResult.text).fields || []).map((f) => makeRow(f, 'Civil docs · utility bill'));

    const FIELD_ORDER = [
      'Full Legal Name', 'Date of Birth', 'Passport Number', 'Passport Expiry', 'Country of Birth',
      'Most Recent Entry Date', 'Visa Class on Entry', 'Current Address',
    ];
    const allExtracted = [...passportFields, ...i94Fields, ...utilFields];
    const merged = FIELD_ORDER
      .map((f) => allExtracted.find((r) => r.field === f))
      .filter(Boolean);

    setCaseRows(merged, c.id);
    const counts = computeCaseCounts(c.id);
    res.json({ case: getCase(c.id), counts, status: counts.status, processing_time_ms: elapsed });
  } catch (err) {
    console.error('[uc3/run]', err.message);
    res.status(502).json({ error: err.message, aiUnavailable: true });
  }
});

// ─── POST /api/uc3/cases/:id/resolve ─────────────────────────────────────────
router.post('/cases/:id/resolve', (req, res) => {
  const { field, choice } = req.body;
  if (!field || !['document', 'questionnaire'].includes(choice)) {
    return res.status(400).json({ error: 'field and choice ("document"|"questionnaire") required' });
  }
  const c = getCase(req.params.id);
  if (!c) return res.status(404).json({ error: 'Case not found' });
  setCaseResolved(field, choice, c.id);
  const counts = computeCaseCounts(c.id);
  res.json({ resolved: getCase(c.id).resolved, counts, status: counts.status });
});

// ─── POST /api/uc3/cases/:id/save ────────────────────────────────────────────
router.post('/cases/:id/save', async (req, res) => {
  const c = getCase(req.params.id);
  if (!c) return res.status(404).json({ error: 'Case not found' });

  const counts = computeCaseCounts(c.id);
  if (counts.Error > 0) {
    return res.status(409).json({ error: 'Cannot save — Error mismatches remain unresolved', counts });
  }

  try {
    const start     = Date.now();
    const pdfBuffer = await fillAcroForm('i765_unlocked.pdf', buildI765FormData(c));
    const elapsed   = Date.now() - start;
    console.log(`[uc3/save] I-765 filled in ${elapsed}ms`);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="Form_I-765_${c.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[uc3/save]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Legacy single-case route (backward compat) ───────────────────────────────
router.get('/case', (req, res) => {
  const c = getCase();
  if (!c) return res.status(404).json({ error: 'No cases found' });
  const counts = computeCaseCounts(c.id);
  res.json({ case: c, counts, status: counts.status });
});

export default router;

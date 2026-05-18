import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import multer from 'multer';
import { callWithFallback } from '../lib/ai-with-fallback.js';
import { toUnit, isFlagged } from '../lib/confidence.js';
import {
  getNotices, getNotice, setNotice, addNotice, recomputeNoticeFlags,
  store, SAMPLES_DIR,
} from '../lib/store.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectMime(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg';
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf';
  return 'application/octet-stream';
}

function buildContentBlock(buffer, mimeType) {
  const base64 = buffer.toString('base64');
  if (mimeType === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  }
  return { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } };
}

function buildGeminiPart(buffer, mimeType) {
  return { inlineData: { mimeType, data: buffer.toString('base64') } };
}

function safeParseJSON(raw) {
  try { return JSON.parse(raw); } catch {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  }
}

async function extractNoticeFields(buffer, mimeType) {
  const contentBlock = buildContentBlock(buffer, mimeType);
  const prompt = `You are an AI extraction engine for USCIS immigration notices.
Extract exactly these 10 fields from the I-797 Notice of Action document:
1. Beneficiary — the beneficiary's full name (last, first format or as printed)
2. Petitioner — the petitioner company or individual name
3. Receipt Number — the USCIS receipt number (e.g. WAC-26-098-54321)
4. Receipt Notice Date — the date printed on the notice (ISO format YYYY-MM-DD)
5. Received-On Date — the date the petition was received (ISO format YYYY-MM-DD)
6. Receipt Type — the type of notice (e.g. "Receipt Notice")
7. Government Form — the form type (e.g. "I-797C")
8. Service Center — the USCIS service center name (e.g. "California Service Center")
9. Status — the case status (e.g. "Case Received")
10. Priority Date — the priority date if present (ISO format YYYY-MM-DD)

For each field provide a confidence score 0-100 (how clearly visible and certain the value is).

Respond ONLY with valid JSON, no markdown, no code fences:
{
  "fields": [
    { "label": "Beneficiary",         "value": "<value>", "confidence": <0-100> },
    { "label": "Petitioner",          "value": "<value>", "confidence": <0-100> },
    { "label": "Receipt Number",      "value": "<value>", "confidence": <0-100> },
    { "label": "Receipt Notice Date", "value": "<value>", "confidence": <0-100> },
    { "label": "Received-On Date",    "value": "<value>", "confidence": <0-100> },
    { "label": "Receipt Type",        "value": "<value>", "confidence": <0-100> },
    { "label": "Government Form",     "value": "<value>", "confidence": <0-100> },
    { "label": "Service Center",      "value": "<value>", "confidence": <0-100> },
    { "label": "Status",              "value": "<value>", "confidence": <0-100> },
    { "label": "Priority Date",       "value": "<value>", "confidence": <0-100> }
  ]
}
If a field cannot be found, set value to "Not found" and confidence to 0.`;

  const start = Date.now();
  const { text: rawText, provider } = await callWithFallback(
    { model: 'claude-opus-4-5', max_tokens: 1024, messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }] },
    () => [buildGeminiPart(buffer, mimeType), prompt]
  );
  const elapsed = Date.now() - start;
  console.log(`[uc1/extract] responded via ${provider} in ${elapsed}ms`);

  const parsed = safeParseJSON(rawText);

  // Separate identity fields from displayed fields
  const beneficiaryField = parsed.fields?.find((f) => f.label === 'Beneficiary');
  const petitionerField  = parsed.fields?.find((f) => f.label === 'Petitioner');

  const fields = (parsed.fields || [])
    .filter((f) => f.label !== 'Beneficiary' && f.label !== 'Petitioner')
    .map((f) => {
      const unit = toUnit(f.confidence);
      return { label: f.label, value: f.value, conf: unit, ...(isFlagged(unit) ? { flagged: true } : {}) };
    });

  const anyFlagged = fields.some((f) => f.flagged);
  return {
    fields,
    status:      anyFlagged ? 'Needs review' : 'Pre-filled',
    provider,
    elapsed,
    beneficiary: beneficiaryField?.value || null,
    petitioner:  petitionerField?.value  || null,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/uc1/stats
router.get('/stats', (req, res) => {
  const notices = getNotices();
  const covered = notices.filter((n) => n.status !== 'New' && n.fields.length > 0 || n.status === 'Verified').length;
  const autoFillPct = Math.round((covered / Math.max(notices.length, 1)) * 100);

  res.json({
    stats: [
      { label: 'In queue today',     value: String(store.stats.queueTotal), delta: store.stats.queueDelta },
      { label: 'Auto-fill coverage', value: `${autoFillPct}%`,              delta: store.stats.autoFillTarget },
      { label: 'Field accuracy',     value: store.stats.fieldAccuracy,      delta: store.stats.fieldAccuracyTarget },
      { label: 'Duplicate records',  value: store.stats.duplicates,         delta: store.stats.duplicatesDelta },
    ],
  });
});

// GET /api/uc1/notices
router.get('/notices', (req, res) => {
  res.json({ notices: getNotices() });
});

// GET /api/uc1/notices/:id
router.get('/notices/:id', (req, res) => {
  const notice = getNotice(req.params.id);
  if (!notice) return res.status(404).json({ error: 'Notice not found' });
  res.json({ notice });
});

// POST /api/uc1/notices/:id/extract  — run AI on the notice's own document
router.post('/notices/:id/extract', async (req, res) => {
  const notice = getNotice(req.params.id);
  if (!notice) return res.status(404).json({ error: 'Notice not found' });
  if (!notice.sampleAsset) return res.status(400).json({ error: 'No document on file for this notice — upload one first' });

  try {
    // sampleAsset is a public URL path like /samples/filename.png — resolve to filesystem
    const filename = notice.sampleAsset.replace('/samples/', '');
    const buffer   = readFileSync(join(SAMPLES_DIR, filename));
    const mimeType = detectMime(buffer);

    const { fields, status, provider, beneficiary, petitioner } = await extractNoticeFields(buffer, mimeType);

    setNotice(notice.id, {
      fields,
      flags:             fields.filter((f) => f.flagged).length,
      status,
      extractedProvider: provider,
      record:            `Extracted via ${provider} · ${fields.filter((f) => f.flagged).length} flag(s)`,
      ...(beneficiary ? { beneficiary } : {}),
      ...(petitioner  ? { petitioner  } : {}),
    });

    res.json({ notice: getNotice(notice.id) });
  } catch (err) {
    console.error('[uc1/extract]', err.message);
    res.status(502).json({ error: err.message, aiUnavailable: true });
  }
});

// POST /api/uc1/notices/:id/verify
router.post('/notices/:id/verify', (req, res) => {
  const notice = getNotice(req.params.id);
  if (!notice) return res.status(404).json({ error: 'Notice not found' });

  setNotice(notice.id, {
    verifiedFields: notice.fields,
    fields: [],
    flags: 0,
    status: 'Verified',
    record: 'Saved to case management — record updated',
  });

  res.json({ notice: getNotice(notice.id) });
});

// POST /api/uc1/notices/:id/route-manual
router.post('/notices/:id/route-manual', (req, res) => {
  const notice = getNotice(req.params.id);
  if (!notice) return res.status(404).json({ error: 'Notice not found' });

  setNotice(notice.id, {
    status: 'New',
    record: 'Routed to manual review queue',
  });

  res.json({ notice: getNotice(notice.id) });
});

// POST /api/uc1/notices  — upload a new notice file and extract
router.post('/notices', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const id = `N-${Date.now().toString().slice(-5)}`;
  const notice = {
    id,
    file: req.file.originalname || `notice_${id}.pdf`,
    received: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' today',
    beneficiary: 'Processing…',
    petitioner: 'Processing…',
    form: 'I-797',
    status: 'New',
    flags: 0,
    matter: '—',
    record: 'Uploaded — extraction pending',
    sampleAsset: null,
    extractedProvider: null,
    verifiedFields: null,
    fields: [],
  };
  addNotice(notice);

  try {
    const { fields, status, provider, beneficiary, petitioner } = await extractNoticeFields(req.file.buffer, detectMime(req.file.buffer));

    setNotice(id, {
      fields,
      flags:             fields.filter((f) => f.flagged).length,
      status,
      extractedProvider: provider,
      beneficiary:       beneficiary || 'Unknown',
      petitioner:        petitioner  || 'Unknown',
      record:            `Extracted via ${provider} · ${fields.filter((f) => f.flagged).length} flag(s)`,
    });
  } catch (err) {
    console.error('[uc1/upload-extract]', err.message);
    setNotice(id, { record: 'Extraction failed — review manually' });
  }

  res.status(201).json({ notice: getNotice(id) });
});

export default router;

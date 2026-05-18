import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import multer from 'multer';
import puppeteer from 'puppeteer';
import { callWithFallback } from '../lib/ai-with-fallback.js';
import { toUnit, severityFor, noteFor } from '../lib/confidence.js';
import { getCase, setCaseRows, setCaseResolved, computeCaseCounts, SAMPLES_DIR } from '../lib/store.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const PASSPORT_FIELDS = [
  'Full Legal Name',
  'Date of Birth',
  'Passport Number',
  'Passport Expiry',
  'Country of Birth',
];

function safeParseJSON(raw) {
  try { return JSON.parse(raw); } catch {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  }
}

function normalize(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ─── GET /api/uc3/case ────────────────────────────────────────────────────────
router.get('/case', (req, res) => {
  const c = getCase();
  const counts = computeCaseCounts();
  res.json({ case: c, counts, status: counts.status });
});

// ─── POST /api/uc3/case/run ───────────────────────────────────────────────────
// Runs real AI on passport document (uploaded or sample), recomputes passport rows,
// keeps I-94 / utility-bill rows from the current store state (hybrid approach).
router.post('/case/run', upload.single('file'), async (req, res) => {
  try {
    let buffer, mimeType;
    if (req.file) {
      buffer   = req.file.buffer;
      mimeType = req.file.mimetype;
    } else {
      buffer   = readFileSync(join(SAMPLES_DIR, 'passport-sample.jpg'));
      mimeType = 'image/jpeg';
    }

    const base64 = buffer.toString('base64');
    const contentBlock = mimeType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image',    source: { type: 'base64', media_type: mimeType,           data: base64 } };

    const prompt = `You are an AI document extraction engine. Extract exactly these 5 fields from the passport document:
1. Full Legal Name — full name as printed (usually all caps in MRZ)
2. Date of Birth — date of birth exactly as printed
3. Passport Number — passport number as printed
4. Passport Expiry — expiry date as printed
5. Country of Birth — nationality/country of birth as printed

For each field provide a confidence score 0-100.

Respond ONLY with valid JSON, no markdown:
{
  "fields": [
    { "label": "Full Legal Name",  "value": "<value>", "confidence": <0-100> },
    { "label": "Date of Birth",    "value": "<value>", "confidence": <0-100> },
    { "label": "Passport Number",  "value": "<value>", "confidence": <0-100> },
    { "label": "Passport Expiry",  "value": "<value>", "confidence": <0-100> },
    { "label": "Country of Birth", "value": "<value>", "confidence": <0-100> }
  ]
}
If a field cannot be found, use "Not found" and confidence 0.`;

    const start = Date.now();
    const { text: rawText, provider } = await callWithFallback(
      { model: 'claude-opus-4-5', max_tokens: 512, messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }] },
      () => [{ inlineData: { mimeType, data: base64 } }, prompt]
    );
    const elapsed = Date.now() - start;
    console.log(`[uc3/run] responded via ${provider} in ${elapsed}ms`);

    const parsed = safeParseJSON(rawText);
    const c = getCase();

    // Build updated passport rows from real AI
    const passportRows = (parsed.fields || []).map((f) => {
      const questionnaire = c.questionnaire[f.label] ?? '';
      const extracted     = f.value;
      const unit          = toUnit(f.confidence);
      const match         = normalize(extracted) === normalize(questionnaire);
      const severity      = severityFor(match, unit, f.label);
      return {
        field:         f.label,
        questionnaire,
        extracted,
        source:        'Passport · p1',
        conf:          unit,
        match,
        ...(severity ? { severity } : {}),
        ...(!match && severity ? { note: noteFor({ field: f.label, extracted, questionnaire, severity }) } : {}),
      };
    });

    // Keep non-passport rows from the current store (I-94, utility bill, etc.)
    const keptRows = c.rows.filter((r) => !PASSPORT_FIELDS.includes(r.field));

    // Re-merge: passport rows first (same order), then kept rows
    const merged = [
      ...PASSPORT_FIELDS.map((f) => passportRows.find((r) => r.field === f)).filter(Boolean),
      ...keptRows,
    ];

    setCaseRows(merged);

    const counts = computeCaseCounts();
    res.json({ case: getCase(), counts, status: counts.status, processing_time_ms: elapsed });
  } catch (err) {
    console.error('[uc3/run]', err.message);
    res.status(502).json({ error: err.message, aiUnavailable: true });
  }
});

// ─── POST /api/uc3/case/resolve ───────────────────────────────────────────────
router.post('/case/resolve', (req, res) => {
  const { field, choice } = req.body;
  if (!field || !['document', 'questionnaire'].includes(choice)) {
    return res.status(400).json({ error: 'field and choice ("document"|"questionnaire") required' });
  }
  setCaseResolved(field, choice);
  const counts = computeCaseCounts();
  res.json({ resolved: getCase().resolved, counts, status: counts.status });
});

// ─── POST /api/uc3/case/save ──────────────────────────────────────────────────
router.post('/case/save', async (req, res) => {
  const counts = computeCaseCounts();
  if (counts.blocking > 0) {
    return res.status(409).json({ error: 'Cannot save — blocking mismatches remain unresolved', counts });
  }

  let browser;
  try {
    const c = getCase();
    const start = Date.now();

    const html = buildApplicationSummaryHTML(c);
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      printBackground: true,
    });
    await browser.close();
    browser = null;

    const elapsed = Date.now() - start;
    console.log(`[uc3/save] application form PDF built in ${elapsed}ms`);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="Application_${c.id}.pdf"`);
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    console.error('[uc3/save]', err.message);
    if (browser) { try { await browser.close(); } catch { /* ignore */ } }
    res.status(500).json({ error: err.message });
  }
});

function buildApplicationSummaryHTML(c) {
  const rows = c.rows.map((r) => {
    const finalValue = c.resolved[r.field]
      ? (c.resolved[r.field] === 'document' ? r.extracted : r.questionnaire)
      : r.extracted;
    return `<tr><td class="lbl">${r.field}</td><td class="val">${finalValue}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; }
  .page { width:8.5in; min-height:11in; padding: 1in 1.1in; }
  h1 { font-size:16pt; margin-bottom:6px; }
  .meta { font-size:9pt; color:#555; margin-bottom:24px; }
  table { width:100%; border-collapse:collapse; }
  td { padding:7px 0; border-bottom:1px solid #eee; font-size:10pt; vertical-align:top; }
  .lbl { width:45%; color:#555; }
  .val { font-weight:600; }
</style></head><body><div class="page">
  <h1>Application Summary — ${c.id}</h1>
  <div class="meta">${c.applicant} · ${c.type} · dependent of ${c.primary} · intake ${c.intake}</div>
  <table>${rows}</table>
</div></body></html>`;
}

export default router;

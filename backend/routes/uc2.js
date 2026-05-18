import { Router } from 'express';
import multer from 'multer';
import puppeteer from 'puppeteer';
import { callWithFallback } from '../lib/ai-with-fallback.js';
import { toUnit } from '../lib/confidence.js';
import { getMatters, getMatter, setMatter, addMatter } from '../lib/store.js';
import { buildPublicAccessFileHTML } from '../templates/public-access-file.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function safeParseJSON(raw) {
  try { return JSON.parse(raw); } catch {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  }
}

function detectMime(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg';
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf';
  return 'application/octet-stream';
}

// ─── GET /api/uc2/matters ─────────────────────────────────────────────────────
router.get('/matters', (req, res) => {
  const list = getMatters().map(({ generatedPdfBase64: _, ...rest }) => rest);
  res.json({ matters: list });
});

// ─── GET /api/uc2/matters/:id ─────────────────────────────────────────────────
router.get('/matters/:id', (req, res) => {
  const matter = getMatter(req.params.id);
  if (!matter) return res.status(404).json({ error: 'Matter not found' });
  res.json({ matter });
});

// ─── POST /api/uc2/matters/upload-lca ────────────────────────────────────────
// Upload an LCA document → AI extracts all fields → creates a new matter in DB
router.post('/matters/upload-lca', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const buffer   = req.file.buffer;
  const mimeType = detectMime(buffer);
  const base64   = buffer.toString('base64');

  const contentBlock = mimeType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image',    source: { type: 'base64', media_type: mimeType,           data: base64 } };

  const prompt = `You are an AI extraction engine for US Department of Labor Labor Condition Applications (LCA / ETA-9035E).
Extract exactly these 11 fields from the document:
1. Employer Name — the legal business name of the employer
2. Job Title — the specific job title for this position
3. Worksite City — city of the worksite address
4. Worksite State — two-letter state code of the worksite (e.g. CA, TX, KS)
5. Validity Start — LCA validity period start date (ISO format YYYY-MM-DD)
6. Validity End — LCA validity period end date (ISO format YYYY-MM-DD)
7. Occupation Code (SOC) — the SOC code (e.g. "17-2011.00")
8. Wage Range — the employer wage range (e.g. "$138,000 – $182,000")
9. Prevailing Wage — the prevailing wage rate (e.g. "$131,400 / yr")
10. Posting Start — public notice posting start date (ISO format YYYY-MM-DD)
11. Posting End — public notice posting end date (ISO format YYYY-MM-DD)

For each field provide a confidence score 0-100.

Respond ONLY with valid JSON, no markdown:
{
  "fields": [
    { "label": "Employer Name",          "value": "<value>", "confidence": <0-100> },
    { "label": "Job Title",              "value": "<value>", "confidence": <0-100> },
    { "label": "Worksite City",          "value": "<value>", "confidence": <0-100> },
    { "label": "Worksite State",         "value": "<value>", "confidence": <0-100> },
    { "label": "Validity Start",         "value": "<value>", "confidence": <0-100> },
    { "label": "Validity End",           "value": "<value>", "confidence": <0-100> },
    { "label": "Occupation Code (SOC)",  "value": "<value>", "confidence": <0-100> },
    { "label": "Wage Range",             "value": "<value>", "confidence": <0-100> },
    { "label": "Prevailing Wage",        "value": "<value>", "confidence": <0-100> },
    { "label": "Posting Start",          "value": "<value>", "confidence": <0-100> },
    { "label": "Posting End",            "value": "<value>", "confidence": <0-100> }
  ]
}
If a field cannot be found set value to "Not found" and confidence to 0.`;

  try {
    const start = Date.now();
    const { text: rawText, provider } = await callWithFallback(
      { model: 'claude-opus-4-5', max_tokens: 1024, messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }] },
      () => [{ inlineData: { mimeType, data: base64 } }, prompt]
    );
    const elapsed = Date.now() - start;
    console.log(`[uc2/upload-lca] responded via ${provider} in ${elapsed}ms`);

    const parsed = safeParseJSON(rawText);
    const fieldMap = {};
    (parsed.fields || []).forEach((f) => { fieldMap[f.label] = f; });

    const get = (label) => fieldMap[label]?.value || 'Not found';
    const conf = (label) => toUnit(fieldMap[label]?.confidence ?? 0);

    // Identity fields → matter record
    const employer     = get('Employer Name');
    const position     = get('Job Title');
    const worksiteCity = get('Worksite City');
    const worksiteState= get('Worksite State');
    const validityStart= get('Validity Start');
    const validityEnd  = get('Validity End');

    // LCA-specific fields → shown with confidence badges
    const lcaFields = [
      'Occupation Code (SOC)', 'Wage Range', 'Prevailing Wage', 'Posting Start', 'Posting End',
    ].map((label) => ({ label, value: get(label), conf: conf(label), source: 'LCA PDF' }));

    // Computed: retain until = validity end + 1 year
    let retainUntil = 'Not found';
    if (validityEnd && validityEnd !== 'Not found') {
      try {
        const d = new Date(validityEnd);
        d.setFullYear(d.getFullYear() + 1);
        retainUntil = d.toISOString().split('T')[0];
      } catch { /* leave as Not found */ }
    }

    const id = `M-${Date.now().toString().slice(-8)}`;
    const matter = {
      id,
      employer,
      position,
      worksite:          `${worksiteCity}, ${worksiteState}`,
      lcaCertified:      validityStart,
      status:            'Ready to generate',
      lcaExtracted:      true,
      generatedPdfBase64: null,
      generatedFilename:  null,
      lca:               lcaFields,
      computed:          [{ label: 'Retain Until', value: retainUntil, source: 'validity_end + 1y' }],
    };

    addMatter(matter);
    console.log(`[uc2/upload-lca] created matter ${id} for ${employer} via ${provider}`);

    res.status(201).json({ matter: getMatter(id), processing_time_ms: elapsed });
  } catch (err) {
    console.error('[uc2/upload-lca]', err.message);
    res.status(502).json({ error: err.message, aiUnavailable: true });
  }
});

// ─── POST /api/uc2/matters/:id/generate ──────────────────────────────────────
router.post('/matters/:id/generate', async (req, res) => {
  const matter = getMatter(req.params.id);
  if (!matter) return res.status(404).json({ error: 'Matter not found' });
  if (!matter.lcaExtracted) return res.status(409).json({ error: 'Upload and extract an LCA before generating' });

  let browser;
  try {
    const start   = Date.now();
    const html    = buildPublicAccessFileHTML(matter);
    browser       = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page    = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      printBackground: true,
    });
    await browser.close();
    browser = null;

    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    const filename  = `Compliance_File_${matter.id}.pdf`;
    const elapsed   = Date.now() - start;

    setMatter(matter.id, { status: 'Generated', generatedPdfBase64: pdfBase64, generatedFilename: filename });
    console.log(`[uc2/generate] PDF built for ${matter.id} in ${elapsed}ms`);

    res.json({ pdfBase64, filename, processing_time_ms: elapsed });
  } catch (err) {
    console.error('[uc2/generate]', err.message);
    if (browser) { try { await browser.close(); } catch { /* ignore */ } }
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/uc2/matters/:id/approve ───────────────────────────────────────
router.post('/matters/:id/approve', (req, res) => {
  const matter = getMatter(req.params.id);
  if (!matter) return res.status(404).json({ error: 'Matter not found' });
  if (matter.status !== 'Generated') {
    return res.status(409).json({ error: 'Matter must be Generated before approving' });
  }
  setMatter(matter.id, { status: 'Approved' });
  res.json({ matter: getMatter(matter.id) });
});

export default router;

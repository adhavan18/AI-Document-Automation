import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import multer from 'multer';
import puppeteer from 'puppeteer';
import { callWithFallback } from '../lib/ai-with-fallback.js';
import { toUnit } from '../lib/confidence.js';
import { getMatters, getMatter, setMatter, SAMPLES_DIR } from '../lib/store.js';
import { buildPublicAccessFileHTML } from '../templates/public-access-file.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function safeParseJSON(raw) {
  try { return JSON.parse(raw); } catch {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  }
}

// ─── GET /api/uc2/matters ─────────────────────────────────────────────────────
router.get('/matters', (req, res) => {
  // Strip heavy pdfBase64 from list view
  const list = getMatters().map(({ generatedPdfBase64: _, ...rest }) => rest);
  res.json({ matters: list });
});

// ─── GET /api/uc2/matters/:id ─────────────────────────────────────────────────
router.get('/matters/:id', (req, res) => {
  const matter = getMatter(req.params.id);
  if (!matter) return res.status(404).json({ error: 'Matter not found' });
  res.json({ matter });
});

// ─── POST /api/uc2/matters/:id/extract-lca ───────────────────────────────────
router.post('/matters/:id/extract-lca', upload.single('file'), async (req, res) => {
  const matter = getMatter(req.params.id);
  if (!matter) return res.status(404).json({ error: 'Matter not found' });

  try {
    // Use uploaded file or fall back to i797-sample as stand-in
    let buffer, mimeType;
    if (req.file) {
      buffer   = req.file.buffer;
      mimeType = req.file.mimetype;
    } else {
      buffer   = readFileSync(join(SAMPLES_DIR, 'i797-sample.pdf'));
      mimeType = 'application/pdf';
    }

    const base64 = buffer.toString('base64');
    const contentBlock = mimeType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image',    source: { type: 'base64', media_type: mimeType,           data: base64 } };

    const prompt = `You are an AI extraction engine for Labor Condition Applications (LCA).
Extract exactly these 5 fields from the LCA document:
1. Occupation Code (SOC) — the SOC code (e.g. "17-2011.00")
2. Wage Range — the wage range (e.g. "$118,400 – $164,200")
3. Prevailing Wage — the prevailing wage (e.g. "$112,840 / yr")
4. Posting Start — the public posting start date (ISO format YYYY-MM-DD)
5. Posting End — the public posting end date (ISO format YYYY-MM-DD)

For each field provide a confidence score 0-100.

Respond ONLY with valid JSON, no markdown:
{
  "fields": [
    { "label": "Occupation Code (SOC)", "value": "<value>", "confidence": <0-100> },
    { "label": "Wage Range",           "value": "<value>", "confidence": <0-100> },
    { "label": "Prevailing Wage",      "value": "<value>", "confidence": <0-100> },
    { "label": "Posting Start",        "value": "<value>", "confidence": <0-100> },
    { "label": "Posting End",          "value": "<value>", "confidence": <0-100> }
  ]
}
If a field cannot be found, set value to "Not found" and confidence to 0.`;

    const start = Date.now();
    const { text: rawText, provider } = await callWithFallback(
      { model: 'claude-opus-4-5', max_tokens: 512, messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }] },
      () => [{ inlineData: { mimeType, data: base64 } }, prompt]
    );
    const elapsed = Date.now() - start;
    console.log(`[uc2/extract-lca] responded via ${provider} in ${elapsed}ms`);

    const parsed = safeParseJSON(rawText);
    const lca = (parsed.fields || []).map((f) => ({
      label: f.label,
      value: f.value,
      conf: toUnit(f.confidence),
      source: 'LCA PDF',
    }));

    setMatter(matter.id, { lca, lcaExtracted: true });

    res.json({ matter: getMatter(matter.id), processing_time_ms: elapsed });
  } catch (err) {
    console.error('[uc2/extract-lca]', err.message);
    res.status(502).json({ error: err.message, aiUnavailable: true });
  }
});

// ─── POST /api/uc2/matters/:id/generate ──────────────────────────────────────
router.post('/matters/:id/generate', async (req, res) => {
  const matter = getMatter(req.params.id);
  if (!matter) return res.status(404).json({ error: 'Matter not found' });

  let browser;
  try {
    const start = Date.now();
    const html = buildPublicAccessFileHTML(matter);

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

    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    const filename  = `Compliance_File_${matter.id}.pdf`;
    const elapsed   = Date.now() - start;

    setMatter(matter.id, { status: 'Generated', generatedPdfBase64: pdfBase64, generatedFilename: filename });

    console.log(`[uc2/generate] PDF built for ${matter.id} in ${elapsed}ms (${pdfBuffer.length} bytes)`);

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
    return res.status(409).json({ error: 'Matter must be in Generated state before approving' });
  }
  setMatter(matter.id, { status: 'Approved' });
  res.json({ matter: getMatter(matter.id) });
});

export default router;

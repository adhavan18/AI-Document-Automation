import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import multer from 'multer';
import puppeteer from 'puppeteer';
import { callWithFallback } from '../lib/ai-with-fallback.js';
import { toUnit, severityFor, noteFor } from '../lib/confidence.js';
import { getCase, setCaseRows, setCaseResolved, computeCaseCounts, SAMPLES_DIR } from '../lib/store.js';
import { buildI765HTML } from '../templates/i765-template.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Detect actual image mime type from magic bytes — ignores file extension
function detectMime(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg';
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf';
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
  return 'image/jpeg'; // fallback
}

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
// Runs real AI extraction against passport, I-94, and utility bill samples,
// then compares every extracted field against the questionnaire.
router.post('/case/run', upload.single('file'), async (req, res) => {
  try {
    const c = getCase();

    // ── 1. Passport (uploaded override or Priya's sample) ──────────────────
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

    // ── 2. I-94 sample ─────────────────────────────────────────────────────
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

    // ── 3. Utility bill sample ─────────────────────────────────────────────
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

    // ── Run all three extractions in parallel ──────────────────────────────
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

    // ── Build rows from all extracted fields ───────────────────────────────
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

    const passportFields = (safeParseJSON(passportResult.text).fields || [])
      .map((f) => makeRow(f, 'Passport · p1'));
    const i94Fields = (safeParseJSON(i94Result.text).fields || [])
      .map((f) => makeRow(f, 'I-94 latest entry'));
    const utilFields = (safeParseJSON(utilResult.text).fields || [])
      .map((f) => makeRow(f, 'Civil docs · utility bill'));

    // Merge in display order
    const FIELD_ORDER = [
      'Full Legal Name', 'Date of Birth', 'Passport Number', 'Passport Expiry', 'Country of Birth',
      'Most Recent Entry Date', 'Visa Class on Entry', 'Current Address',
    ];
    const allExtracted = [...passportFields, ...i94Fields, ...utilFields];
    const merged = FIELD_ORDER
      .map((f) => allExtracted.find((r) => r.field === f))
      .filter(Boolean);

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

    const html = buildI765HTML(c);
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
    console.log(`[uc3/save] I-765 PDF built in ${elapsed}ms`);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="Form_I-765_${c.id}.pdf"`);
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    console.error('[uc3/save]', err.message);
    if (browser) { try { await browser.close(); } catch { /* ignore */ } }
    res.status(500).json({ error: err.message });
  }
});


export default router;

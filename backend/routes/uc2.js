import { Router } from 'express';
import multer from 'multer';
import { callWithFallback } from '../lib/ai-with-fallback.js';
import { toUnit } from '../lib/confidence.js';
import { getMatters, getMatter, setMatter, addMatter } from '../lib/store.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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

async function renderPafPdf(matter) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const title = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const navy = rgb(0.08, 0.16, 0.32);
  const teal = rgb(0.10, 0.40, 0.39);
  const muted = rgb(0.42, 0.48, 0.58);
  const line = rgb(0.86, 0.88, 0.91);
  const pale = rgb(0.96, 0.98, 0.98);

  const lcaValue = (label) => matter.lca?.find((f) => f.label === label)?.value ?? '';
  const computedValue = (label) => matter.computed?.find((f) => f.label === label)?.value ?? '';
  const deriveEnd = () => {
    const retain = computedValue('Retain Until');
    if (!retain || retain === 'Not found') return '';
    const d = new Date(retain);
    if (Number.isNaN(d.getTime())) return '';
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  };
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const employer = matter.employer ?? '';
  const first = (employer.trim()[0] || 'P').toUpperCase();
  const docRef = matter.id ?? '';
  const worksite = matter.worksite ?? '';
  const position = matter.position ?? '';
  const startDate = matter.lcaCertified ?? '';
  const endDate = deriveEnd();
  const retainUntil = computedValue('Retain Until');

  function page() {
    return pdf.addPage([612, 792]);
  }

  function text(p, value, x, y, opts = {}) {
    if (value == null || value === '') return;
    p.drawText(String(value), {
      x,
      y,
      size: opts.size ?? 9,
      font: opts.bold ? bold : opts.title ? title : font,
      color: opts.color ?? navy,
      maxWidth: opts.maxWidth,
      lineHeight: opts.lineHeight,
    });
  }

  function wrap(p, value, x, y, width, opts = {}) {
    const size = opts.size ?? 8;
    const words = String(value || '').split(/\s+/);
    const lines = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    lines.forEach((lineText, i) => text(p, lineText, x, y - i * (opts.lineHeight ?? 13), { ...opts, size }));
    return y - lines.length * (opts.lineHeight ?? 13);
  }

  function field(p, label, value, x, y, width, opts = {}) {
    text(p, label.toUpperCase(), x, y, { size: 6.5, bold: true, color: muted });
    p.drawLine({ start: { x, y: y - 16 }, end: { x: x + width, y: y - 16 }, thickness: 0.7, color: line });
    text(p, value || ' ', x, y - 12, { size: opts.size ?? 9, bold: opts.bold, color: navy, maxWidth: width });
  }

  function header(p, pageNo) {
    p.drawLine({ start: { x: 36, y: 742 }, end: { x: 576, y: 742 }, thickness: 0.8, color: line });
    p.drawRectangle({ x: 36, y: 752, width: 20, height: 20, color: teal });
    text(p, first, 43, 758, { size: 10, bold: true, color: rgb(1, 1, 1) });
    text(p, `${employer} - Public Access File`, 64, 758, { size: 8.5, color: muted });
    text(p, `Page ${pageNo} of 6`, 520, 758, { size: 8, color: muted });
  }

  function footer(p, pageNo) {
    p.drawLine({ start: { x: 36, y: 42 }, end: { x: 576, y: 42 }, thickness: 0.8, color: line });
    text(p, `${employer.toUpperCase()}  PAF / H-1B`, 36, 26, { size: 7, color: muted });
    text(p, `Page ${pageNo} of 6`, 286, 26, { size: 7, color: muted });
    text(p, 'CONFIDENTIAL', 515, 26, { size: 7, bold: true, color: rgb(0.70, 0.16, 0.16) });
  }

  function section(p, n, heading, y) {
    p.drawRectangle({ x: 36, y: y - 28, width: 540, height: 32, color: pale, borderColor: line, borderWidth: 0.7 });
    p.drawRectangle({ x: 48, y: y - 18, width: 22, height: 18, color: rgb(0.90, 0.96, 0.96) });
    text(p, n, 55, y - 13, { size: 8, bold: true, color: teal });
    text(p, heading, 82, y - 13, { size: 11, bold: true, color: navy });
  }

  // Cover
  let p = page();
  p.drawRectangle({ x: 36, y: 570, width: 540, height: 150, color: teal });
  p.drawRectangle({ x: 66, y: 660, width: 30, height: 30, color: rgb(1, 1, 1) });
  text(p, first, 76, 668, { size: 14, bold: true, color: teal });
  text(p, employer.toUpperCase(), 110, 674, { size: 14, bold: true, color: rgb(1, 1, 1) });
  text(p, 'TALENT - COMPLIANCE - MOBILITY', 110, 660, { size: 7, color: rgb(0.82, 0.92, 0.92) });
  text(p, 'U.S. DEPARTMENT OF LABOR - FORM COMPLIANCE', 66, 626, { size: 8, bold: true, color: rgb(0.86, 0.70, 0.36) });
  text(p, 'Public Access File', 66, 585, { size: 28, title: true, color: rgb(1, 1, 1) });
  text(p, 'H-1B Nonimmigrant Worker - Labor Condition Application Record', 66, 560, { size: 10, color: rgb(0.88, 0.94, 0.94) });
  field(p, 'Document Reference', docRef, 66, 512, 150);
  field(p, 'Worksite Jurisdiction', worksite, 236, 512, 150);
  field(p, 'Prepared Date', today, 406, 512, 120);
  p.drawRectangle({ x: 66, y: 382, width: 480, height: 80, color: pale });
  wrap(p, `About this file. This Public Access File contains documentation required by 20 CFR 655.760 in support of the Labor Condition Application filed for an H-1B nonimmigrant worker. It is maintained by ${employer} and must be made available for public examination within one working day after the date the LCA is filed with the U.S. Department of Labor.`, 82, 435, 448, { size: 8, color: navy, lineHeight: 13 });
  text(p, 'CONTENTS', 66, 330, { size: 8, bold: true, color: muted });
  ['Employer Information', 'Employee Information', 'Certified LCA', 'Wage Rate Documentation', 'Actual Wage Memorandum', 'Benefits Summary', 'Notice of Filing / Posting', 'Supporting Documents', 'Compliance & Certification']
    .forEach((name, i) => text(p, `${String(i + 1).padStart(2, '0')}   ${name}`, 66 + (i % 2) * 260, 306 - Math.floor(i / 2) * 22, { size: 8, color: navy }));
  footer(p, 1);

  // Page 2
  p = page(); header(p, 2);
  section(p, '01', 'Employer Information', 700);
  field(p, 'Employer Name', employer, 52, 636, 240, { bold: true });
  field(p, 'Registered Business Address', worksite, 52, 594, 480);
  field(p, 'HR / Immigration Contact', '', 52, 552, 220);
  field(p, 'Corporate Website', '', 310, 552, 220);
  section(p, '02', 'Employee Information', 470);
  field(p, 'Employee Full Legal Name', matter.employeeName ?? '', 52, 406, 480);
  field(p, 'Job Title', position, 52, 364, 220);
  field(p, 'SOC Occupation Code', lcaValue('Occupation Code (SOC)'), 310, 364, 220);
  field(p, 'Authorized Work Location(s)', worksite, 52, 322, 480);
  field(p, 'Employment Start Date', startDate, 52, 280, 220);
  field(p, 'Employment End Date', endDate, 310, 280, 220);
  footer(p, 2);

  // Page 3
  p = page(); header(p, 3);
  section(p, '03', 'Certified Labor Condition Application', 700);
  field(p, 'LCA Case Number', docRef, 52, 636, 150);
  field(p, 'Validity Start Date', startDate, 230, 636, 130);
  field(p, 'Validity End Date', endDate, 392, 636, 130);
  section(p, '04', 'Wage Rate Documentation', 530);
  field(p, 'Offered Salary / Wage', lcaValue('Wage Range'), 52, 466, 150);
  field(p, 'Pay Frequency', 'Annually', 230, 466, 130);
  field(p, 'Prevailing Wage Amount', lcaValue('Prevailing Wage'), 392, 466, 130);
  field(p, 'Prevailing Wage Source', 'U.S. Department of Labor / FLC Data Center', 52, 424, 480);
  section(p, '05', 'Actual Wage Memorandum', 336);
  wrap(p, `Required statement. ${employer} uses a compensation system based on role, experience, education, specialization, responsibility, and work location to determine wages for workers in substantially similar positions.`, 52, 276, 500, { size: 8, color: navy });
  footer(p, 3);

  // Page 4
  p = page(); header(p, 4);
  section(p, '06', 'Benefits Summary', 700);
  wrap(p, `${employer} affirms that H-1B nonimmigrant workers are offered benefits on the same basis and in accordance with the same criteria as similarly employed U.S. workers.`, 52, 636, 500, { size: 8, color: navy });
  ['Medical Insurance', 'Paid Time Off', 'Retirement Benefits', 'Bonus Programs', 'Disability & Life', 'Other Benefits'].forEach((benefit, i) => {
    const x = 52 + (i % 2) * 260;
    const y = 560 - Math.floor(i / 2) * 48;
    p.drawRectangle({ x, y, width: 220, height: 34, borderColor: line, borderWidth: 0.8 });
    text(p, benefit, x + 12, y + 19, { size: 8.5, bold: true, color: navy });
  });
  section(p, '07', 'Notice of Filing & Posting Evidence', 356);
  field(p, 'Posting Start Date', lcaValue('Posting Start'), 52, 292, 220);
  field(p, 'Posting End Date', lcaValue('Posting End'), 310, 292, 220);
  ['Physical Posting Location', 'Physical Posting Location', 'Electronic Notice Method', 'Distribution Audience'].forEach((label, i) => {
    const x = 52 + (i % 2) * 260;
    const y = 218 - Math.floor(i / 2) * 48;
    p.drawRectangle({ x, y, width: 220, height: 34, borderColor: line, borderWidth: 0.8 });
    text(p, `${i + 1}. ${label}`, x + 12, y + 19, { size: 8, color: navy });
  });
  footer(p, 4);

  // Page 5
  p = page(); header(p, 5);
  section(p, '08', 'H-1B Dependency & Willful Violator Status', 700);
  wrap(p, '[ ] H-1B Dependent Employer     [x] Non-H-1B-Dependent Employer     [ ] Willful Violator', 52, 636, 500, { size: 9, color: navy });
  section(p, '09', 'Supporting Documents Checklist', 530);
  ['Certified ETA-9035E (LCA)', 'Prevailing wage determination', 'Actual wage documentation', 'Benefits parity documentation', 'Public notice posting evidence', 'Employer H-1B dependency determination', 'Job description / offer letter', 'This Public Access File cover sheet']
    .forEach((item, i) => text(p, `[x] ${item}`, 52 + (i % 2) * 260, 466 - Math.floor(i / 2) * 28, { size: 8, color: navy }));
  field(p, 'Records Retain Until', retainUntil, 52, 310, 220);
  field(p, 'Custodian of Record', '', 310, 310, 220);
  footer(p, 5);

  // Page 6
  p = page(); header(p, 6);
  section(p, '10', 'Compliance & Certification', 700);
  wrap(p, `I, the undersigned authorized representative of ${employer}, hereby certify under penalty of perjury that the foregoing statements and the information contained in this Public Access File are true and correct to the best of my knowledge, and that this file has been prepared and is maintained in conformance with 20 CFR 655.760.`, 52, 636, 500, { size: 8.5, color: navy, lineHeight: 14 });
  p.drawLine({ start: { x: 52, y: 500 }, end: { x: 200, y: 500 }, thickness: 0.8, color: navy });
  p.drawLine({ start: { x: 232, y: 500 }, end: { x: 380, y: 500 }, thickness: 0.8, color: navy });
  p.drawLine({ start: { x: 412, y: 500 }, end: { x: 532, y: 500 }, thickness: 0.8, color: navy });
  text(p, 'Authorized Signature', 52, 486, { size: 7, color: muted });
  text(p, 'Printed Name & Title', 232, 486, { size: 7, color: muted });
  text(p, today, 452, 508, { size: 9, color: navy });
  text(p, 'Date', 412, 486, { size: 7, color: muted });
  wrap(p, `This Public Access File was prepared by ${employer} in accordance with the H-1B program requirements of the Immigration and Nationality Act and U.S. Department of Labor regulations.`, 52, 418, 500, { size: 7.5, color: muted, lineHeight: 12 });
  footer(p, 6);

  return Buffer.from(await pdf.save());
}

// ─── POST /api/uc2/matters/:id/generate ──────────────────────────────────────
router.post('/matters/:id/generate', async (req, res) => {
  const matter = getMatter(req.params.id);
  if (!matter) return res.status(404).json({ error: 'Matter not found' });
  if (!matter.lcaExtracted) return res.status(409).json({ error: 'Upload and extract an LCA before generating' });

  try {
    const start     = Date.now();
    const pdfBuffer = await renderPafPdf(matter);
    const pdfBase64 = pdfBuffer.toString('base64');
    const filename  = `Public_Access_File_${matter.employer?.replace(/[^a-zA-Z0-9]/g, '_') || matter.id}.pdf`;
    const elapsed   = Date.now() - start;

    setMatter(matter.id, { status: 'Generated', generatedPdfBase64: pdfBase64, generatedFilename: filename });
    console.log(`[uc2/generate] PAF rendered for ${matter.id} in ${elapsed}ms`);

    res.json({ pdfBase64, filename, processing_time_ms: elapsed });
  } catch (err) {
    console.error('[uc2/generate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/uc2/matters/:id/preview ────────────────────────────────────────
// Stream the generated PAF PDF inline for browser preview.
router.get('/matters/:id/preview', async (req, res) => {
  const matter = getMatter(req.params.id);
  if (!matter) return res.status(404).json({ error: 'Matter not found' });
  try {
    const pdfBuffer = await renderPafPdf(matter);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="PAF_${matter.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[uc2/preview]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/uc2/matters/:id/submit-review ─────────────────────────────────
router.post('/matters/:id/submit-review', (req, res) => {
  const matter = getMatter(req.params.id);
  if (!matter) return res.status(404).json({ error: 'Matter not found' });
  if (matter.status !== 'Generated') {
    return res.status(409).json({ error: 'PAF must be generated before submitting for review' });
  }
  setMatter(matter.id, {
    status: 'Pending Review',
    submittedAt: new Date().toISOString(),
  });
  res.json({ matter: getMatter(matter.id) });
});

// ─── POST /api/uc2/matters/:id/approve ───────────────────────────────────────
router.post('/matters/:id/approve', (req, res) => {
  const matter = getMatter(req.params.id);
  if (!matter) return res.status(404).json({ error: 'Matter not found' });
  if (!['Generated', 'Pending Review', 'Changes Requested'].includes(matter.status)) {
    return res.status(409).json({ error: 'Matter must be Generated or under review before approving' });
  }
  const { notes, reviewedBy } = req.body;
  setMatter(matter.id, {
    status: 'Approved',
    reviewNotes: notes ?? null,
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewedBy ?? 'Attorney',
  });
  res.json({ matter: getMatter(matter.id) });
});

// ─── POST /api/uc2/matters/:id/request-changes ───────────────────────────────
router.post('/matters/:id/request-changes', (req, res) => {
  const matter = getMatter(req.params.id);
  if (!matter) return res.status(404).json({ error: 'Matter not found' });
  const { notes, reviewedBy } = req.body;
  if (!notes) return res.status(400).json({ error: 'notes required when requesting changes' });
  setMatter(matter.id, {
    status: 'Changes Requested',
    reviewNotes: notes,
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewedBy ?? 'Attorney',
  });
  res.json({ matter: getMatter(matter.id) });
});

export default router;


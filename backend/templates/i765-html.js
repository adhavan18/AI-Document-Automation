// HTML-based I-765 filler.
// Renders the official USCIS form pages as PNG backgrounds, then overlays
// field values using absolute CSS positioning. Rendered to PDF via Puppeteer.
//
// Coordinate conversion from fill-i765.js (PDF bottom-left origin):
//   css_top = 792 - pdf_y - font_size_pt

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FORMS_DIR = join(__dirname, 'forms');
const TOTAL_PAGES = 7;

// Render one page of the I-765 to PNG at 144 DPI (cached as i765_p{n}.png).
function getPageBase64(pageIndex) {
  const pngPath = join(FORMS_DIR, `i765_p${pageIndex}.png`);
  if (!existsSync(pngPath)) {
    const src = join(FORMS_DIR, 'i765.pdf');
    execSync(
      `gs -dBATCH -dNOPAUSE -dQUIET -sDEVICE=png16m -r144 ` +
      `-dFirstPage=${pageIndex + 1} -dLastPage=${pageIndex + 1} ` +
      `-sOutputFile="${pngPath}" "${src}"`,
      { stdio: 'inherit' }
    );
  }
  return readFileSync(pngPath).toString('base64');
}

// ── Field value helpers ────────────────────────────────────────────────────

function resolvedValue(c, field) {
  const choice = c.resolved?.[field];
  if (!choice) return c.questionnaire?.[field] ?? '';
  const row = (c.rows || []).find((r) => r.field === field);
  if (!row) return c.questionnaire?.[field] ?? '';
  return choice === 'document' ? row.extracted : row.questionnaire;
}

function parseName(full) {
  const parts = (full || '').trim().split(/\s+/);
  if (parts.length === 1) return { last: parts[0], first: '', middle: '' };
  if (parts.length === 2) return { last: parts[1], first: parts[0], middle: '' };
  return { last: parts[parts.length - 1], first: parts[0], middle: parts.slice(1, -1).join(' ') };
}

function parseAddress(addr) {
  const m = (addr || '').match(/^(.+?),\s*(.+?),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (m) return { street: m[1], city: m[2], state: m[3], zip: m[4] };
  return { street: addr || '', city: '', state: '', zip: '' };
}

function fmtDate(iso) {
  if (!iso || iso === 'Not found' || iso === '—') return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

// ── HTML helpers ───────────────────────────────────────────────────────────

// Convert PDF coords (bottom-left origin) to CSS (top-left origin).
// pdfY = text baseline from bottom; size = font size in pt.
function f(pdfX, pdfY, text, size = 9) {
  if (!text && text !== 0) return '';
  const top  = 792 - pdfY - size;
  const left = pdfX;
  return `<span style="position:absolute;left:${left}pt;top:${top}pt;font-size:${size}pt;">${text}</span>`;
}

// Checkbox X mark.
function chk(pdfX, pdfY, size = 8) {
  return f(pdfX, pdfY, 'X', size);
}

// One form page: background = official USCIS page image; fields overlaid.
function page(pageIndex, base64Img, ...fields) {
  return `
  <div style="
    position:relative; width:612pt; height:792pt; overflow:hidden;
    page-break-after:always; font-family:Helvetica,Arial,sans-serif; color:#000;
  ">
    <img src="data:image/png;base64,${base64Img}"
         style="position:absolute;inset:0;width:612pt;height:792pt;" />
    ${fields.join('')}
  </div>`;
}

// ── Main builder ───────────────────────────────────────────────────────────

export function buildI765Html(c) {
  // Render/cache all 7 pages.
  const imgs = Array.from({ length: TOTAL_PAGES }, (_, i) => getPageBase64(i));

  const name      = parseName(resolvedValue(c, 'Full Legal Name') || c.applicant);
  const dob       = fmtDate(resolvedValue(c, 'Date of Birth'));
  const cob       = resolvedValue(c, 'Country of Birth');
  const passport  = resolvedValue(c, 'Passport Number');
  const passExp   = fmtDate(resolvedValue(c, 'Passport Expiry'));
  const entryDate = fmtDate(resolvedValue(c, 'Most Recent Entry Date'));
  const visa      = resolvedValue(c, 'Visa Class on Entry');
  const addr      = parseAddress(resolvedValue(c, 'Current Address'));
  const today     = fmtDate(new Date().toISOString().split('T')[0]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:white; }
  @page { size:Letter; margin:0; }
  span { white-space:nowrap; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
</style>
</head>
<body>

${page(0, imgs[0],
  // Part 1 · 1.a checkbox
  chk(71, 412),
  // Part 2 · Full Legal Name
  f(190, 135, name.last),
  f(190, 110, name.first),
  f(190,  85, name.middle),
)}

${page(1, imgs[1],
  // U.S. Mailing Address
  f(133, 637, addr.street),
  f(133, 580, addr.city),
  f( 85, 558, addr.state),
  f(160, 558, addr.zip),
  // Item 10 Sex: Female
  chk(477, 623),
  // Item 11 Marital Status: Married
  chk(365, 587),
  // Item 14.a Country of Citizenship
  f(490, 408, cob),
)}

${page(2, imgs[2],
  // 15.c Country of Birth
  f( 57, 558, cob),
  // 16 Date of Birth
  f(160, 523, dob),
  // 18 Passport Number
  f( 57, 405, passport),
  // 20 Country That Issued Passport
  f( 57, 328, cob),
  // 21 Passport Expiration Date
  f(240, 300, passExp),
  // 22 Date of Last Arrival
  f(245, 275, entryDate),
  // 24 Immigration Status at Last Arrival
  f( 57, 178, visa),
  // 25 Current Immigration Status
  f( 57, 130, visa),
  // 27 Eligibility Category (c)(26)
  f(342, 623, 'c'),
  f(369, 623, '2'),
  f(396, 623, '6'),
)}

${page(3, imgs[3],
  // 7.b Date of Signature
  f(370, 280, today),
)}

${page(4, imgs[4])}
${page(5, imgs[5])}
${page(6, imgs[6])}

</body>
</html>`;
}

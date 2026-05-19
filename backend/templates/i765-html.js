// HTML-based I-765 filler.
// Each page = official USCIS form rendered as PNG background; field values
// overlaid using absolute CSS positioning.
//
// Coordinate system:
//   PDF origin = bottom-left; y increases upward.
//   CSS origin = top-left;    y increases downward.
//
// Conversion (corrected for font ascender ratio ~0.75):
//   css_top = 792 - pdf_y - (font_size * 0.75)
//
// This places text inside the field boxes rather than slightly above them.

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FORMS_DIR  = join(__dirname, 'forms');
const TOTAL_PAGES = 7;

// Render one page of the I-765 PDF to PNG at 144 DPI (cached).
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

// ── Coordinate helpers ──────────────────────────────────────────────────────

// Place text at PDF coordinates (pdfX, pdfY = baseline from bottom-left).
// size * 0.75 approximates the ascender height so text sits inside field boxes.
function f(pdfX, pdfY, text, size = 9) {
  if (!text && text !== 0) return '';
  const top  = 792 - pdfY - (size * 0.75);
  const left = pdfX;
  return `<span style="position:absolute;left:${left}pt;top:${top}pt;font-size:${size}pt;line-height:1;font-family:Arial,Helvetica,sans-serif;white-space:nowrap;color:#000;">${text}</span>`;
}

// Place an X mark (checkbox fill).
function chk(pdfX, pdfY, size = 8) {
  return f(pdfX, pdfY, 'X', size);
}

// One page: PNG background + absolute-positioned field overlays.
function page(pageIndex, base64Img, ...fields) {
  const fieldHtml = fields.filter(Boolean).join('');
  return `<div style="position:relative;width:612pt;height:792pt;overflow:hidden;page-break-after:always;">
  <img src="data:image/png;base64,${base64Img}" style="position:absolute;top:0;left:0;width:612pt;height:792pt;display:block;" />
  ${fieldHtml}
</div>`;
}

// ── Value helpers ───────────────────────────────────────────────────────────

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

// ── Main builder ────────────────────────────────────────────────────────────

export function buildI765Html(c) {
  const imgs = Array.from({ length: TOTAL_PAGES }, (_, i) => getPageBase64(i));

  const name      = parseName(resolvedValue(c, 'Full Legal Name') || c.applicant || '');
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
</style>
</head>
<body>

${page(0, imgs[0],
  // Part 1 · 1.a "Initial permission" checkbox
  chk(71, 412),

  // Part 2 · Your Full Legal Name
  // Field boxes: 1.a y=133–142 (baseline 135), 1.b y=108–118 (baseline 110), 1.c y=83–93 (baseline 85)
  f(190, 135, name.last),
  f(190, 110, name.first),
  f(190,  85, name.middle),
)}

${page(1, imgs[1],
  // U.S. Mailing Address
  // 5.b Street Number and Name
  f(133, 637, addr.street),
  // 5.d City or Town
  f(133, 580, addr.city),
  // 5.e State  (narrow box)
  f( 85, 558, addr.state),
  // 5.f ZIP Code
  f(160, 558, addr.zip),

  // Item 10 · Sex: Female checkbox
  chk(477, 623),
  // Item 11 · Marital Status: Married checkbox
  chk(365, 587),

  // Item 14.a · Country of Citizenship
  f(490, 408, cob),
)}

${page(2, imgs[2],
  // 15.c Country of Birth
  f( 57, 558, cob),
  // 16 Date of Birth (mm/dd/yyyy)
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

  // 27 Eligibility Category — three individual boxes for (c)(26)
  f(342, 623, 'c'),
  f(369, 623, '2'),
  f(396, 623, '6'),
)}

${page(3, imgs[3],
  // Part 3 · 7.b Date of Signature
  f(370, 280, today),
)}

${page(4, imgs[4])}
${page(5, imgs[5])}
${page(6, imgs[6])}

</body>
</html>`;
}

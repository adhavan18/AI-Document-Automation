// Coordinate placements for the saved USCIS Form I-765 PDF.
//
// pdf-lib origin = BOTTOM-LEFT, US Letter = 612 x 792 pt.
// These are STARTER coordinates for the standard I-765 (Edition 04/01/24).
// To tune them: hit /api/uc3/case/save?calibrate=1 once, open the PDF, read
// the ruler grid, and adjust x / y / page below. y grows upward.

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
  const m = (addr || '').match(/^(.+?),\s*([^,]+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (m) return { street: m[1], city: m[2], state: m[3], zip: m[4] };
  return { street: addr || '', city: '', state: '', zip: '' };
}

function fmtDate(iso) {
  if (!iso || iso === 'Not found' || iso === '—') return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

export function buildI765Placements(c) {
  const name       = parseName(resolvedValue(c, 'Full Legal Name') || c.applicant);
  const dob        = fmtDate(resolvedValue(c, 'Date of Birth'));
  const cob        = resolvedValue(c, 'Country of Birth');
  const entryDate  = fmtDate(resolvedValue(c, 'Most Recent Entry Date'));
  const visaClass  = resolvedValue(c, 'Visa Class on Entry');
  const addr       = parseAddress(resolvedValue(c, 'Current Address'));
  const passportNo = resolvedValue(c, 'Passport Number');

  // page = 0-based page index. x from left, y from bottom.
  return [
    // ── Page 1 · Part 1 — Reason for Applying ──
    { page: 0, x: 56,  y: 612, check: true },                 // 1.a Initial permission
    { page: 0, x: 250, y: 556, text: '(c)(26)' },             // Eligibility category

    // ── Page 1 · Part 2 — Applicant info ──
    { page: 0, x: 70,  y: 470, text: name.last },             // Family Name
    { page: 0, x: 300, y: 470, text: name.first },            // Given Name
    { page: 0, x: 470, y: 470, text: name.middle },           // Middle Name

    { page: 0, x: 70,  y: 300, text: dob },                   // Date of Birth
    { page: 0, x: 300, y: 300, text: cob },                   // Country of Birth
    { page: 0, x: 470, y: 300, text: cob },                   // Country of Citizenship

    { page: 0, x: 70,  y: 210, text: addr.street },           // Street
    { page: 0, x: 70,  y: 165, text: addr.city },             // City
    { page: 0, x: 330, y: 165, text: addr.state },            // State
    { page: 0, x: 420, y: 165, text: addr.zip },              // ZIP

    // ── Page 2 · Part 2 continued ──
    { page: 1, x: 70,  y: 600, text: passportNo },            // Admission/petition nbr
    { page: 1, x: 330, y: 600, text: entryDate },             // Date of last entry
    { page: 1, x: 70,  y: 540, text: visaClass },             // Status at last entry
    { page: 1, x: 330, y: 540, text: visaClass },             // Current immigration status

    // ── Page 2 · Part 3 — Certification signature/date ──
    { page: 1, x: 400, y: 110, text: fmtDate(new Date().toISOString().split('T')[0]) },
  ];
}

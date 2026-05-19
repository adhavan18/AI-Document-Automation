// Coordinate placements for USCIS Form I-765 (Application for Employment Authorization).
// Edition 08/21/25 · 7 pages · Letter (612 × 792 pt).
// Coordinates calibrated from Ghostscript-rendered PNG at 108 DPI (1 px ≈ 0.667 pt).
// PDF origin = bottom-left; y increases upward.

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
  // Handles both "Street, City ST ZIP" and "Street, City, ST ZIP" formats
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

export function buildI765Placements(c) {
  const name      = parseName(resolvedValue(c, 'Full Legal Name') || c.applicant);
  const dob       = fmtDate(resolvedValue(c, 'Date of Birth'));
  const cob       = resolvedValue(c, 'Country of Birth');
  const passport  = resolvedValue(c, 'Passport Number');
  const passExp   = fmtDate(resolvedValue(c, 'Passport Expiry'));
  const entryDate = fmtDate(resolvedValue(c, 'Most Recent Entry Date'));
  const visa      = resolvedValue(c, 'Visa Class on Entry');
  const addr      = parseAddress(resolvedValue(c, 'Current Address'));
  const today     = fmtDate(new Date().toISOString().split('T')[0]);

  return [
    // ── PAGE 0 · Part 1 — Reason for Applying ─────────────────────────────
    // 1.a "Initial permission to accept employment" checkbox (cal: box x=68-77, center y=412)
    { page: 0, x: 71,  y: 412, check: true, size: 8 },

    // ── PAGE 0 · Part 2 — Your Full Legal Name (bottom of page) ───────────
    // 1.a Family Name input box (cal: box y=133–142 → baseline y=135)
    { page: 0, x: 190, y: 135, text: name.last,   size: 9 },
    // 1.b Given Name input box (cal: box y=108–118 → baseline y=110)
    { page: 0, x: 190, y: 110, text: name.first,  size: 9 },
    // 1.c Middle Name input box (cal: box y=83–93 → baseline y=85)
    { page: 0, x: 190, y:  85, text: name.middle, size: 9 },

    // ── PAGE 1 · Part 2 — U.S. Mailing Address ────────────────────────────
    // 5.b Street Number and Name (cal: 5.b label at y=625-650 → box at y=637)
    { page: 1, x: 133, y: 637, text: addr.street, size: 9 },
    // 5.d City or Town (cal: 5.d label at y=600 → box at y=580)
    { page: 1, x: 133, y: 580, text: addr.city,   size: 9 },
    // 5.e State (cal: State row at y=558)
    { page: 1, x:  85, y: 558, text: addr.state,  size: 9 },
    // 5.f ZIP Code (same row)
    { page: 1, x: 160, y: 558, text: addr.zip,    size: 9 },

    // ── PAGE 1 · Part 2 — Other Information (right column) ────────────────
    // Item 10 Sex: Female checkbox (targeted: "10. Sex" row at y=625; Male at ~x=440, Female at ~x=477)
    { page: 1, x: 477, y: 623, check: true, size: 8 },
    // Item 11 Marital Status: Married checkbox (targeted: header at y=600, checkboxes row at y=587)
    // Married is 2nd checkbox: x≈365, y=587
    { page: 1, x: 365, y: 587, check: true, size: 8 },
    // Item 14.a Country of citizenship (targeted: 14.a box at y=408)
    { page: 1, x: 490, y: 408, text: cob, size: 9 },

    // ── PAGE 2 · Part 2 — Place of Birth ──────────────────────────────────
    // 15.c Country of Birth (cal: 15.c label at y=575 → box at y=558)
    { page: 2, x: 57,  y: 558, text: cob,  size: 9 },
    // 16 Date of Birth mm/dd/yyyy (cal: 16 label at y=525 → box at y=523)
    { page: 2, x: 160, y: 523, text: dob,  size: 9 },

    // ── PAGE 2 · Part 2 — Last Arrival ────────────────────────────────────
    // 18 Passport Number of Most Recently Issued Passport (cal: 18 label at y=425 → box at y=405)
    { page: 2, x: 57,  y: 405, text: passport,  size: 9 },
    // 20 Country That Issued Your Passport (cal: 20 label at y=350 → box at y=328)
    { page: 2, x: 57,  y: 328, text: cob,       size: 9 },
    // 21 Expiration Date for Passport (label at y=300; date box is inline after label, x≈240)
    { page: 2, x: 240, y: 300, text: passExp,   size: 9 },
    // 22 Date of Last Arrival (label at y=275; date box is after multi-line label, x≈245)
    { page: 2, x: 245, y: 275, text: entryDate, size: 9 },
    // 24 Immigration Status at Last Arrival (cal: 24 label at y=200, box at y=178)
    { page: 2, x: 57,  y: 178, text: visa,      size: 9 },
    // 25 Current Immigration Status or Category (cal: 25 label at y=150, box at y=130)
    { page: 2, x: 57,  y: 130, text: visa,      size: 9 },

    // ── PAGE 2 · Eligibility Category item 27 (right column) ──────────────
    // Three boxes for (c)(26) — targeted: boxes drawn at y≈638, text inside at y=623
    { page: 2, x: 342, y: 623, text: 'c',  size: 9 },
    { page: 2, x: 369, y: 623, text: '2',  size: 9 },
    { page: 2, x: 396, y: 623, text: '6',  size: 9 },

    // ── PAGE 3 · Part 3 — Date of Signature ───────────────────────────────
    // 7.b Date of Signature mm/dd/yyyy (cal: y=280)
    { page: 3, x: 370, y: 280, text: today, size: 9 },
  ];
}

// AcroForm field-name map for USCIS Form I-765 (edition 08/21/25, 7 pages).
// Maps native AcroForm field names (dumped via pdf-lib) to runtime values.
// No coordinates — pdf-lib's setText / check / select positions text natively.

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

export function buildI765FormData(c) {
  const name      = parseName(resolvedValue(c, 'Full Legal Name') || c.applicant || '');
  const dob       = fmtDate(resolvedValue(c, 'Date of Birth'));
  const cob       = resolvedValue(c, 'Country of Birth');
  const passport  = resolvedValue(c, 'Passport Number');
  const passExp   = fmtDate(resolvedValue(c, 'Passport Expiry'));
  const entryDate = fmtDate(resolvedValue(c, 'Most Recent Entry Date'));
  const visa      = resolvedValue(c, 'Visa Class on Entry');
  const addr      = parseAddress(resolvedValue(c, 'Current Address'));
  const today     = fmtDate(new Date().toISOString().split('T')[0]);

  return {
    // ── Page 1 · Part 1 — Reason for Applying ────────────────────────────
    // Part1_Checkbox[0/1/2] = Initial / Replacement / Renewal
    'form1[0].Page1[0].Part1_Checkbox[0]': true,

    // ── Page 1 · Part 2 — Your Full Legal Name ───────────────────────────
    'form1[0].Page1[0].Line1a_FamilyName[0]': name.last,
    'form1[0].Page1[0].Line1b_GivenName[0]':  name.first,
    'form1[0].Page1[0].Line1c_MiddleName[0]': name.middle,

    // ── Page 2 · Part 2 — U.S. Mailing Address (visible 5.a–5.f) ─────────
    'form1[0].Page2[0].Line4b_StreetNumberName[0]': addr.street,
    'form1[0].Page2[0].Pt2Line5_CityOrTown[0]':     addr.city,
    'form1[0].Page2[0].Pt2Line5_State[0]':          addr.state,   // dropdown
    'form1[0].Page2[0].Pt2Line5_ZipCode[0]':        addr.zip,

    // ── Page 2 · Item 10 Sex = Female (Line9_Checkbox[1]) ────────────────
    'form1[0].Page2[0].Line9_Checkbox[1]': true,

    // ── Page 2 · Item 11 Marital Status = Married (Line10_Checkbox[1]) ───
    // 0=Single 1=Married 2=Divorced 3=Widowed
    'form1[0].Page2[0].Line10_Checkbox[1]': true,

    // ── Page 2 · Item 14.a Country of Citizenship ────────────────────────
    'form1[0].Page2[0].Line17a_CountryOfBirth[0]': cob,

    // ── Page 3 · Place of Birth (15.c) ───────────────────────────────────
    'form1[0].Page3[0].Line18c_CountryOfBirth[0]': cob,

    // ── Page 3 · Item 16 Date of Birth ───────────────────────────────────
    'form1[0].Page3[0].Line19_DOB[0]': dob,

    // ── Page 3 · Item 18 Passport Number ─────────────────────────────────
    'form1[0].Page3[0].Line20b_Passport[0]': passport,

    // ── Page 3 · Item 20 Country That Issued Passport ────────────────────
    'form1[0].Page3[0].Line20d_CountryOfIssuance[0]': cob,

    // ── Page 3 · Item 21 Passport Expiration Date ────────────────────────
    'form1[0].Page3[0].Line20e_ExpDate[0]': passExp,

    // ── Page 3 · Item 22 Date of Last Arrival ────────────────────────────
    'form1[0].Page3[0].Line21_DateOfLastEntry[0]': entryDate,

    // ── Page 3 · Item 24 Immigration Status at Last Arrival ──────────────
    'form1[0].Page3[0].Line23_StatusLastEntry[0]': visa,

    // ── Page 3 · Item 25 Current Immigration Status ──────────────────────
    'form1[0].Page3[0].Line24_CurrentStatus[0]': visa,

    // ── Page 3 · Item 27 Eligibility Category (c)(2)(6) ──────────────────
    'form1[0].Page3[0].#area[1].section_1[0]': 'c',
    'form1[0].Page3[0].#area[1].section_2[0]': '2',
    'form1[0].Page3[0].#area[1].section_3[0]': '6',

    // ── Page 4 · Part 3 §7.b Date of Signature ───────────────────────────
    'form1[0].Page4[0].Pt3Line7b_DateofSignature[0]': today,
  };
}

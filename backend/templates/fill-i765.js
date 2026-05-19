// Field map for USCIS Form I-765 (Application for Employment Authorization).
// Field names match the AcroForm fields in the official USCIS PDF (Edition 04/01/24).
// If a field name is wrong for your copy of the PDF, check the server log on first
// generate — [pdf-fill] prints every available field name.

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

export function buildI765FieldMap(c) {
  const name       = parseName(resolvedValue(c, 'Full Legal Name') || c.applicant);
  const dob        = fmtDate(resolvedValue(c, 'Date of Birth'));
  const cob        = resolvedValue(c, 'Country of Birth');
  const entryDate  = fmtDate(resolvedValue(c, 'Most Recent Entry Date'));
  const visaClass  = resolvedValue(c, 'Visa Class on Entry');
  const addr       = parseAddress(resolvedValue(c, 'Current Address'));
  const passportNo = resolvedValue(c, 'Passport Number');

  // ── Field names are the AcroForm names from the official USCIS I-765 PDF.
  // ── The server log prints every available name when the PDF is first loaded.
  return {
    // Part 1 — Reason for Applying
    'Pt1Line1a_Checkbox[0]':  true,   // Initial permission
    'Pt1Line1b_Checkbox[0]':  false,  // Renewal
    'Pt1Line1c_Checkbox[0]':  false,  // Replacement
    'Pt1Line2_EligibilityCategory[0]': '(c)(26)',

    // Part 2 — Applicant info
    'Pt2Line1a_FamilyName[0]':     name.last,
    'Pt2Line1b_GivenName[0]':      name.first,
    'Pt2Line1c_MiddleName[0]':     name.middle,

    'Pt2Line9_DateofBirth[0]':     dob,
    'Pt2Line10_CountryofBirth[0]': cob,
    'Pt2Line11_CountryofCitizenship[0]': cob,

    // Gender — Female
    'Pt2Line12_Gender[0]': false,  // Male
    'Pt2Line12_Gender[1]': true,   // Female

    // Marital status — Married
    'Pt2Line13_MaritalStatus[0]': false, // Single
    'Pt2Line13_MaritalStatus[1]': true,  // Married
    'Pt2Line13_MaritalStatus[2]': false, // Divorced
    'Pt2Line13_MaritalStatus[3]': false, // Widowed

    // Entry / status
    'Pt2Line15_AlienAdmissionOrPetitionNbr[0]': passportNo ? `Passport: ${passportNo}` : '',
    'Pt2Line16a_DateofLastEntry[0]':    entryDate,
    'Pt2Line18_StatusAtLastEntry[0]':   visaClass,
    'Pt2Line19_CurrentImmigrationStatus[0]': visaClass,

    // Mailing address
    'Pt2Line22a_StreetNumberName[0]': addr.street,
    'Pt2Line22b_CityOrTown[0]':       addr.city,
    'Pt2Line22c_State[0]':            addr.state,
    'Pt2Line22d_ZipCode[0]':          addr.zip,

    // Part 3 — Certification
    'Pt3Line1_Checkbox[0]': true,   // Can read English
  };
}

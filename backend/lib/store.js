// In-memory store — seeds on import, resets on process restart.
// For demos: use `npm start` (not `npm run dev`) to prevent watch-reloads from clearing state.
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const SAMPLES_DIR = join(__dirname, '../../frontend/public/samples');

// ─── Seed data (mirrors ImmigrationAIPilot.jsx verbatim) ─────────────────────

const SEED_NOTICES = [
  {
    id: 'N-24891',
    file: 'I797_RECEIPT_2026-05-17_0834.pdf',
    received: '08:34 today',
    beneficiary: 'Rajeshwari Venkatasubramanian',
    petitioner: 'Northstar Aerospace, Inc.',
    form: 'I-129',
    status: 'Pre-filled',
    flags: 1,
    matter: 'M-2024-07731',
    record: 'Existing shipping record matched (SR-44012)',
    sampleAsset: '/samples/i797-sample.pdf',
    extractedProvider: null,
    verifiedFields: null,
    fields: [
      { label: 'Receipt Number',      value: 'WAC-26-098-54321',          conf: 0.98 },
      { label: 'Receipt Notice Date', value: '2026-05-14',                conf: 0.99 },
      { label: 'Received-On Date',    value: '2026-05-16',                conf: 0.97 },
      { label: 'Receipt Type',        value: 'Receipt Notice',            conf: 0.96 },
      { label: 'Government Form',     value: 'I-797C',                    conf: 0.99 },
      { label: 'Service Center',      value: 'California Service Center', conf: 0.94 },
      { label: 'Status',              value: 'Case Received',             conf: 0.95 },
      { label: 'Priority Date',       value: '2025-11-02',                conf: 0.72, flagged: true },
    ],
  },
  {
    id: 'N-24892',
    file: 'I797_RECEIPT_2026-05-17_0902.pdf',
    received: '09:02 today',
    beneficiary: 'Chen Wei-Lin',
    petitioner: 'Pacific Genomics LLC',
    form: 'I-140',
    status: 'Needs review',
    flags: 3,
    matter: 'M-2024-09122',
    record: 'Existing shipping record matched (SR-44103)',
    sampleAsset: '/samples/i797-sample.pdf',
    extractedProvider: null,
    verifiedFields: null,
    fields: [
      { label: 'Receipt Number',      value: 'EAC-26-101-77821',         conf: 0.93 },
      { label: 'Receipt Notice Date', value: '2026-05-13',               conf: 0.99 },
      { label: 'Received-On Date',    value: '2026-05-16',               conf: 0.71, flagged: true },
      { label: 'Receipt Type',        value: 'Receipt Notice',           conf: 0.96 },
      { label: 'Government Form',     value: 'I-797C',                   conf: 0.99 },
      { label: 'Service Center',      value: 'Vermont Service Center',   conf: 0.68, flagged: true },
      { label: 'Status',              value: 'Case Received',            conf: 0.95 },
      { label: 'Priority Date',       value: '2024-08-19',               conf: 0.62, flagged: true },
    ],
  },
  {
    id: 'N-24893',
    file: 'I797_RECEIPT_2026-05-17_0917.pdf',
    received: '09:17 today',
    beneficiary: 'Anjali Bhattacharya',
    petitioner: 'Helix Bio Solutions',
    form: 'I-129',
    status: 'Verified',
    flags: 0,
    matter: 'M-2024-08841',
    record: 'Saved to case management — record updated',
    sampleAsset: '/samples/i797-sample.pdf',
    extractedProvider: null,
    verifiedFields: null,
    fields: [],
  },
  {
    id: 'N-24894',
    file: 'I797_RECEIPT_2026-05-17_0944.pdf',
    received: '09:44 today',
    beneficiary: 'Mateusz Kowalczyk',
    petitioner: 'Ironside Manufacturing',
    form: 'I-129',
    status: 'New',
    flags: 0,
    matter: 'M-2024-09501',
    record: 'Awaiting extraction…',
    sampleAsset: '/samples/i797-sample.pdf',
    extractedProvider: null,
    verifiedFields: null,
    fields: [],
  },
];

const SEED_MATTERS = [
  {
    id: 'M-2024-07731',
    employer: 'Northstar Aerospace, Inc.',
    position: 'Senior Avionics Engineer',
    worksite: 'Wichita, KS',
    lcaCertified: '2026-05-09',
    status: 'Ready to generate',
    lcaExtracted: false,
    generatedPdfBase64: null,
    generatedFilename: null,
    inserts: 'Certified LCA pages · Prevailing-wage chart (cached for 17-2011.00)',
    cms: [
      { label: 'Company Name',   value: 'Northstar Aerospace, Inc.', source: 'CMS · DB' },
      { label: 'Position Title', value: 'Senior Avionics Engineer',  source: 'CMS · DB' },
      { label: 'Worksite City',  value: 'Wichita',                   source: 'CMS · DB' },
      { label: 'Worksite State', value: 'KS',                        source: 'CMS · DB' },
      { label: 'Validity Start', value: '2026-06-01',                source: 'CMS · DB' },
      { label: 'Validity End',   value: '2029-05-31',                source: 'CMS · DB' },
    ],
    lca: [],
    computed: [
      { label: 'Retain Until', value: '2030-05-31', source: 'validity_end + 1y' },
    ],
  },
  {
    id: 'M-2024-09122',
    employer: 'Pacific Genomics LLC',
    position: 'Computational Biologist',
    worksite: 'South San Francisco, CA',
    lcaCertified: '2026-05-12',
    status: 'Generated',
    lcaExtracted: true,
    generatedPdfBase64: null,
    generatedFilename: 'Compliance_File_M-2024-09122.pdf',
    inserts: 'Certified LCA pages · Prevailing-wage chart (cached for 15-2041.00)',
    cms: [
      { label: 'Company Name',   value: 'Pacific Genomics LLC',       source: 'CMS · DB' },
      { label: 'Position Title', value: 'Computational Biologist',    source: 'CMS · DB' },
      { label: 'Worksite City',  value: 'South San Francisco',        source: 'CMS · DB' },
      { label: 'Worksite State', value: 'CA',                         source: 'CMS · DB' },
      { label: 'Validity Start', value: '2026-05-15',                 source: 'CMS · DB' },
      { label: 'Validity End',   value: '2029-05-14',                 source: 'CMS · DB' },
    ],
    lca: [
      { label: 'Occupation Code (SOC)', value: '15-2041.00',           conf: 0.97, source: 'LCA PDF' },
      { label: 'Wage Range',           value: '$148,000 – $198,000',  conf: 0.95, source: 'LCA PDF' },
      { label: 'Prevailing Wage',      value: '$142,500 / yr',        conf: 0.93, source: 'LCA PDF' },
      { label: 'Posting Start',        value: '2026-04-01',           conf: 0.90, source: 'LCA PDF' },
      { label: 'Posting End',          value: '2026-04-15',           conf: 0.90, source: 'LCA PDF' },
    ],
    computed: [
      { label: 'Retain Until', value: '2030-05-14', source: 'validity_end + 1y' },
    ],
  },
  {
    id: 'M-2024-08841',
    employer: 'Helix Bio Solutions',
    position: 'Research Scientist III',
    worksite: 'Cambridge, MA',
    lcaCertified: '2026-05-10',
    status: 'Generated',
    lcaExtracted: true,
    generatedPdfBase64: null,
    generatedFilename: 'Compliance_File_M-2024-08841.pdf',
    inserts: 'Certified LCA pages · Prevailing-wage chart (cached for 19-1042.00)',
    cms: [
      { label: 'Company Name',   value: 'Helix Bio Solutions',    source: 'CMS · DB' },
      { label: 'Position Title', value: 'Research Scientist III', source: 'CMS · DB' },
      { label: 'Worksite City',  value: 'Cambridge',              source: 'CMS · DB' },
      { label: 'Worksite State', value: 'MA',                     source: 'CMS · DB' },
      { label: 'Validity Start', value: '2026-05-20',             source: 'CMS · DB' },
      { label: 'Validity End',   value: '2029-05-19',             source: 'CMS · DB' },
    ],
    lca: [
      { label: 'Occupation Code (SOC)', value: '19-1042.00',          conf: 0.96, source: 'LCA PDF' },
      { label: 'Wage Range',           value: '$125,000 – $168,000', conf: 0.94, source: 'LCA PDF' },
      { label: 'Prevailing Wage',      value: '$119,800 / yr',       conf: 0.92, source: 'LCA PDF' },
      { label: 'Posting Start',        value: '2026-04-10',          conf: 0.91, source: 'LCA PDF' },
      { label: 'Posting End',          value: '2026-04-24',          conf: 0.91, source: 'LCA PDF' },
    ],
    computed: [
      { label: 'Retain Until', value: '2030-05-19', source: 'validity_end + 1y' },
    ],
  },
];

const SEED_CASE = {
  id: 'DEP-2026-00482',
  type: 'Dependent filing',
  applicant: 'Priya Subramanian',
  primary: 'Karthik Subramanian',
  intake: '2026-05-16 14:22',
  documents: [
    { id: 'doc-1', label: 'Passport (32 pp)',             sampleAsset: '/samples/priya-passport.jpg' },
    { id: 'doc-2', label: 'I-94 latest entry',            sampleAsset: '/samples/priya-i94.jpg' },
    { id: 'doc-3', label: 'Prior approval notice',        sampleAsset: '/samples/priya-approval-notice.jpg' },
    { id: 'doc-4', label: 'Marriage certificate',         sampleAsset: '/samples/priya-marriage-cert.jpg' },
    { id: 'doc-5', label: 'Utility bill (proof of addr)', sampleAsset: '/samples/priya-utility-bill.jpg' },
  ],
  questionnaire: {
    'Full Legal Name':        'Priya Subramanian',
    'Date of Birth':          '1991-07-12',
    'Passport Number':        'M9 482 1733',
    'Passport Expiry':        '2031-03-18',
    'Country of Birth':       'India',
    'Most Recent Entry Date': '2024-08-03',
    'Visa Class on Entry':    'H-4',
    'Current Address':        '142 Cypress Ln, Plano TX 75024',
  },
  rows: [
    { field: 'Full Legal Name',        questionnaire: 'Priya Subramanian',              extracted: 'Priya Subramanian',                       source: 'Passport · p1',          conf: 0.99, match: true },
    { field: 'Date of Birth',          questionnaire: '1991-07-12',                     extracted: '1991-07-12',                              source: 'Passport · p1',          conf: 0.99, match: true },
    { field: 'Passport Number',        questionnaire: 'M9 482 1733',                    extracted: 'M9482 1733',                              source: 'Passport · p1',          conf: 0.95, match: false, severity: 'minor',    note: 'Whitespace mismatch · likely same value' },
    { field: 'Passport Expiry',        questionnaire: '2031-03-18',                     extracted: '2031-03-18',                              source: 'Passport · p1',          conf: 0.98, match: true },
    { field: 'Country of Birth',       questionnaire: 'India',                          extracted: 'India',                                   source: 'Passport · p1',          conf: 0.99, match: true },
    { field: 'Most Recent Entry Date', questionnaire: '2024-08-03',                     extracted: '2024-08-14',                              source: 'I-94 latest entry',      conf: 0.97, match: false, severity: 'blocking', note: 'Applicant entered 2024-08-03 — I-94 shows 2024-08-14. Resolve before save.' },
    { field: 'Visa Class on Entry',    questionnaire: 'H-4',                            extracted: 'H-4',                                     source: 'I-94 latest entry',      conf: 0.98, match: true },
    { field: 'Current Address',        questionnaire: '142 Cypress Ln, Plano TX 75024', extracted: '142 Cypress Lane, Plano TX 75024',         source: 'Civil docs · utility bill', conf: 0.88, match: false, severity: 'minor', note: 'Abbreviation only · "Ln" vs "Lane"' },
  ],
  resolved: {},
};

// ─── Store singleton ──────────────────────────────────────────────────────────

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function seed() {
  return {
    notices: deepClone(SEED_NOTICES),
    matters: deepClone(SEED_MATTERS),
    validationCase: deepClone(SEED_CASE),
    stats: {
      queueTotal: 47,
      queueDelta: '+12 vs avg',
      autoFillTarget: 'target ≥80%',
      fieldAccuracy: '96.2%',
      fieldAccuracyTarget: 'target ≥95%',
      duplicates: '0',
      duplicatesDelta: 'pilot to date',
    },
  };
}

export const store = seed();

// ─── Notice helpers ───────────────────────────────────────────────────────────

export function getNotices() { return store.notices; }

export function getNotice(id) {
  return store.notices.find((n) => n.id === id) ?? null;
}

export function setNotice(id, patch) {
  const idx = store.notices.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  Object.assign(store.notices[idx], patch);
  return store.notices[idx];
}

export function addNotice(notice) {
  store.notices.push(notice);
}

export function recomputeNoticeFlags(notice) {
  notice.flags = notice.fields.filter((f) => f.flagged).length;
}

// ─── Matter helpers ───────────────────────────────────────────────────────────

export function getMatters() { return store.matters; }

export function getMatter(id) {
  return store.matters.find((m) => m.id === id) ?? null;
}

export function setMatter(id, patch) {
  const idx = store.matters.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  Object.assign(store.matters[idx], patch);
  return store.matters[idx];
}

// ─── Validation case helpers ──────────────────────────────────────────────────

export function getCase() { return store.validationCase; }

export function setCaseRows(rows) {
  store.validationCase.rows = rows;
  store.validationCase.resolved = {};
}

export function setCaseResolved(field, choice) {
  store.validationCase.resolved[field] = choice;
}

export function computeCaseCounts() {
  const { rows, resolved } = store.validationCase;
  const blocking = rows.filter((r) => !r.match && r.severity === 'blocking' && !resolved[r.field]).length;
  const minor    = rows.filter((r) => !r.match && r.severity === 'minor'    && !resolved[r.field]).length;
  const verified = rows.filter((r) => r.match).length + Object.keys(resolved).length;
  const status   = blocking > 0 ? 'Mismatches' : minor > 0 ? 'Needs review' : 'Cleared';
  return { blocking, minor, verified, status };
}

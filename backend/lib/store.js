// In-memory store — seeds on import, resets on process restart.
// For demos: use `npm start` (not `npm run dev`) to prevent watch-reloads from clearing state.
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const SAMPLES_DIR = join(__dirname, '../../frontend/public/samples');

// ─── Seed data (mirrors ImmigrationAIPilot.jsx verbatim) ─────────────────────

const SEED_NOTICES = [
  // Empty — notices are added live via upload
  // Kept as array for future seeding if needed
  /*{
    id: 'N-24891',
    file: 'I797_RECEIPT_2026-05-17_0834.pdf',
    received: '08:34 today',
    beneficiary: 'Rajeshwari Venkatasubramanian',
    petitioner: 'Northstar Aerospace, Inc.',
    form: 'I-129',
    status: 'New',
    flags: 0,
    matter: 'M-2024-07731',
    record: 'Awaiting extraction…',
    sampleAsset: '/samples/i797-n24891-rajeshwari.png',
    extractedProvider: null,
    verifiedFields: null,
    fields: [],
  },
  {
    id: 'N-24892',
    file: 'I797_RECEIPT_2026-05-17_0902.pdf',
    received: '09:02 today',
    beneficiary: 'Chen Wei-Lin',
    petitioner: 'Pacific Genomics LLC',
    form: 'I-140',
    status: 'New',
    flags: 0,
    matter: 'M-2024-09122',
    record: 'Awaiting extraction…',
    sampleAsset: '/samples/i797-n24892-chenwei.png',
    extractedProvider: null,
    verifiedFields: null,
    fields: [],
  },
  {
    id: 'N-24893',
    file: 'I797_RECEIPT_2026-05-17_0917.pdf',
    received: '09:17 today',
    beneficiary: 'Anjali Bhattacharya',
    petitioner: 'Helix Bio Solutions',
    form: 'I-129',
    status: 'New',
    flags: 0,
    matter: 'M-2024-08841',
    record: 'Awaiting extraction…',
    sampleAsset: '/samples/i797-n24893-anjali.png',
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
    sampleAsset: '/samples/i797-n24894-mateusz.png',
    extractedProvider: null,
    verifiedFields: null,
    fields: [],
  },*/
];

// One seeded matter kept as an existing DB record example (no LCA yet)
const SEED_MATTERS = [
  {
    id: 'M-2024-07731',
    employer: 'Northstar Aerospace, Inc.',
    position: 'Senior Avionics Engineer',
    worksite: 'Wichita, KS',
    lcaCertified: null,
    status: 'Pending LCA',
    lcaExtracted: false,
    generatedPdfBase64: null,
    generatedFilename: null,
    lca: [],
    computed: [],
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
  rows: [],
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

export function addMatter(matter) {
  store.matters.push(matter);
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

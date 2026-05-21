import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS matters (
    id TEXT PRIMARY KEY,
    employer TEXT,
    position TEXT,
    worksite TEXT,
    lca_certified TEXT,
    validity_start TEXT,
    validity_end TEXT,
    retain_until TEXT,
    lca_json TEXT,
    computed_json TEXT,
    status TEXT DEFAULT 'Ready to generate',
    generated_pdf_b64 TEXT,
    generated_filename TEXT,
    review_notes TEXT,
    submitted_at TEXT,
    reviewed_at TEXT,
    reviewed_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notices (
    id TEXT PRIMARY KEY,
    filename TEXT,
    mime TEXT,
    file_b64 TEXT,
    sample_asset TEXT,
    beneficiary TEXT,
    petitioner TEXT,
    receipt_number TEXT,
    receipt_notice_date TEXT,
    received_on TEXT,
    receipt_type TEXT,
    government_form TEXT,
    service_center TEXT,
    status_field TEXT,
    priority_date TEXT,
    extraction_status TEXT DEFAULT 'new',
    flags INTEGER DEFAULT 0,
    manual_review INTEGER DEFAULT 0,
    verified_at TEXT,
    fields_json TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    type TEXT DEFAULT 'Dependent filing',
    applicant TEXT,
    primary_applicant TEXT,
    visa_type TEXT DEFAULT 'H-4 EAD',
    intake TEXT,
    questionnaire_json TEXT DEFAULT '{}',
    rows_json TEXT DEFAULT '[]',
    resolved_json TEXT DEFAULT '{}',
    checklist_json TEXT DEFAULT '[]',
    documents_json TEXT DEFAULT '[]',
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS deadlines (
    id TEXT PRIMARY KEY,
    case_id TEXT,
    label TEXT,
    due_date TEXT,
    type TEXT,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!columns.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

ensureColumn('cases', 'checklist_json', "TEXT DEFAULT '[]'");

// ── Seed seed matters if table is empty ──────────────────────────────────────
const matterCount = db.prepare('SELECT COUNT(*) as n FROM matters').get().n;
if (matterCount === 0) {
  const insert = db.prepare(`
    INSERT INTO matters (id, employer, position, worksite, lca_certified, status, lca_json, computed_json)
    VALUES (@id, @employer, @position, @worksite, @lca_certified, @status, @lca_json, @computed_json)
  `);
  const seedMatters = [
    {
      id: 'M-2024-07731',
      employer: 'Northstar Aerospace, Inc.',
      position: 'Senior Avionics Engineer',
      worksite: 'Wichita, KS',
      lca_certified: '2026-06-01',
      status: 'Ready to generate',
      lca_json: JSON.stringify([
        { label: 'Occupation Code (SOC)', value: '17-2011.00',          conf: 0.97, source: 'LCA PDF' },
        { label: 'Wage Range',           value: '$138,000 – $182,000', conf: 0.95, source: 'LCA PDF' },
        { label: 'Prevailing Wage',      value: '$131,400 / yr',       conf: 0.94, source: 'LCA PDF' },
        { label: 'Posting Start',        value: '2026-04-10',          conf: 0.92, source: 'LCA PDF' },
        { label: 'Posting End',          value: '2026-04-24',          conf: 0.92, source: 'LCA PDF' },
      ]),
      computed_json: JSON.stringify([{ label: 'Retain Until', value: '2030-05-31', source: 'validity_end + 1y' }]),
    },
    {
      id: 'M-2024-09122',
      employer: 'Pacific Genomics LLC',
      position: 'Computational Biologist',
      worksite: 'South San Francisco, CA',
      lca_certified: '2026-05-15',
      status: 'Ready to generate',
      lca_json: JSON.stringify([
        { label: 'Occupation Code (SOC)', value: '15-2041.00',          conf: 0.97, source: 'LCA PDF' },
        { label: 'Wage Range',           value: '$148,000 – $198,000', conf: 0.95, source: 'LCA PDF' },
        { label: 'Prevailing Wage',      value: '$142,500 / yr',       conf: 0.93, source: 'LCA PDF' },
        { label: 'Posting Start',        value: '2026-04-01',          conf: 0.90, source: 'LCA PDF' },
        { label: 'Posting End',          value: '2026-04-15',          conf: 0.90, source: 'LCA PDF' },
      ]),
      computed_json: JSON.stringify([{ label: 'Retain Until', value: '2030-05-14', source: 'validity_end + 1y' }]),
    },
    {
      id: 'M-2024-08841',
      employer: 'Helix Bio Solutions',
      position: 'Research Scientist III',
      worksite: 'Cambridge, MA',
      lca_certified: '2026-05-20',
      status: 'Ready to generate',
      lca_json: JSON.stringify([
        { label: 'Occupation Code (SOC)', value: '19-1042.00',          conf: 0.96, source: 'LCA PDF' },
        { label: 'Wage Range',           value: '$125,000 – $168,000', conf: 0.94, source: 'LCA PDF' },
        { label: 'Prevailing Wage',      value: '$119,800 / yr',       conf: 0.92, source: 'LCA PDF' },
        { label: 'Posting Start',        value: '2026-04-10',          conf: 0.91, source: 'LCA PDF' },
        { label: 'Posting End',          value: '2026-04-24',          conf: 0.91, source: 'LCA PDF' },
      ]),
      computed_json: JSON.stringify([{ label: 'Retain Until', value: '2030-05-19', source: 'validity_end + 1y' }]),
    },
  ];
  const insertAll = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
  insertAll(seedMatters);
}

// ── Seed Priya's case if cases table is empty ─────────────────────────────────
const caseCount = db.prepare('SELECT COUNT(*) as n FROM cases').get().n;
if (caseCount === 0) {
  db.prepare(`
    INSERT INTO cases (id, type, applicant, primary_applicant, intake, questionnaire_json, checklist_json, documents_json)
    VALUES (@id, @type, @applicant, @primary_applicant, @intake, @questionnaire_json, @checklist_json, @documents_json)
  `).run({
    id: 'DEP-2026-00482',
    type: 'Dependent filing',
    applicant: 'Priya Subramanian',
    primary_applicant: 'Karthik Subramanian',
    intake: '2026-05-16 14:22',
    questionnaire_json: JSON.stringify({
      'Full Legal Name':        'Priya Subramanian',
      'Date of Birth':          '1991-07-12',
      'Passport Number':        'M9 482 1733',
      'Passport Expiry':        '2031-03-18',
      'Country of Birth':       'India',
      'Most Recent Entry Date': '2024-08-03',
      'Visa Class on Entry':    'H-4',
      'Current Address':        '142 Cypress Ln, Plano TX 75024',
      'USCIS Receipt Number (spouse H-1B)': 'IOE0000000001',
      'Attorney Email':         'admin@lawfirm.com',
    }),
    checklist_json: JSON.stringify([
      { id: 'passport_bio', label: 'Passport (bio page)', received: true, filename: 'priya-passport.jpg' },
      { id: 'i94', label: 'I-94 printout', received: true, filename: 'priya-i94.jpg' },
      { id: 'proof_address', label: 'Proof of address (utility bill)', received: true, filename: 'priya-utility-bill.jpg' },
      { id: 'spouse_i797', label: 'Spouse I-129 approval notice (I-797)', received: true, filename: 'priya-approval-notice.jpg' },
      { id: 'spouse_ead', label: 'Spouse EAD (if applicable)', received: false, filename: null },
      { id: 'photos', label: 'Photos (2x2 inch)', received: false, filename: null },
      { id: 'filing_fee', label: 'Filing fee check/money order', received: false, filename: null },
      { id: 'questionnaire', label: 'Completed questionnaire', received: true, filename: null },
    ]),
    documents_json: JSON.stringify([
      { id: 'doc-1', label: 'Passport (32 pp)',             sampleAsset: '/samples/priya-passport.jpg' },
      { id: 'doc-2', label: 'I-94 latest entry',            sampleAsset: '/samples/priya-i94.jpg' },
      { id: 'doc-3', label: 'Prior approval notice',        sampleAsset: '/samples/priya-approval-notice.jpg' },
      { id: 'doc-4', label: 'Marriage certificate',         sampleAsset: '/samples/priya-marriage-cert.jpg' },
      { id: 'doc-5', label: 'Utility bill (proof of addr)', sampleAsset: '/samples/priya-utility-bill.jpg' },
    ]),
  });

  // Seed deadlines for Priya
  const dInsert = db.prepare(`
    INSERT INTO deadlines (id, case_id, label, due_date, type)
    VALUES (@id, @case_id, @label, @due_date, @type)
  `);
  dInsert.run({ id: 'd-1', case_id: 'DEP-2026-00482', label: 'Passport Expiry — Priya Subramanian', due_date: '2031-03-18', type: 'passport_expiry' });
  dInsert.run({ id: 'd-2', case_id: 'DEP-2026-00482', label: 'I-94 Authorized Stay Ends', due_date: '2027-08-03', type: 'i94_expiry' });
  dInsert.run({ id: 'd-3', case_id: 'DEP-2026-00482', label: 'I-765 Filing Deadline', due_date: '2026-06-15', type: 'filing_deadline' });
}

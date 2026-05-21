import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const SAMPLES_DIR = join(__dirname, '../../frontend/public/samples');

export const STANDARD_H4_EAD_CHECKLIST = [
  { id: 'passport_bio', label: 'Passport (bio page)', received: false, filename: null },
  { id: 'i94', label: 'I-94 printout', received: false, filename: null },
  { id: 'proof_address', label: 'Proof of address (utility bill)', received: false, filename: null },
  { id: 'spouse_i797', label: 'Spouse I-129 approval notice (I-797)', received: false, filename: null },
  { id: 'spouse_ead', label: 'Spouse EAD (if applicable)', received: false, filename: null },
  { id: 'photos', label: 'Photos (2x2 inch)', received: false, filename: null },
  { id: 'filing_fee', label: 'Filing fee check/money order', received: false, filename: null },
  { id: 'questionnaire', label: 'Completed questionnaire', received: false, filename: null },
];

function withChecklistDefaults(items = []) {
  const byId = new Map(items.map((item) => [item.id, item]));
  return STANDARD_H4_EAD_CHECKLIST.map((item) => ({ ...item, ...(byId.get(item.id) || {}) }));
}

// ─── Matter helpers ───────────────────────────────────────────────────────────

function hydrateMatter(row) {
  if (!row) return null;
  return {
    id: row.id,
    employer: row.employer,
    position: row.position,
    worksite: row.worksite,
    lcaCertified: row.lca_certified,
    status: row.status,
    lcaExtracted: true,
    generatedPdfBase64: row.generated_pdf_b64 ?? null,
    generatedFilename: row.generated_filename ?? null,
    reviewNotes: row.review_notes ?? null,
    submittedAt: row.submitted_at ?? null,
    reviewedAt: row.reviewed_at ?? null,
    reviewedBy: row.reviewed_by ?? null,
    lca: row.lca_json ? JSON.parse(row.lca_json) : [],
    computed: row.computed_json ? JSON.parse(row.computed_json) : [],
  };
}

export function getMatters() {
  return db.prepare('SELECT * FROM matters ORDER BY created_at DESC').all().map(hydrateMatter);
}

export function getMatter(id) {
  return hydrateMatter(db.prepare('SELECT * FROM matters WHERE id = ?').get(id));
}

export function setMatter(id, patch) {
  const colMap = {
    status:            'status',
    generatedPdfBase64: 'generated_pdf_b64',
    generatedFilename:  'generated_filename',
    reviewNotes:       'review_notes',
    submittedAt:       'submitted_at',
    reviewedAt:        'reviewed_at',
    reviewedBy:        'reviewed_by',
    lca:               'lca_json',
    computed:          'computed_json',
  };
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(patch)) {
    const col = colMap[k];
    if (!col) continue;
    sets.push(`${col} = ?`);
    vals.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
  }
  if (!sets.length) return getMatter(id);
  vals.push(id);
  db.prepare(`UPDATE matters SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getMatter(id);
}

export function addMatter(matter) {
  db.prepare(`
    INSERT INTO matters (id, employer, position, worksite, lca_certified, status, lca_json, computed_json)
    VALUES (@id, @employer, @position, @worksite, @lca_certified, @status, @lca_json, @computed_json)
  `).run({
    id: matter.id,
    employer: matter.employer,
    position: matter.position,
    worksite: matter.worksite,
    lca_certified: matter.lcaCertified ?? null,
    status: matter.status ?? 'Ready to generate',
    lca_json: JSON.stringify(matter.lca ?? []),
    computed_json: JSON.stringify(matter.computed ?? []),
  });
}

// ─── Notice helpers ───────────────────────────────────────────────────────────

function hydrateNotice(row) {
  if (!row) return null;
  const fields = row.fields_json ? JSON.parse(row.fields_json) : [];
  const status = row.verified_at
    ? 'Verified'
    : row.manual_review
      ? 'Manual Review'
      : row.extraction_status || 'New';
  return {
    id: row.id,
    file: row.filename,
    mime: row.mime,
    fileB64: row.file_b64,
    sampleAsset: row.sample_asset,
    beneficiary: row.beneficiary,
    petitioner: row.petitioner,
    receiptNumber: row.receipt_number,
    receiptNoticeDate: row.receipt_notice_date,
    receivedOn: row.received_on,
    receiptType: row.receipt_type,
    form: row.government_form,
    serviceCenter: row.service_center,
    statusField: row.status_field,
    priorityDate: row.priority_date,
    extractionStatus: row.extraction_status,
    flags: row.flags,
    manualReview: !!row.manual_review,
    verifiedAt: row.verified_at,
    fields,
    status,
    received: row.created_at,
    record: row.verified_at
      ? 'Saved to case management - record updated'
      : row.manual_review
        ? 'Routed to manual review queue'
        : fields.length
          ? `${row.extraction_status || 'Extracted'} - ${row.flags || 0} flag(s)`
          : 'Uploaded - extraction pending',
  };
}

export function getNotices() {
  return db.prepare('SELECT * FROM notices ORDER BY created_at DESC').all().map(hydrateNotice);
}

export function getNotice(id) {
  return hydrateNotice(db.prepare('SELECT * FROM notices WHERE id = ?').get(id));
}

export function setNotice(id, patch) {
  const colMap = {
    beneficiary:       'beneficiary',
    petitioner:        'petitioner',
    receiptNumber:     'receipt_number',
    receiptNoticeDate: 'receipt_notice_date',
    receivedOn:        'received_on',
    receiptType:       'receipt_type',
    form:              'government_form',
    serviceCenter:     'service_center',
    statusField:       'status_field',
    priorityDate:      'priority_date',
    extractionStatus:  'extraction_status',
    flags:             'flags',
    manualReview:      'manual_review',
    verifiedAt:        'verified_at',
    fields:            'fields_json',
    status:            'extraction_status',
    record:            null,
    extractedProvider: null,
    verifiedFields:    null,
  };
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(patch)) {
    const col = colMap[k];
    if (!col) continue;
    sets.push(`${col} = ?`);
    vals.push(Array.isArray(v) || (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v);
  }
  if (!sets.length) return getNotice(id);
  vals.push(id);
  db.prepare(`UPDATE notices SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getNotice(id);
}

export function addNotice(notice) {
  db.prepare(`
    INSERT INTO notices (id, filename, mime, file_b64, sample_asset, extraction_status, flags, fields_json)
    VALUES (@id, @filename, @mime, @file_b64, @sample_asset, @extraction_status, @flags, @fields_json)
  `).run({
    id: notice.id,
    filename: notice.file ?? notice.filename ?? '',
    mime: notice.mime ?? 'application/octet-stream',
    file_b64: notice.fileB64 ?? null,
    sample_asset: notice.sampleAsset ?? null,
    extraction_status: notice.extractionStatus ?? 'new',
    flags: notice.flags ?? 0,
    fields_json: JSON.stringify(notice.fields ?? []),
  });
}

export function recomputeNoticeFlags(noticeId) {
  const n = getNotice(noticeId);
  if (!n) return;
  const flags = n.fields.filter((f) => f.flagged).length;
  setNotice(noticeId, { flags });
}

// ─── Case helpers ─────────────────────────────────────────────────────────────

function hydrateCase(row) {
  if (!row) return null;
  const checklist = withChecklistDefaults(row.checklist_json ? JSON.parse(row.checklist_json) : []);
  return {
    id: row.id,
    type: row.type,
    applicant: row.applicant,
    primary: row.primary_applicant,
    visaType: row.visa_type,
    intake: row.intake,
    questionnaire: row.questionnaire_json ? JSON.parse(row.questionnaire_json) : {},
    rows: row.rows_json ? JSON.parse(row.rows_json) : [],
    resolved: row.resolved_json ? JSON.parse(row.resolved_json) : {},
    checklist,
    documents: row.documents_json ? JSON.parse(row.documents_json) : [],
    status: row.status,
    createdAt: row.created_at,
  };
}

export function getCases() {
  return db.prepare('SELECT * FROM cases ORDER BY created_at DESC').all().map(hydrateCase);
}

export function getCase(id) {
  if (id) return hydrateCase(db.prepare('SELECT * FROM cases WHERE id = ?').get(id));
  // Legacy: return first case for backward compat
  return hydrateCase(db.prepare('SELECT * FROM cases ORDER BY created_at ASC LIMIT 1').get());
}

export function createCase(data) {
  const id = data.id ?? `DEP-${Date.now().toString().slice(-7)}`;
  const intake = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const checklist = withChecklistDefaults(data.checklist ?? []).map((item) => (
    item.id === 'questionnaire' ? { ...item, received: true } : item
  ));
  db.prepare(`
    INSERT INTO cases (id, type, applicant, primary_applicant, visa_type, intake, questionnaire_json, checklist_json, documents_json)
    VALUES (@id, @type, @applicant, @primary_applicant, @visa_type, @intake, @questionnaire_json, @checklist_json, @documents_json)
  `).run({
    id,
    type: data.type ?? 'Dependent filing',
    applicant: data.applicant,
    primary_applicant: data.primary ?? '',
    visa_type: data.visaType ?? 'H-4 EAD',
    intake,
    questionnaire_json: JSON.stringify(data.questionnaire ?? {}),
    checklist_json: JSON.stringify(checklist),
    documents_json: JSON.stringify([]),
  });

  // Auto-create deadlines from questionnaire dates
  const q = data.questionnaire ?? {};
  if (q['Passport Expiry'] && q['Passport Expiry'] !== 'Not found') {
    db.prepare(`INSERT INTO deadlines (id, case_id, label, due_date, type) VALUES (?, ?, ?, ?, ?)`)
      .run(`dl-${Date.now()}-1`, id, `Passport Expiry — ${data.applicant}`, q['Passport Expiry'], 'passport_expiry');
  }
  if (q['Most Recent Entry Date'] && q['Most Recent Entry Date'] !== 'Not found') {
    // I-94 typically expires 3 years after entry for H-4
    const entry = new Date(q['Most Recent Entry Date']);
    if (!isNaN(entry)) {
      entry.setFullYear(entry.getFullYear() + 3);
      db.prepare(`INSERT INTO deadlines (id, case_id, label, due_date, type) VALUES (?, ?, ?, ?, ?)`)
        .run(`dl-${Date.now()}-2`, id, `I-94 Authorized Stay Ends — ${data.applicant}`, entry.toISOString().split('T')[0], 'i94_expiry');
    }
  }

  return getCase(id);
}

export function getCaseChecklist(caseId) {
  return getCase(caseId)?.checklist ?? [];
}

export function setCaseChecklistItem(caseId, itemId, patch) {
  const c = getCase(caseId);
  if (!c) return null;
  const checklist = withChecklistDefaults(c.checklist).map((item) => (
    item.id === itemId ? { ...item, ...patch } : item
  ));
  db.prepare('UPDATE cases SET checklist_json = ? WHERE id = ?')
    .run(JSON.stringify(checklist), caseId);
  return getCase(caseId);
}

export function setCaseRows(rows, caseId) {
  const id = caseId ?? getCase()?.id;
  if (!id) return;
  db.prepare('UPDATE cases SET rows_json = ?, resolved_json = ? WHERE id = ?')
    .run(JSON.stringify(rows), JSON.stringify({}), id);
}

export function setCaseResolved(field, choice, caseId) {
  const id = caseId ?? getCase()?.id;
  if (!id) return;
  const c = getCase(id);
  if (!c) return;
  const resolved = { ...c.resolved, [field]: choice };
  db.prepare('UPDATE cases SET resolved_json = ? WHERE id = ?')
    .run(JSON.stringify(resolved), id);
}

export function computeCaseCounts(caseId) {
  const c = getCase(caseId ?? getCase()?.id);
  if (!c) return { Error: 0, Review: 0, verified: 0, status: 'Review' };
  const { rows, resolved } = c;
  const Error    = rows.filter((r) => !r.match && r.severity === 'Error'  && !resolved[r.field]).length;
  const Review   = rows.filter((r) => !r.match && r.severity === 'Review' && !resolved[r.field]).length;
  const verified = rows.filter((r) => r.match).length + Object.keys(resolved).length;
  const status   = Error > 0 ? 'Mismatches' : Review > 0 ? 'Needs review' : 'Review';
  return { Error, Review, verified, status };
}

// ─── Deadline helpers ─────────────────────────────────────────────────────────

export function getDeadlines(caseId) {
  if (caseId) {
    return db.prepare('SELECT * FROM deadlines WHERE case_id = ? ORDER BY due_date ASC').all(caseId);
  }
  return db.prepare('SELECT * FROM deadlines ORDER BY due_date ASC').all();
}

export function addDeadline(d) {
  db.prepare(`INSERT INTO deadlines (id, case_id, label, due_date, type) VALUES (@id, @case_id, @label, @due_date, @type)`)
    .run({ id: d.id ?? `dl-${Date.now()}`, case_id: d.caseId ?? null, label: d.label, due_date: d.dueDate, type: d.type ?? 'custom' });
}

export function completeDeadline(id) {
  db.prepare('UPDATE deadlines SET completed = 1 WHERE id = ?').run(id);
}

export function reopenDeadline(id) {
  db.prepare('UPDATE deadlines SET completed = 0 WHERE id = ?').run(id);
}

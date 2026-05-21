import { useState, useEffect, useRef } from 'react';
import {
  FileText, Database, AlertTriangle, CheckCircle2,
  X, ArrowUpRight, Eye, Plus, ArrowLeft, Users, ClipboardCheck, Upload,
} from 'lucide-react';
import { Section } from '../primitives/Section.jsx';
import { StatusPill } from '../primitives/StatusPill.jsx';
import { ConfidenceBadge } from '../primitives/ConfidenceBadge.jsx';
import { uc3 } from '../api.js';

const EMPTY_Q = {
  'Full Legal Name': '',
  'Date of Birth': '',
  'Passport Number': '',
  'Passport Expiry': '',
  'Country of Birth': '',
  'Most Recent Entry Date': '',
  'Visa Class on Entry': '',
  'Current Address': '',
  'USCIS Receipt Number (spouse H-1B)': '',
  'Attorney Email': '',
};

function CaseList({ cases, onSelect, onNew }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">H-4 EAD Cases</h2>
          <p className="text-xs text-slate-500 mt-0.5">{cases.length} case{cases.length !== 1 ? 's' : ''} on file</p>
        </div>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded"
          style={{ backgroundColor: '#204496' }}
        >
          <Plus className="w-3.5 h-3.5" />
          New case
        </button>
      </div>

      {cases.length === 0 ? (
        <div className="py-20 text-center">
          <Users className="w-8 h-8 mx-auto mb-3 text-slate-200" />
          <div className="text-sm text-slate-400">No cases yet</div>
          <div className="text-xs text-slate-300 mt-1">Click "New case" to add your first H-4 EAD applicant</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 max-w-2xl">
          {cases.map((c) => {
            const hasErrors = c.counts?.Error > 0;
            const hasReview = c.counts?.Review > 0;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className="bg-white border border-slate-200/80 rounded-lg p-4 text-left hover:border-slate-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-sm font-semibold text-slate-900 truncate">{c.applicant}</div>
                      <span className="text-[10px] text-slate-400 shrink-0">{c.visaType}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {c.primary ? `Dependent of ${c.primary} · ` : ''}{c.id}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Intake {c.intake ? c.intake.slice(0, 10) : '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {hasErrors && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full ring-1 ring-rose-200">
                        <AlertTriangle className="w-3 h-3" />
                        {c.counts.Error} error{c.counts.Error !== 1 ? 's' : ''}
                      </span>
                    )}
                    {!hasErrors && hasReview && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full ring-1 ring-amber-200">
                        {c.counts.Review} review
                      </span>
                    )}
                    {!hasErrors && !hasReview && c.counts?.verified > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Clean
                      </span>
                    )}
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewCaseForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    applicant: '',
    primary: '',
    visaType: 'H-4 EAD',
    questionnaire: { ...EMPTY_Q },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function setQ(field, value) {
    setForm((f) => ({ ...f, questionnaire: { ...f.questionnaire, [field]: value } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.applicant.trim()) { setError('Applicant name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const { case: c } = await uc3.createCase(form);
      onSave(c);
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full text-xs px-3 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';
  const labelCls = 'block text-[11px] text-slate-500 mb-1 uppercase tracking-wider font-medium';

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onCancel} className="p-1.5 rounded hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </button>
        <div>
          <h2 className="text-base font-semibold text-slate-900">New H-4 EAD Case</h2>
          <p className="text-xs text-slate-500 mt-0.5">Fill in applicant info and questionnaire fields</p>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded bg-rose-50 ring-1 ring-rose-200 text-xs text-rose-700">{error}</div>
      )}

      <div className="bg-white border border-slate-200/80 rounded-lg p-5 space-y-4">
        <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
          Case Details
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Applicant Full Name *</label>
            <input className={inputCls} required value={form.applicant}
              onChange={(e) => setForm((f) => ({ ...f, applicant: e.target.value }))}
              placeholder="e.g. Priya Subramanian" />
          </div>
          <div>
            <label className={labelCls}>Primary Applicant (H-1B holder)</label>
            <input className={inputCls} value={form.primary}
              onChange={(e) => setForm((f) => ({ ...f, primary: e.target.value }))}
              placeholder="e.g. Karthik Subramanian" />
          </div>
          <div>
            <label className={labelCls}>Visa Type</label>
            <select className={inputCls} value={form.visaType}
              onChange={(e) => setForm((f) => ({ ...f, visaType: e.target.value }))}>
              <option>H-4 EAD</option>
              <option>H-4</option>
              <option>L-2 EAD</option>
              <option>I-485 EAD</option>
              <option>OPT EAD</option>
              <option>STEM OPT EAD</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-lg p-5 space-y-4">
        <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
          Questionnaire — Applicant Self-Reported Data
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Object.keys(EMPTY_Q).map((field) => (
            <div key={field}>
              <label className={labelCls}>{field}</label>
              <input
                className={inputCls}
                value={form.questionnaire[field]}
                onChange={(e) => setQ(field, e.target.value)}
                placeholder={
                  field.includes('Date') || field.includes('Expiry') ? 'YYYY-MM-DD'
                  : field === 'Visa Class on Entry' ? 'e.g. H-4'
                  : field === 'Current Address' ? 'Street, City, ST 00000'
                  : ''
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-xs text-slate-600 ring-1 ring-slate-200 rounded hover:ring-slate-300">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-xs font-medium text-white rounded disabled:opacity-40"
          style={{ backgroundColor: '#204496' }}
        >
          {saving ? 'Creating…' : 'Create case'}
        </button>
      </div>
    </form>
  );
}

function CaseDetail({ caseId, onBack }) {
  const [caseData, setCaseData] = useState(null);
  const [counts, setCounts]     = useState({ Error: 0, Review: 0, verified: 0 });
  const [status, setStatus]     = useState('Loading…');
  const [running, setRunning]   = useState(false);
  const [resolving, setResolving] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [checklistSaving, setChecklistSaving] = useState(null);
  const fileInputRef = useRef(null);
  const checklistInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);

  function applyResponse({ case: c, counts: ct, status: st }) {
    setCaseData(c);
    setCounts(ct);
    setStatus(st);
  }

  useEffect(() => {
    uc3.getCase(caseId).then(applyResponse).catch(() => { });
    uc3.getChecklist(caseId).then((d) => setChecklist(d.checklist || [])).catch(() => { });
  }, [caseId]);

  async function updateChecklist(itemId, data) {
    setChecklistSaving(itemId);
    try {
      const { checklist: next } = await uc3.updateChecklistItem(caseId, itemId, data);
      setChecklist(next || []);
    } finally {
      setChecklistSaving(null);
    }
  }

  function handleChecklistUpload(itemId) {
    setUploadTarget(itemId);
    checklistInputRef.current?.click();
  }

  async function handleChecklistFile(e) {
    const file = e.target.files?.[0];
    if (file && uploadTarget) {
      await updateChecklist(uploadTarget, { file, received: true });
    }
    e.target.value = '';
    setUploadTarget(null);
  }

  async function handleRun(file) {
    setRunning(true);
    setError(null);
    try {
      applyResponse(await uc3.runValidation(caseId, file || null));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setRunning(false);
    }
  }

  async function handleResolve(field, choice) {
    setResolving(field);
    try {
      const { resolved, counts: ct, status: st } = await uc3.resolve(caseId, field, choice);
      setCaseData((prev) => ({ ...prev, resolved }));
      setCounts(ct);
      setStatus(st);
    } catch (e) {
      console.error(e);
    } finally {
      setResolving(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const blob = await uc3.save(caseId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Form_I-765_${caseId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Save failed';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const resolved = caseData?.resolved || {};
  const rows = caseData?.rows || [];
  const checklistDone = checklist.filter((item) => item.received).length;

  return (
    <div className="space-y-4">
      {/* Back + case banner */}
      <div className="bg-white border border-slate-200/80 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <button onClick={onBack} className="p-1.5 rounded hover:bg-slate-100 mt-0.5">
              <ArrowLeft className="w-4 h-4 text-slate-500" />
            </button>
            <div>
              {caseData ? (
                <>
                  <div className="flex items-center gap-2">
                    <StatusPill status={status} />
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{caseData.applicant}</div>
                  <div className="text-sm text-slate-500">
                    {caseData.type} · {caseData.primary ? `dependent of ${caseData.primary} · ` : ''}{caseData.id} · intake {caseData.intake?.slice(0, 10)}
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-400">Loading…</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {[
              { label: 'Error',    value: counts.Error,    color: 'text-rose-600' },
              { label: 'Review',   value: counts.Review,   color: 'text-amber-600' },
              { label: 'Verified', value: counts.verified, color: 'text-emerald-600' },
            ].map(({ label, value, color }, i) => (
              <div key={label} className="flex items-center gap-3">
                {i > 0 && <div className="w-px h-8 bg-slate-200" />}
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</div>
                  <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Documents column */}
        <div className="col-span-3 space-y-3">
          <Section title="Uploaded document set" subtitle="Click to preview">
            <div className="space-y-1">
              {(caseData?.documents || []).map((doc) => {
                const active = previewDoc?.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    onClick={() => setPreviewDoc(active ? null : doc)}
                    style={active ? { backgroundColor: '#204496' } : {}}
                    className={`w-full flex items-center gap-2 p-2 rounded-md text-left transition-all ${
                      active ? 'text-white' : doc.sampleAsset ? 'hover:bg-slate-50 cursor-pointer' : 'opacity-50 cursor-default'
                    }`}
                    disabled={!doc.sampleAsset}
                  >
                    <FileText className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                    <span className={`text-xs truncate ${active ? 'text-white' : 'text-slate-700'}`}>{doc.label}</span>
                    {doc.sampleAsset && <Eye className={`w-3 h-3 ml-auto shrink-0 ${active ? 'text-slate-300' : 'text-slate-300'}`} />}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={running}
              className="mt-2 w-full px-3 py-1.5 text-xs font-medium text-white rounded disabled:opacity-40"
              style={{ backgroundColor: '#204496' }}
            >
              Upload document
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => { handleRun(e.target.files?.[0]); e.target.value = ''; }}
            />
          </Section>

          <Section
            title="Document checklist"
            subtitle={`${checklistDone} of ${checklist.length} received`}
          >
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${checklist.length ? (checklistDone / checklist.length) * 100 : 0}%` }}
              />
            </div>
            <div className="space-y-1">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-md border border-slate-100 bg-white p-2">
                  <input
                    type="checkbox"
                    checked={!!item.received}
                    disabled={checklistSaving === item.id}
                    onChange={(e) => updateChecklist(item.id, { received: e.target.checked })}
                    className="rounded"
                  />
                  <ClipboardCheck className={`h-3.5 w-3.5 shrink-0 ${item.received ? 'text-emerald-500' : 'text-slate-300'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-slate-700">{item.label}</div>
                    {item.filename && <div className="truncate text-[10px] text-slate-400">{item.filename}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleChecklistUpload(item.id)}
                    disabled={checklistSaving === item.id}
                    className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40"
                    title="Attach document"
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <input
              ref={checklistInputRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={handleChecklistFile}
            />
          </Section>

          {previewDoc?.sampleAsset && (
            <Section title="Preview" subtitle={previewDoc.label}>
              {previewDoc.sampleAsset.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img src={previewDoc.sampleAsset} alt={previewDoc.label}
                  className="w-full rounded border border-slate-200 object-contain" style={{ maxHeight: '320px' }} />
              ) : (
                <iframe src={previewDoc.sampleAsset} className="w-full rounded border border-slate-200"
                  style={{ height: '320px' }} title={previewDoc.label} />
              )}
            </Section>
          )}
        </div>

        {/* Mismatch report */}
        <div className="col-span-9">
          <Section
            title="AI Cross-Validation"
            subtitle="Questionnaire entries vs. document extractions"
            right={
              <div className="flex gap-2">
                <button
                  onClick={() => handleRun(null)}
                  disabled={running}
                  className="px-3 py-1.5 text-xs font-medium text-white rounded disabled:opacity-40"
                  style={{ backgroundColor: '#204496' }}
                >
                  {running ? 'Validating…' : 'Validate Data'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={counts.Error > 0 || saving}
                  style={counts.Error > 0 || saving ? {} : { backgroundColor: '#204496' }}
                  className={`px-3 py-1.5 text-xs font-medium rounded inline-flex items-center gap-1.5 ${
                    counts.Error > 0 || saving ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'text-white'
                  }`}
                >
                  {saving ? 'Generating…' : 'Generate I-765'}
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            }
          >
            {error && (
              <div className="mb-3 px-3 py-2 rounded bg-rose-50 ring-1 ring-rose-200 text-xs text-rose-700">{error}</div>
            )}

            {rows.length === 0 && !error && (
              <div className="py-12 text-center text-sm text-slate-400">
                Click <span className="font-medium text-slate-600">Validate Data</span> to extract data from the documents and compare against the questionnaire.
              </div>
            )}

            <div className="space-y-1">
              {rows.map((row) => {
                const isResolved  = resolved[row.field];
                const showError   = !row.match && row.severity === 'Error'  && !isResolved;
                const showReview  = !row.match && row.severity === 'Review' && !isResolved;
                const isResolving = resolving === row.field;

                return (
                  <div
                    key={row.field}
                    className={`rounded-md p-3 border ${
                      showError  ? 'border-rose-200 bg-rose-50/40' :
                      showReview ? 'border-amber-200 bg-amber-50/30' :
                      'border-slate-100 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {row.match || isResolved
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            : row.severity === 'Error'
                              ? <X className="w-3.5 h-3.5 text-rose-600" />
                              : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          }
                          <span className="text-sm font-medium text-slate-900">{row.field}</span>
                          <ConfidenceBadge score={row.conf} />
                        </div>
                        <div className="grid grid-cols-2 gap-3 pl-5">
                          <div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Questionnaire</div>
                            <div className="text-xs font-mono text-slate-700 mt-0.5">{row.questionnaire}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">{row.source}</div>
                            <div className="text-xs font-mono text-slate-700 mt-0.5">{row.extracted}</div>
                          </div>
                        </div>
                        {row.note && !isResolved && (
                          <div className={`mt-2 pl-5 text-[11px] ${row.severity === 'Error' ? 'text-rose-700' : 'text-amber-700'}`}>
                            {row.note}
                          </div>
                        )}
                        {isResolved && (
                          <div className="mt-2 pl-5 text-[11px] text-emerald-700 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Resolved · used {isResolved} value
                          </div>
                        )}
                      </div>
                      {!row.match && !isResolved && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            onClick={() => handleResolve(row.field, 'document')}
                            disabled={!!isResolving}
                            className="px-2 py-1 text-[10px] font-medium text-white rounded disabled:opacity-40"
                            style={{ backgroundColor: '#204496' }}
                          >
                            Use doc
                          </button>
                          <button
                            onClick={() => handleResolve(row.field, 'questionnaire')}
                            disabled={!!isResolving}
                            className="px-2 py-1 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300 rounded disabled:opacity-40"
                          >
                            Keep entry
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {rows.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
                  <Database className="w-3 h-3" />
                  Resolutions persist to database
                </div>
                <button
                  onClick={handleSave}
                  disabled={counts.Error > 0 || saving}
                  style={counts.Error > 0 || saving ? {} : { backgroundColor: '#204496' }}
                  className={`px-3 py-1.5 text-xs font-medium rounded inline-flex items-center gap-1.5 ${
                    counts.Error > 0 || saving ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'text-white'
                  }`}
                >
                  {saving ? 'Generating…' : 'Generate I-765'}
                </button>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

export function Uc3CrossValidation({ initialCaseId }) {
  const [view, setView]     = useState(initialCaseId ? 'detail' : 'list'); // 'list' | 'new' | 'detail'
  const [cases, setCases]   = useState([]);
  const [selectedId, setSelectedId] = useState(initialCaseId ?? null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    uc3.listCases()
      .then((d) => setCases(d.cases || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  function handleSelect(id) {
    setSelectedId(id);
    setView('detail');
  }

  function handleNew() { setView('new'); }

  function handleBack() {
    setView('list');
    setSelectedId(null);
    // Refresh list
    uc3.listCases().then((d) => setCases(d.cases || [])).catch(() => { });
  }

  function handleNewSaved(c) {
    setCases((prev) => [c, ...prev]);
    setSelectedId(c.id);
    setView('detail');
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-400">Loading cases…</div>;
  }

  if (view === 'new') {
    return <NewCaseForm onSave={handleNewSaved} onCancel={handleBack} />;
  }

  if (view === 'detail' && selectedId) {
    return <CaseDetail caseId={selectedId} onBack={handleBack} />;
  }

  return <CaseList cases={cases} onSelect={handleSelect} onNew={handleNew} />;
}

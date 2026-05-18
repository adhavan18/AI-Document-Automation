import { useState, useEffect, useRef } from 'react';
import { FileText, Database, AlertTriangle, CheckCircle2, X, ArrowUpRight } from 'lucide-react';
import { Section }         from '../primitives/Section.jsx';
import { StatusPill }      from '../primitives/StatusPill.jsx';
import { ConfidenceBadge } from '../primitives/ConfidenceBadge.jsx';
import { uc3 }            from '../api.js';

export function Uc3CrossValidation() {
  const [caseData,   setCaseData]   = useState(null);
  const [counts,     setCounts]     = useState({ blocking: 0, minor: 0, verified: 0 });
  const [status,     setStatus]     = useState('Loading…');
  const [running,    setRunning]    = useState(false);
  const [resolving,  setResolving]  = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState(null);
  const fileInputRef = useRef(null);

  function applyResponse({ case: c, counts: ct, status: st }) {
    setCaseData(c);
    setCounts(ct);
    setStatus(st);
  }

  useEffect(() => {
    uc3.getCase().then(applyResponse).catch(() => {});
  }, []);

  async function handleRun(file) {
    setRunning(true);
    setError(null);
    try {
      applyResponse(await uc3.runValidation(file || null));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setRunning(false);
    }
  }

  async function handleResolve(field, choice) {
    setResolving(field);
    try {
      const { resolved, counts: ct, status: st } = await uc3.resolve(field, choice);
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
      const blob = await uc3.save();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `Application_${caseData?.id || 'form'}.pdf`;
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-4">
        {/* Case summary */}
        <div className="col-span-12">
          <div className="bg-white border border-slate-200/80 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                {caseData ? (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-slate-400">{caseData.id}</span>
                      <StatusPill status={status} />
                    </div>
                    <div className="mt-1.5 text-lg font-semibold text-slate-900">{caseData.applicant}</div>
                    <div className="text-sm text-slate-500">
                      {caseData.type} · dependent of {caseData.primary} · intake {caseData.intake}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-400">Loading case…</div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex gap-4">
                  {[
                    { label: 'Blocking', value: counts.blocking, color: 'text-rose-600' },
                    { label: 'Minor',    value: counts.minor,    color: 'text-amber-600' },
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
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={running}
                    className="px-3 py-1.5 text-xs font-medium rounded ring-1 ring-slate-200 hover:ring-slate-300 text-slate-600 disabled:opacity-40 whitespace-nowrap"
                  >
                    Upload passport
                  </button>
                  <button
                    onClick={() => handleRun(null)}
                    disabled={running}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded disabled:opacity-40 whitespace-nowrap"
                  >
                    {running ? 'Validating…' : 'Run cross-validation'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => { handleRun(e.target.files?.[0]); e.target.value = ''; }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Documents column */}
        <div className="col-span-3">
          <Section title="Uploaded document set" subtitle="Source of truth">
            <div className="space-y-2">
              {(caseData?.documents || []).map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-50 cursor-pointer">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-700 truncate">{doc.label}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Mismatch report */}
        <div className="col-span-9">
          <Section
            title="Cross-validation report"
            subtitle="Questionnaire entries vs. document extractions"
            right={
              counts.blocking > 0 && (
                <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-1 rounded ring-1 ring-rose-200">
                  <AlertTriangle className="w-3 h-3" />
                  Form save blocked until resolved
                </div>
              )
            }
          >
            {error && (
              <div className="mb-3 px-3 py-2 rounded bg-rose-50 ring-1 ring-rose-200 text-xs text-rose-700">{error}</div>
            )}

            <div className="space-y-1">
              {(caseData?.rows || []).map((row) => {
                const isResolved   = resolved[row.field];
                const showBlocking = !row.match && row.severity === 'blocking' && !isResolved;
                const showMinor    = !row.match && row.severity === 'minor'    && !isResolved;
                const isResolving  = resolving === row.field;

                return (
                  <div
                    key={row.field}
                    className={`rounded-md p-3 border ${
                      showBlocking
                        ? 'border-rose-200 bg-rose-50/40'
                        : showMinor
                          ? 'border-amber-200 bg-amber-50/30'
                          : 'border-slate-100 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {row.match || isResolved ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : row.severity === 'blocking' ? (
                            <X className="w-3.5 h-3.5 text-rose-600" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          )}
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
                          <div className={`mt-2 pl-5 text-[11px] ${row.severity === 'blocking' ? 'text-rose-700' : 'text-amber-700'}`}>
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
                            className="px-2 py-1 text-[10px] font-medium text-white bg-slate-900 hover:bg-slate-800 rounded whitespace-nowrap disabled:opacity-40"
                          >
                            Use doc
                          </button>
                          <button
                            onClick={() => handleResolve(row.field, 'questionnaire')}
                            disabled={!!isResolving}
                            className="px-2 py-1 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300 rounded whitespace-nowrap disabled:opacity-40"
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

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
                <Database className="w-3 h-3" />
                Resolutions write back to CMS database via form fields
              </div>
              <button
                onClick={handleSave}
                disabled={counts.blocking > 0 || saving}
                className={`px-3 py-1.5 text-xs font-medium rounded inline-flex items-center gap-1.5 ${
                  counts.blocking > 0 || saving
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {saving ? 'Generating…' : 'Save & generate application form'}
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

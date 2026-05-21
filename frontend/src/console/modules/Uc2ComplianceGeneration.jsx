import { useState, useEffect, useRef } from 'react';
import {
  Upload, FileText, Activity, CheckCircle2, Sparkles,
  AlertTriangle, Send, MessageSquare, RotateCcw,
} from 'lucide-react';
import { Section } from '../primitives/Section.jsx';
import { StatusPill } from '../primitives/StatusPill.jsx';
import { ConfidenceBadge } from '../primitives/ConfidenceBadge.jsx';
import { uc2, pdfBlobUrl } from '../api.js';

function fmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

export function Uc2ComplianceGeneration({ search = '', session, initialMatterId = null }) {
  const [matters, setMatters]     = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail]       = useState(null);
  const [pdfUrl, setPdfUrl]       = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]         = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [showNotesInput, setShowNotesInput] = useState(false);
  const fileInputRef = useRef(null);

  const isAttorney = session?.role === 'Senior Attorney';

  useEffect(() => {
    uc2.listMatters().then((d) => {
      setMatters(d.matters);
      if (initialMatterId) setSelectedId(initialMatterId);
      else if (d.matters.length > 0) setSelectedId(d.matters[0].id);
    }).catch(() => { });
  }, [initialMatterId]);

  useEffect(() => {
    if (!selectedId) return;
    setPdfUrl(null);
    setError(null);
    setShowNotesInput(false);
    setReviewNotes('');
    uc2.getMatter(selectedId).then((d) => {
      setDetail(d.matter);
      if (d.matter.generatedPdfBase64) setPdfUrl(pdfBlobUrl(d.matter.generatedPdfBase64));
    }).catch(() => { });
  }, [selectedId]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { matter } = await uc2.uploadLca(file);
      setMatters((prev) => [...prev, matter]);
      setSelectedId(matter.id);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleGenerate() {
    if (!selectedId) return;
    setGenerating(true);
    setError(null);
    try {
      const data = await uc2.generate(selectedId);
      setPdfUrl(pdfBlobUrl(data.pdfBase64));
      const { matter } = await uc2.getMatter(selectedId);
      setDetail(matter);
      setMatters((prev) => prev.map((m) => m.id === matter.id ? { ...m, status: matter.status } : m));
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmitReview() {
    setActionLoading(true);
    try {
      const { matter } = await uc2.submitReview(selectedId);
      setDetail(matter);
      setMatters((prev) => prev.map((m) => m.id === matter.id ? { ...m, status: matter.status } : m));
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove() {
    setActionLoading(true);
    try {
      const { matter } = await uc2.approve(selectedId, { notes: reviewNotes || undefined, reviewedBy: session?.name });
      setDetail(matter);
      setMatters((prev) => prev.map((m) => m.id === matter.id ? { ...m, status: matter.status } : m));
      setShowNotesInput(false);
      setReviewNotes('');
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRequestChanges() {
    if (!reviewNotes.trim()) { setShowNotesInput(true); return; }
    setActionLoading(true);
    try {
      const { matter } = await uc2.requestChanges(selectedId, { notes: reviewNotes, reviewedBy: session?.name });
      setDetail(matter);
      setMatters((prev) => prev.map((m) => m.id === matter.id ? { ...m, status: matter.status } : m));
      setShowNotesInput(false);
      setReviewNotes('');
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  }

  const q = search.toLowerCase();
  const filtered = q
    ? matters.filter((m) =>
        m.employer?.toLowerCase().includes(q) ||
        m.position?.toLowerCase().includes(q) ||
        m.worksite?.toLowerCase().includes(q)
      )
    : matters;

  const status = detail?.status;
  const generated = (status === 'Generated' || status === 'Approved' || status === 'Pending Review' || status === 'Changes Requested') && !!pdfUrl;
  const approved = status === 'Approved';
  const pendingReview = status === 'Pending Review';
  const changesRequested = status === 'Changes Requested';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-4">

        {/* Left — upload + matters list */}
        <div className="col-span-4 space-y-3">
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              uploading ? 'border-slate-300 bg-slate-50 cursor-wait'
                        : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50 cursor-pointer'
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleUpload} />
            <Upload className={`w-5 h-5 mx-auto mb-2 ${uploading ? 'text-slate-300 animate-pulse' : 'text-slate-400'}`} />
            <div className="text-sm font-medium text-slate-700">
              {uploading ? 'Extracting LCA…' : 'Upload LCA Document'}
            </div>
            <div className="text-xs text-slate-400 mt-1">PDF or image · click to browse</div>
          </div>

          {error && (
            <div className="px-3 py-2 rounded bg-rose-50 ring-1 ring-rose-200 text-xs text-rose-700">{error}</div>
          )}

          {matters.length > 0 && (
            <Section title="Matters" subtitle={q ? `${filtered.length} of ${matters.length} match` : 'LCA extracted · ready for PAF generation'}>
              <div className="space-y-1.5">
                {filtered.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full text-left p-3 rounded-md border transition-all ${
                      selectedId === m.id ? 'border-slate-900 bg-slate-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <StatusPill status={m.status} />
                    </div>
                    <div className="text-sm font-medium text-slate-900 truncate">{m.employer}</div>
                    <div className="text-xs text-slate-500 truncate">{m.position}</div>
                    {m.lcaCertified && (
                      <div className="text-[10px] text-slate-400 mt-1">LCA from {m.lcaCertified}</div>
                    )}
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Right — detail + review workflow */}
        <div className="col-span-8 space-y-4">
          {detail ? (
            <>
              {/* Attorney notes banner */}
              {changesRequested && detail.reviewNotes && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-amber-800">Changes requested by {detail.reviewedBy}</div>
                      <div className="text-xs text-amber-700 mt-1">{detail.reviewNotes}</div>
                    </div>
                  </div>
                </div>
              )}

              {approved && detail.reviewNotes && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-emerald-800">
                        Approved by {detail.reviewedBy} on {fmtDate(detail.reviewedAt)}
                      </div>
                      <div className="text-xs text-emerald-700 mt-1">{detail.reviewNotes}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Extracted fields */}
              <Section
                title="Extracted from LCA"
                subtitle={`${detail.employer} · ${detail.position} · ${detail.worksite}`}
                right={
                  !approved && (
                    <button
                      onClick={handleGenerate}
                      disabled={generating || !detail.lcaExtracted}
                      style={generating || !detail.lcaExtracted ? {} : { backgroundColor: '#204496' }}
                      className={`px-3 py-1.5 text-xs font-medium rounded inline-flex items-center gap-1.5 ${
                        generating || !detail.lcaExtracted ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'text-white'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      {generating ? 'Generating…' : generated ? 'Regenerate' : 'Generate PAF'}
                    </button>
                  )
                }
              >
                {!detail.lcaExtracted ? (
                  <div className="py-10 text-center text-sm text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Upload an LCA document to extract fields and generate the PAF
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-3">
                        <FileText className="w-3 h-3" />
                        LCA fields
                      </div>
                      <div className="space-y-2">
                        {(detail.lca || []).map((f) => (
                          <div key={f.label}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[10px] text-slate-400">{f.label}</div>
                              <ConfidenceBadge score={f.conf} />
                            </div>
                            <div className="text-xs font-mono text-slate-800">{f.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-3">
                        <Activity className="w-3 h-3" />
                        Computed
                      </div>
                      <div className="space-y-2">
                        {(detail.computed || []).map((f) => (
                          <div key={f.label}>
                            <div className="text-[10px] text-slate-400">{f.label}</div>
                            <div className="text-xs font-mono text-slate-800">{f.value}</div>
                            <div className="text-[9px] text-slate-400 italic mt-0.5">{f.source}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Section>

              {/* PDF preview + review actions */}
              <Section
                title="Public Access File"
                subtitle={
                  generated
                    ? `${detail.employer?.replace(/[^a-zA-Z0-9]/g, '_')}.pdf · ${
                        approved ? `Approved by ${detail.reviewedBy}` :
                        pendingReview ? 'Awaiting attorney review' :
                        changesRequested ? 'Changes requested' :
                        'Ready for review'
                      }`
                    : 'Awaiting generation'
                }
                right={
                  generated && !approved && (
                    <div className="flex items-center gap-2">
                      {/* Paralegal: submit for review */}
                      {!isAttorney && !pendingReview && !changesRequested && (
                        <button
                          onClick={handleSubmitReview}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs font-medium text-white rounded inline-flex items-center gap-1.5 disabled:opacity-40"
                          style={{ backgroundColor: '#204496' }}
                        >
                          <Send className="w-3 h-3" />
                          {actionLoading ? 'Submitting…' : 'Submit for review'}
                        </button>
                      )}
                      {!isAttorney && changesRequested && (
                        <button
                          onClick={handleGenerate}
                          disabled={generating}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 rounded inline-flex items-center gap-1.5 disabled:opacity-40 hover:ring-slate-300"
                        >
                          <RotateCcw className="w-3 h-3" />
                          {generating ? 'Regenerating…' : 'Regenerate & resubmit'}
                        </button>
                      )}

                      {/* Attorney: approve or request changes */}
                      {isAttorney && (pendingReview || status === 'Generated') && (
                        <>
                          <button
                            onClick={() => setShowNotesInput(!showNotesInput)}
                            className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200 hover:ring-amber-300 rounded inline-flex items-center gap-1.5"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Request changes
                          </button>
                          <button
                            onClick={handleApprove}
                            disabled={actionLoading}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded inline-flex items-center gap-1.5 disabled:opacity-40"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {actionLoading ? 'Approving…' : 'Approve'}
                          </button>
                        </>
                      )}
                    </div>
                  )
                }
              >
                {/* Notes input (attorney) */}
                {showNotesInput && isAttorney && (
                  <div className="mb-3 space-y-2">
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Describe the changes needed…"
                      rows={3}
                      className="w-full text-xs px-3 py-2 border border-amber-200 rounded focus:outline-none focus:ring-2 focus:ring-amber-300/30 resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setShowNotesInput(false)} className="px-3 py-1 text-xs text-slate-500 ring-1 ring-slate-200 rounded hover:ring-slate-300">Cancel</button>
                      <button
                        onClick={handleRequestChanges}
                        disabled={actionLoading || !reviewNotes.trim()}
                        className="px-3 py-1 text-xs font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200 hover:ring-amber-300 rounded disabled:opacity-40"
                      >
                        {actionLoading ? 'Sending…' : 'Send feedback'}
                      </button>
                    </div>
                  </div>
                )}

                {generated && pdfUrl ? (
                  <div className="space-y-3">
                    <iframe
                      src={pdfUrl}
                      className="w-full rounded border border-slate-200"
                      style={{ height: '480px' }}
                      title="PAF preview"
                    />
                    <div className="flex justify-end">
                      <a
                        href={pdfUrl}
                        download={`Public_Access_File_${detail.employer?.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300 rounded"
                      >
                        Download PDF
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-slate-400">
                    {generating ? (
                      <span className="text-slate-500">Generating PDF…</span>
                    ) : detail.lcaExtracted ? (
                      <>Click <span className="font-medium text-slate-600">{generated ? 'Regenerate' : 'Generate PAF'}</span> to assemble the public access file</>
                    ) : (
                      'Upload an LCA document first'
                    )}
                  </div>
                )}
              </Section>
            </>
          ) : (
            <div className="py-24 text-center text-sm text-slate-400">
              Upload an LCA to create a matter, or select one from the list
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

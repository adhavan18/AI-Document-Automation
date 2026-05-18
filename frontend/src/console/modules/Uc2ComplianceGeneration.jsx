import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Activity, CheckCircle2, Sparkles, AlertTriangle } from 'lucide-react';
import { Section }         from '../primitives/Section.jsx';
import { StatusPill }      from '../primitives/StatusPill.jsx';
import { ConfidenceBadge } from '../primitives/ConfidenceBadge.jsx';
import { uc2, pdfBlobUrl } from '../api.js';

export function Uc2ComplianceGeneration({ search = '' }) {
  const [matters,    setMatters]    = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail,     setDetail]     = useState(null);
  const [pdfUrl,     setPdfUrl]     = useState(null);
  const [uploading,  setUploading]  = useState(false);
  const [generating, setGenerating] = useState(false);
  const [approving,  setApproving]  = useState(false);
  const [error,      setError]      = useState(null);
  const fileInputRef = useRef(null);

  // Load seeded matters on mount
  useEffect(() => {
    uc2.listMatters().then((d) => {
      setMatters(d.matters);
      if (d.matters.length > 0) setSelectedId(d.matters[0].id);
    }).catch(() => {});
  }, []);

  // Load detail when selection changes
  useEffect(() => {
    if (!selectedId) return;
    setPdfUrl(null);
    setError(null);
    uc2.getMatter(selectedId).then((d) => {
      setDetail(d.matter);
      if (d.matter.generatedPdfBase64) setPdfUrl(pdfBlobUrl(d.matter.generatedPdfBase64));
    }).catch(() => {});
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

  async function handleApprove() {
    if (!selectedId) return;
    setApproving(true);
    try {
      const { matter } = await uc2.approve(selectedId);
      setDetail(matter);
      setMatters((prev) => prev.map((m) => m.id === matter.id ? { ...m, status: matter.status } : m));
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setApproving(false);
    }
  }

  const q          = search.toLowerCase();
  const filtered   = q
    ? matters.filter((m) =>
        m.employer?.toLowerCase().includes(q) ||
        m.position?.toLowerCase().includes(q) ||
        m.worksite?.toLowerCase().includes(q)
      )
    : matters;

  const generated = (detail?.status === 'Generated' || detail?.status === 'Approved') && !!pdfUrl;
  const approved  = detail?.status === 'Approved';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-4">

        {/* Left — upload + matters list */}
        <div className="col-span-4 space-y-3">

          {/* Drop zone */}
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              uploading
                ? 'border-slate-300 bg-slate-50 cursor-wait'
                : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50 cursor-pointer'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <Upload className={`w-5 h-5 mx-auto mb-2 ${uploading ? 'text-slate-300 animate-pulse' : 'text-slate-400'}`} />
            <div className="text-sm font-medium text-slate-700">
              {uploading ? 'Extracting LCA…' : 'Upload LCA Document'}
            </div>
            <div className="text-xs text-slate-400 mt-1">PDF or image · click to browse</div>
          </div>

          {error && (
            <div className="px-3 py-2 rounded bg-rose-50 ring-1 ring-rose-200 text-xs text-rose-700">{error}</div>
          )}

          {/* Matters list */}
          {matters.length > 0 && (
            <Section title="Matters" subtitle={q ? `${filtered.length} of ${matters.length} match` : 'LCA extracted · ready for I-129 petition'}>
              <div className="space-y-1.5">
                {filtered.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full text-left p-3 rounded-md border transition-all ${
                      selectedId === m.id
                        ? 'border-slate-900 bg-slate-50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
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

        {/* Right — detail + generate */}
        <div className="col-span-8 space-y-4">
          {detail ? (
            <>
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
                        generating || !detail.lcaExtracted
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'text-white'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      {generating ? 'Generating…' : generated ? 'Regenerate' : 'Generate I-129'}
                    </button>
                  )
                }
              >
                {!detail.lcaExtracted ? (
                  <div className="py-10 text-center text-sm text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Upload an LCA document to extract fields and generate the I-129 petition
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-6">
                    {/* LCA fields */}
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

                    {/* Computed */}
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

              {/* PDF preview */}
              <Section
                title="Form I-129 preview"
                subtitle={generated ? `Form_I-129_${detail.employer?.replace(/[^a-zA-Z0-9]/g, '_')}.pdf · ready for review` : 'Awaiting generation'}
                right={
                  generated && !approved && (
                    <button
                      onClick={handleApprove}
                      disabled={approving}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded inline-flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {approving ? 'Approving…' : 'Approve'}
                    </button>
                  )
                }
              >
                {generated && pdfUrl ? (
                  <div className="space-y-3">
                    <iframe
                      src={pdfUrl}
                      className="w-full rounded border border-slate-200"
                      style={{ height: '480px' }}
                      title="Form I-129 preview"
                    />
                    <div className="flex justify-end">
                      <a
                        href={pdfUrl}
                        download={`Form_I-129_${detail.employer?.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`}
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
                      <>Click <span className="font-medium text-slate-600">
                        {generated ? 'Regenerate' : 'Generate I-129'}
                      </span> to assemble the petition</>
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

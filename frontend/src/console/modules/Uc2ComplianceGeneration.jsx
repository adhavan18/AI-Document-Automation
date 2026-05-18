import { useState, useEffect, useRef } from 'react';
import { Database, FileText, Activity, FolderOpen, Sparkles, CheckCircle2 } from 'lucide-react';
import { Section }         from '../primitives/Section.jsx';
import { StatusPill }      from '../primitives/StatusPill.jsx';
import { ConfidenceBadge } from '../primitives/ConfidenceBadge.jsx';
import { uc2, pdfBlobUrl } from '../api.js';

export function Uc2ComplianceGeneration({ search }) {
  const [matters,      setMatters]     = useState([]);
  const [selectedId,   setSelectedId]  = useState(null);
  const [detail,       setDetail]      = useState(null);
  const [pdfUrl,       setPdfUrl]      = useState(null);
  const [extracting,   setExtracting]  = useState(false);
  const [generating,   setGenerating]  = useState(false);
  const [approving,    setApproving]   = useState(false);
  const [error,        setError]       = useState(null);
  const lcaFileRef = useRef(null);

  useEffect(() => {
    uc2.listMatters().then((d) => {
      setMatters(d.matters);
      if (d.matters.length > 0) setSelectedId(d.matters[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setPdfUrl(null);
    setError(null);
    uc2.getMatter(selectedId).then((d) => {
      setDetail(d.matter);
      if (d.matter.generatedPdfBase64) {
        setPdfUrl(pdfBlobUrl(d.matter.generatedPdfBase64));
      }
    }).catch(() => {});
  }, [selectedId]);

  const filtered = search
    ? matters.filter((m) =>
        [m.id, m.employer, m.position, m.worksite]
          .some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : matters;

  const generated = detail?.status === 'Generated' || detail?.status === 'Approved';

  async function handleExtractLca(file) {
    if (!selectedId) return;
    setExtracting(true);
    setError(null);
    try {
      const { matter } = await uc2.extractLca(selectedId, file || null);
      setDetail(matter);
      setMatters((prev) => prev.map((m) => m.id === matter.id ? { ...m, lcaExtracted: matter.lcaExtracted } : m));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setExtracting(false);
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
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
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
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-4">
        {/* Matter list */}
        <div className="col-span-4">
          <Section title="Matters · LCA certified" subtitle="Ready for compliance file generation">
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
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-mono text-slate-400">{m.id}</span>
                    <StatusPill status={m.status} />
                  </div>
                  <div className="text-sm font-medium text-slate-900 truncate">{m.employer}</div>
                  <div className="text-xs text-slate-500 truncate">{m.position}</div>
                  <div className="text-[10px] text-slate-400 mt-1">LCA certified {m.lcaCertified}</div>
                </button>
              ))}
            </div>
          </Section>
        </div>

        {/* Binding + generation */}
        <div className="col-span-8 space-y-4">
          {detail ? (
            <>
              <Section
                title="Data binding · sources"
                subtitle="Fields resolved from CMS, LCA PDF, and computation"
                right={
                  <div className="flex items-center gap-2">
                    {!detail.lcaExtracted && (
                      <>
                        <button
                          onClick={() => lcaFileRef.current?.click()}
                          disabled={extracting}
                          className="px-3 py-1.5 text-xs font-medium rounded ring-1 ring-slate-200 hover:ring-slate-300 text-slate-600 disabled:opacity-40"
                        >
                          {extracting ? 'Extracting…' : 'Extract LCA'}
                        </button>
                        <input
                          ref={lcaFileRef}
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={(e) => { handleExtractLca(e.target.files?.[0]); e.target.value = ''; }}
                        />
                      </>
                    )}
                    <button
                      onClick={handleGenerate}
                      disabled={generated || generating}
                      className={`px-3 py-1.5 text-xs font-medium rounded inline-flex items-center gap-1.5 ${
                        generated || generating
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      {generating ? 'Generating…' : generated ? 'Generated' : 'Generate compliance file'}
                    </button>
                  </div>
                }
              >
                {error && (
                  <div className="mb-3 px-3 py-2 rounded bg-rose-50 ring-1 ring-rose-200 text-xs text-rose-700">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  {/* CMS */}
                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-2">
                      <Database className="w-3 h-3" />
                      CMS database
                    </div>
                    <div className="space-y-1.5">
                      {(detail.cms || []).map((f) => (
                        <div key={f.label}>
                          <div className="text-[10px] text-slate-400">{f.label}</div>
                          <div className="text-xs font-mono text-slate-800">{f.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* LCA */}
                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-2">
                      <FileText className="w-3 h-3" />
                      Doc AI · LCA PDF
                    </div>
                    {detail.lca?.length > 0 ? (
                      <div className="space-y-1.5">
                        {detail.lca.map((f) => (
                          <div key={f.label}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[10px] text-slate-400">{f.label}</div>
                              <ConfidenceBadge score={f.conf} />
                            </div>
                            <div className="text-xs font-mono text-slate-800">{f.value}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">
                        Click "Extract LCA" to run AI extraction, or use a sample.
                      </div>
                    )}
                  </div>

                  {/* Computed */}
                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-2">
                      <Activity className="w-3 h-3" />
                      Computed
                    </div>
                    <div className="space-y-1.5">
                      {(detail.computed || []).map((f) => (
                        <div key={f.label}>
                          <div className="text-[10px] text-slate-400">{f.label}</div>
                          <div className="text-xs font-mono text-slate-800">{f.value}</div>
                          <div className="text-[9px] text-slate-400 italic mt-0.5">{f.source}</div>
                        </div>
                      ))}
                    </div>
                    {detail.inserts && (
                      <div className="mt-4 p-2 bg-violet-50/50 ring-1 ring-violet-100 rounded-md">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-violet-700 uppercase tracking-[0.08em] mb-1">
                          <FolderOpen className="w-3 h-3" />
                          Inserts
                        </div>
                        <div className="text-[11px] text-violet-900 leading-relaxed">{detail.inserts}</div>
                      </div>
                    )}
                  </div>
                </div>
              </Section>

              {/* Document preview */}
              <Section
                title="Generated document preview"
                subtitle={generated ? `Compliance_File_${detail.id}.pdf · ready for review` : 'Awaiting generation'}
                right={
                  generated && detail.status !== 'Approved' && (
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
                      title="Compliance file preview"
                    />
                    <div className="flex justify-end">
                      <a
                        href={pdfUrl}
                        download={`Compliance_File_${detail.id}.pdf`}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300 rounded"
                      >
                        Download PDF
                      </a>
                    </div>
                  </div>
                ) : generated ? (
                  <div className="py-8 text-center text-sm text-slate-400">Loading preview…</div>
                ) : (
                  <div className="py-12 text-center text-sm text-slate-400">
                    Click <span className="font-medium text-slate-600">Generate compliance file</span> to assemble the document
                  </div>
                )}
              </Section>
            </>
          ) : (
            <div className="py-16 text-center text-sm text-slate-400">Select a matter to view data binding</div>
          )}
        </div>
      </div>
    </div>
  );
}

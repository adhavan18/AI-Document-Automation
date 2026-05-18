import { useState, useEffect, useRef } from 'react';
import { Activity, Eye, FolderOpen, CheckCircle2, Clock, Mail, Flag, FileText } from 'lucide-react';
import { Section }        from '../primitives/Section.jsx';
import { StatusPill }     from '../primitives/StatusPill.jsx';
import { FieldRow }       from '../primitives/FieldRow.jsx';
import { uc1 }           from '../api.js';
import { useAsync }      from '../useAsync.js';

export function Uc1NoticeIngestion({ search }) {
  const [notices,     setNotices]     = useState([]);
  const [stats,       setStats]       = useState([]);
  const [selectedId,  setSelectedId]  = useState(null);
  const [extracting,  setExtracting]  = useState(false);
  const [mutating,    setMutating]    = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    uc1.getStats().then((d) => setStats(d.stats)).catch(() => {});
    uc1.listNotices().then((d) => {
      setNotices(d.notices);
      if (!selectedId && d.notices.length > 0) setSelectedId(d.notices[0].id);
    }).catch(() => {});
  }, []);

  const selected = notices.find((n) => n.id === selectedId);

  const filtered = search
    ? notices.filter((n) =>
        [n.id, n.beneficiary, n.petitioner, n.file, n.matter]
          .some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : notices;

  async function handleExtract(id) {
    setExtracting(true);
    try {
      const { notice } = await uc1.extract(id);
      setNotices((prev) => prev.map((n) => (n.id === id ? notice : n)));
    } catch (e) {
      console.error(e);
    } finally {
      setExtracting(false);
    }
  }

  async function handleVerify(id) {
    setMutating(true);
    try {
      const { notice } = await uc1.verify(id);
      setNotices((prev) => prev.map((n) => (n.id === id ? notice : n)));
    } finally {
      setMutating(false);
    }
  }

  async function handleRouteManual(id) {
    setMutating(true);
    try {
      const { notice } = await uc1.routeManual(id);
      setNotices((prev) => prev.map((n) => (n.id === id ? notice : n)));
    } finally {
      setMutating(false);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { notice } = await uc1.uploadNotice(fd);
      setNotices((prev) => [...prev, notice]);
      setSelectedId(notice.id);
    } catch (err) {
      console.error(err);
    }
    e.target.value = '';
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-slate-200/80 rounded-lg p-3">
            <div className="text-[10px] text-slate-500 uppercase tracking-[0.08em] font-semibold">{s.label}</div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <div className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">{s.value}</div>
              <div className="text-[11px] text-slate-500">{s.delta}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Queue */}
        <div className="col-span-5">
          <Section
            title="Inbound notice queue"
            subtitle="Files dropped on the network drive · auto-classified"
            right={
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Activity className="w-3 h-3" />
                  live
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] text-slate-600 hover:text-slate-900 px-2 py-1 rounded ring-1 ring-slate-200 hover:ring-slate-300"
                >
                  + Upload
                </button>
                <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleUpload} />
              </div>
            }
          >
            <div className="space-y-1.5">
              {filtered.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelectedId(n.id)}
                  className={`w-full text-left p-3 rounded-md border transition-all ${
                    selectedId === n.id
                      ? 'border-slate-900 bg-slate-50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-400">{n.id}</span>
                        <StatusPill status={n.status} />
                        {n.flags > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700">
                            <Flag className="w-2.5 h-2.5" />{n.flags}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 text-sm font-medium text-slate-900 truncate">{n.beneficiary}</div>
                      <div className="text-xs text-slate-500 truncate">{n.petitioner} · {n.form}</div>
                      <div className="mt-1 text-[10px] text-slate-400 font-mono truncate">{n.file}</div>
                    </div>
                    <div className="text-[10px] text-slate-400 whitespace-nowrap">{n.received}</div>
                  </div>
                </button>
              ))}
            </div>
          </Section>
        </div>

        {/* Detail */}
        <div className="col-span-7 space-y-4">
          {selected ? (
            <>
              <Section
                title={`Record · ${selected.id}`}
                subtitle={selected.record}
                right={
                  <div className="flex items-center gap-2">
                    {selected.sampleAsset && (
                      <a
                        href={selected.sampleAsset}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 px-2 py-1 rounded ring-1 ring-slate-200 hover:ring-slate-300"
                      >
                        <Eye className="w-3 h-3" />
                        View PDF
                      </a>
                    )}
                    <StatusPill status={selected.status} />
                  </div>
                }
              >
                {selected.fields.length > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Matter</div>
                        <div className="font-mono text-slate-700 mt-0.5">{selected.matter}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Beneficiary</div>
                        <div className="text-slate-700 mt-0.5">{selected.beneficiary}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Petitioner</div>
                        <div className="text-slate-700 mt-0.5">{selected.petitioner}</div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-2">
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1 px-2">
                        Extracted fields
                      </div>
                      {selected.fields.map((f) => (
                        <FieldRow key={f.label} label={f.label} value={f.value} confidence={f.conf} flagged={f.flagged} />
                      ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
                        <FolderOpen className="w-3 h-3" />
                        Auto-copied to SharePoint matter folder
                      </div>
                      <div className="flex gap-2">
                        <button
                          disabled={mutating}
                          onClick={() => handleRouteManual(selected.id)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded ring-1 ring-slate-200 hover:ring-slate-300 disabled:opacity-40"
                        >
                          Route to manual
                        </button>
                        <button
                          disabled={mutating}
                          onClick={() => handleVerify(selected.id)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded inline-flex items-center gap-1.5 disabled:opacity-40"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Verify &amp; save
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-12 text-center text-sm text-slate-400">
                    {selected.status === 'Verified' ? (
                      <div className="inline-flex items-center gap-2 text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                        Record verified and saved to case management
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 text-slate-400">
                          <Clock className="w-4 h-4" />
                          Awaiting extraction
                        </div>
                        <div>
                          <button
                            disabled={extracting}
                            onClick={() => handleExtract(selected.id)}
                            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded inline-flex items-center gap-2 disabled:opacity-40"
                          >
                            {extracting ? (
                              <>
                                <Clock className="w-3 h-3 animate-pulse" />
                                Extracting via AI…
                              </>
                            ) : (
                              'Extract now'
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Section>

              {/* Inline document preview */}
              {selected.sampleAsset && (
                <Section
                  title="Document preview"
                  subtitle={selected.file}
                  right={
                    <a
                      href={selected.sampleAsset}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Open full
                    </a>
                  }
                >
                  <iframe
                    src={selected.sampleAsset}
                    className="w-full rounded border border-slate-200"
                    style={{ height: '340px' }}
                    title={selected.file}
                  />
                </Section>
              )}

              <Section title="Phase 2 — Email pre-staging" subtitle="Manual today">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" />
                    Draft client email — workflow trigger deferred to Phase 2 SOW
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">Out of pilot</span>
                </div>
              </Section>
            </>
          ) : (
            <div className="py-16 text-center text-sm text-slate-400">Select a notice to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}

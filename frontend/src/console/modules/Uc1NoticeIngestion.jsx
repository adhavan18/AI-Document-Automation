import { useEffect, useState, useRef } from 'react';
import { Eye, FolderOpen, CheckCircle2, Clock, Flag, Upload, RefreshCcw } from 'lucide-react';
import { Section } from '../primitives/Section.jsx';
import { StatusPill } from '../primitives/StatusPill.jsx';
import { FieldRow } from '../primitives/FieldRow.jsx';
import { uc1, uscis } from '../api.js';

export function Uc1NoticeIngestion({ search = '', initialNoticeId = null }) {
  const [notices, setNotices] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState(null);
  const [uscisStatus, setUscisStatus] = useState(null);
  const [checkingUscis, setCheckingUscis] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    uc1.listNotices()
      .then((d) => {
        setNotices(d.notices || []);
        if (initialNoticeId) setSelectedId(initialNoticeId);
        else if (d.notices?.length) setSelectedId(d.notices[0].id);
      })
      .catch(() => {});
  }, [initialNoticeId]);

  useEffect(() => {
    setUscisStatus(null);
  }, [selectedId]);

  const q = search.toLowerCase();
  const filtered = q
    ? notices.filter((n) =>
      n.beneficiary?.toLowerCase().includes(q) ||
      n.petitioner?.toLowerCase().includes(q) ||
      n.file?.toLowerCase().includes(q)
    )
    : notices;
  const selected = notices.find((n) => n.id === selectedId);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { notice } = await uc1.uploadNotice(fd);
      setNotices((prev) => [...prev, notice]);
      setSelectedId(notice.id);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
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

  async function handleCheckUscis() {
    if (!selected?.receiptNumber) return;
    setCheckingUscis(true);
    setError(null);
    try {
      setUscisStatus(await uscis.checkStatus(selected.receiptNumber));
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'USCIS lookup failed');
    } finally {
      setCheckingUscis(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-4">

        {/* Upload + queue */}
        <div className="col-span-5 space-y-3">

          {/* Drop zone */}
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${uploading
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
            <Upload className={`w-6 h-6 mx-auto mb-2 ${uploading ? 'text-slate-300 animate-pulse' : 'text-slate-400'}`} />
            <div className="text-sm font-medium text-slate-700">
              {uploading ? 'Extracting via AI…' : 'Upload Notice'}
            </div>
            <div className="text-xs text-slate-400 mt-1">PDF or image · click to browse</div>
          </div>

          {error && (
            <div className="px-3 py-2 rounded bg-rose-50 ring-1 ring-rose-200 text-xs text-rose-700">{error}</div>
          )}

          {/* Queue */}
          {notices.length > 0 && (
            <Section title="Processed notices" subtitle={q ? `${filtered.length} of ${notices.length} match` : `${notices.length} in session`}>
              <div className="space-y-1.5">
                {filtered.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setSelectedId(n.id)}
                    className={`w-full text-left p-3 rounded-md border transition-all ${selectedId === n.id
                        ? 'border-slate-900 bg-slate-50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <StatusPill status={n.status} />
                          {n.flags > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700">
                              <Flag className="w-2.5 h-2.5" />{n.flags}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-900 truncate">{n.beneficiary}</div>
                        <div className="text-xs text-slate-500 truncate">{n.petitioner}</div>
                      </div>
                      <div className="text-[10px] text-slate-400 whitespace-nowrap">{n.received}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Detail panel */}
        <div className="col-span-7 space-y-4">
          {selected ? (
            <>
              <Section
                title="Record"
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
                        View
                      </a>
                    )}
                    <StatusPill status={selected.status} />
                  </div>
                }
              >
                {selected.status === 'Verified' && selected.receiptNumber && (
                  <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">USCIS receipt</div>
                        <div className="mt-0.5 font-mono text-xs text-slate-800">{selected.receiptNumber}</div>
                      </div>
                      <button
                        onClick={handleCheckUscis}
                        disabled={checkingUscis}
                        className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                        style={{ backgroundColor: '#204496' }}
                      >
                        <RefreshCcw className={`h-3 w-3 ${checkingUscis ? 'animate-spin' : ''}`} />
                        {checkingUscis ? 'Checking...' : 'Check USCIS status'}
                      </button>
                    </div>
                    {uscisStatus && (
                      <div className="mt-3 rounded border border-white bg-white p-2 text-xs text-slate-700">
                        <div className="font-semibold text-slate-900">{uscisStatus.statusTitle}</div>
                        <div className="mt-1 leading-relaxed">{uscisStatus.statusBody}</div>
                      </div>
                    )}
                  </div>
                )}
                {selected.status === 'Verified' ? (
                  <div className="py-10 text-center">
                    <div className="inline-flex items-center gap-2 text-emerald-600 text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      Record verified and saved to case management
                    </div>
                  </div>
                ) : selected.fields.length > 0 ? (
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
                          className="px-3 py-1.5 text-xs font-medium text-white rounded inline-flex items-center gap-1.5 disabled:opacity-40"
                          style={{ backgroundColor: '#204496' }}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Verify &amp; save
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-10 text-center">
                    <div className="inline-flex items-center gap-2 text-slate-400 text-sm">
                      <Clock className="w-4 h-4 animate-pulse" />
                      Extraction in progress…
                    </div>
                  </div>
                )}
              </Section>

              {/* Inline preview for uploaded images */}
              {selected.sampleAsset && selected.fields.length > 0 && (
                <Section title="Document preview" subtitle={selected.file}>
                  <img
                    src={selected.sampleAsset}
                    alt={selected.file}
                    className="w-full rounded border border-slate-200 object-contain"
                    style={{ maxHeight: '400px' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </Section>
              )}
            </>
          ) : (
            <div className="py-24 text-center text-sm text-slate-400">
              {/* Upload an I-797 notice to begin extraction */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

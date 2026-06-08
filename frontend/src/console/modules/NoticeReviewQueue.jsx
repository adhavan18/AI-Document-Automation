import { useState, useRef, useEffect, useCallback } from 'react';
import { legal } from '../legalApi.js';

const colors = {
  primary: '#204496',
  green: '#1f8a52',
  amber: '#b8791a',
  orange: '#e14a28',
  paper: '#faf7f2',
  ink: '#1c1a17',
  inkSoft: '#5c574e',
  inkFaint: '#8a847a',
  line: '#e9e3d8',
  lineSoft: '#f1ece2',
  blue: '#2f6fb0',
  violet: '#6b4ce0',
};

// ── Receipt field schema (the 10 USCIS notice-receipt fields) ────────────────
// Drives the structured right-hand panel: order, labels, input type, options.
const RECEIPT_TYPE_OPTIONS = [
  'USCIS Receipt Number', 'J Visa Application Number', 'NVC Matter Number',
  'PERM Receipt', 'Other',
];
const RECEIPT_STATUS_OPTIONS = ['Pending', 'Approved', 'Denied', 'RFE', 'Withdrawn', 'Shipped'];
const EXPIRATION_OPTIONS = ['No', 'Yes'];

// type: 'text' | 'date' | 'enum' | 'search' | 'textarea'
const RECEIPT_FIELDS = [
  { name: 'primary_flag',           label: 'Primary Flag',            type: 'text',     col: 'full' },
  { name: 'sent_government_agency', label: 'Sent Government Agency',  type: 'date',     col: 'right' },
  { name: 'receipt_for',            label: 'Receipt For',             type: 'search',   col: 'left' },
  { name: 'receipt_type',           label: 'Receipt Type',            type: 'enum',     col: 'right', required: true, options: RECEIPT_TYPE_OPTIONS },
  { name: 'receipt_date',           label: 'Receipt Date',            type: 'date',     col: 'left' },
  { name: 'receipt_notice_date',    label: 'Receipt Notice Date',     type: 'date',     col: 'right' },
  { name: 'receipt_number',         label: 'Receipt Number',          type: 'text',     col: 'left' },
  { name: 'receipt_status',         label: 'Receipt Status',          type: 'enum',     col: 'right', options: RECEIPT_STATUS_OPTIONS },
  { name: 'expiration_alert',       label: 'Expiration Alert',        type: 'enum',     col: 'left', options: EXPIRATION_OPTIONS },
  { name: 'receipt_notes',          label: 'Receipt Notes',           type: 'textarea', col: 'full' },
];
// Rows: each field one per row (full width).
const RECEIPT_ROWS = [
  ['primary_flag'],
  ['sent_government_agency'],
  ['receipt_for'],
  ['receipt_type'],
  ['receipt_date'],
  ['receipt_notice_date'],
  ['receipt_number'],
  ['receipt_status'],
  ['expiration_alert'],
  ['receipt_notes'],
];

// Backend statuses -> UI status buckets
const UI_STATUS = {
  pending: { key: 'ready', label: 'Ready for Review', color: colors.primary },
  in_review: { key: 'ready', label: 'In Review', color: colors.primary },
  processing: { key: 'processing', label: 'Processing', color: colors.amber },
  approved: { key: 'completed', label: 'Completed', color: colors.green },
  rejected: { key: 'completed', label: 'Rejected', color: colors.green },
};

function uiStatus(status) {
  return UI_STATUS[status] || UI_STATUS.pending;
}

function shortId(id) {
  return (id || '').replace(/-/g, '').slice(0, 8);
}

function confTone(c) {
  return c >= 90 ? colors.green : c >= 80 ? colors.amber : colors.orange;
}

// ── status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const s = uiStatus(status);
  const icons = {
    processing: (
      <svg className="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    ),
    ready: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    ),
    completed: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  };
  const bg = s.key === 'processing' ? '#fbf0db' : s.key === 'ready' ? '#e4e9f4' : '#e4f3ea';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 9px',
      borderRadius: '999px', fontFamily: 'Inter, SF Mono, monospace', fontSize: '10.5px',
      fontWeight: '600', letterSpacing: '.02em', textTransform: 'uppercase',
      whiteSpace: 'nowrap', background: bg, color: s.color,
    }}>
      {icons[s.key]}{s.label}
    </span>
  );
}

export function NoticeReviewQueue({ initialNoticeId }) {
  const [cases, setCases] = useState([]);
  const [selectedId, setSelectedId] = useState(initialNoticeId || null);
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const [edits, setEdits] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, setPending] = useState([]); // [{file, progress, status}]
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  const loadQueue = useCallback(async () => {
    try {
      const data = await legal.listQueue();
      setCases(data.cases || []);
      setError(null);
      return data.cases || [];
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Failed to load queue');
      return [];
    }
  }, []);

  useEffect(() => {
    loadQueue().then((list) => {
      if (!selectedId && list.length) setSelectedId(list[0].case_id);
    });
  }, [loadQueue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load detail when selection changes
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    legal.getCase(selectedId)
      .then((d) => { if (!cancelled) { setDetail(d); setEdits({}); setError(null); } })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail || err.message || 'Failed to load case');
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await legal.upload(file);
      const newId = res.case_id;
      // Refresh queue so the new card appears immediately
      await loadQueue();
      if (newId) {
        // Force detail re-fetch even if selectedId hasn't changed
        setSelectedId(newId);
        legal.getCase(newId)
          .then((d) => { setDetail(d); setEdits({}); })
          .catch(() => {});
      }
    } catch (err) {
      await loadQueue().catch(() => {});
      setError(err?.response?.data?.detail || err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleConfirm() {
    if (!detail) return;
    setConfirming(true);
    setError(null);
    try {
      const byName = Object.fromEntries(
        (detail.extracted_fields || []).map((f) => [f.field_name, f])
      );
      // Always send all 10 receipt fields (edits override extracted values),
      // plus any other extracted fields the form carried.
      const names = new Set([
        ...RECEIPT_FIELDS.map((c) => c.name),
        ...(detail.extracted_fields || []).map((f) => f.field_name),
      ]);
      const fields = [...names].map((name) => {
        const f = byName[name] || {};
        return {
          field_name: name,
          confirmed_value: edits[name] ?? f.normalized_value ?? f.raw_value ?? '',
        };
      });
      await legal.confirm(detail.case_id, fields);
      await loadQueue();
      const refreshed = await legal.getCase(detail.case_id).catch(() => null);
      setDetail(refreshed);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Confirm failed');
    } finally {
      setConfirming(false);
    }
  }

  // ── drawer helpers ─────────────────────────────────────────────────────────
  function addFiles(fileList) {
    const newFiles = Array.from(fileList)
      .filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      .map((f) => ({ file: f, progress: 0, status: 'pending' }));
    setPending((prev) => [...prev, ...newFiles]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  async function startUploadAll() {
    const items = pending.filter((p) => p.status === 'pending');
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const idx = pending.indexOf(item);
      setPending((prev) => prev.map((p, j) => j === idx ? { ...p, status: 'uploading' } : p));
      try {
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const fd = new FormData();
          fd.append('file', item.file);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setPending((prev) => prev.map((p, j) => j === idx ? { ...p, progress: pct } : p));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
            else reject(new Error(`Upload failed: ${xhr.status}`));
          };
          xhr.onerror = () => reject(new Error('Network error'));
          xhr.open('POST', '/legal/upload');
          xhr.send(fd);
        });
        setPending((prev) => prev.map((p, j) => j === idx ? { ...p, progress: 100, status: 'done' } : p));
      } catch {
        setPending((prev) => prev.map((p, j) => j === idx ? { ...p, status: 'error' } : p));
      }
    }
    await loadQueue();
  }

  // ── derived ────────────────────────────────────────────────────────────────
  const q = searchQ.toLowerCase();
  const filtered = cases.filter((c) => {
    const uk = uiStatus(c.status).key;
    if (filter === 'review' && uk !== 'ready') return false;
    if (filter === 'processing' && uk !== 'processing') return false;
    if (filter === 'completed' && uk !== 'completed') return false;
    if (q && !(`${c.form_type} ${c.case_id}`.toLowerCase().includes(q))) return false;
    return true;
  });

  const counts = {
    all: cases.length,
    review: cases.filter((c) => uiStatus(c.status).key === 'ready').length,
    processing: cases.filter((c) => uiStatus(c.status).key === 'processing').length,
    completed: cases.filter((c) => uiStatus(c.status).key === 'completed').length,
  };

  const fields = detail?.extracted_fields || [];
  // Lookup by field_name so the structured receipt panel can pull each field's
  // value / confidence / source directly.
  const fieldByName = Object.fromEntries(fields.map((f) => [f.field_name, f]));
  const exceptions = detail?.exceptions || [];
  const fieldCount = fields.length;
  const needReview = fields.filter((f) => f.confidence < 0.8).length;
  const nativeCount = fields.filter((f) => f.source === 'native' || f.source === 'acroform' || f.source === 'regex').length;
  const llmCount = fields.filter((f) => f.source === 'llm' || f.source === 'llm_fallback').length;
  const overallConf = fieldCount
    ? Math.round((fields.reduce((s, f) => s + (f.confidence || 0), 0) / fieldCount) * 100)
    : 0;

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      minHeight: '100%',
      background: colors.paper,
      color: colors.ink,
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* LEFT: Queue */}
      <aside style={{
        width: '320px', flexShrink: 0, borderRight: `1px solid ${colors.line}`,
        background: 'rgba(250,247,242,.7)', backdropFilter: 'blur(8px)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 18px 14px' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '17px', fontWeight: '600', lineHeight: '1' }}>Notice Processing</div>
            <div style={{
              fontFamily: 'Inter, SF Mono, monospace', fontSize: '9.5px', color: colors.inkFaint,
              letterSpacing: '.06em', textTransform: 'uppercase', marginTop: '3px',
            }}>Review Queue · USCIS Forms</div>
          </div>

          {/* Upload Button → opens drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              width: '100%', padding: '10px', borderRadius: '10px', border: 'none',
              background: colors.primary, color: '#fff', fontSize: '13px', fontWeight: '600',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              cursor: 'pointer', boxShadow: '0 2px 10px rgba(32,68,150,.25)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Documents
          </button>

          {error && (
            <div style={{
              marginTop: '10px', padding: '8px 10px', borderRadius: '8px',
              background: '#fbe8e2', border: `1px solid ${colors.orange}33`,
              fontSize: '11px', color: colors.orange,
            }}>{error}</div>
          )}

          {/* Search */}
          <div style={{ position: 'relative', marginTop: '12px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{
              position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: colors.inkFaint,
            }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search form or case…"
              style={{
                width: '100%', padding: '8px 10px 8px 32px', borderRadius: '9px',
                border: `1px solid ${colors.line}`, background: '#fff', fontFamily: 'inherit',
                fontSize: '12.5px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
            {[['all', 'All'], ['review', 'Ready'], ['processing', 'Processing'], ['completed', 'Completed']].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                padding: '5px 10px', borderRadius: '999px', border: `1px solid ${colors.line}`,
                background: filter === k ? colors.ink : 'transparent', color: filter === k ? '#fff' : colors.inkSoft,
                fontSize: '11.5px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '5px',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {l}<span style={{ fontFamily: 'Inter, SF Mono, monospace', fontSize: '9.5px', opacity: 0.7 }}>{counts[k]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Queue List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 12px' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '24px 12px', fontSize: '12px', color: colors.inkFaint, textAlign: 'center' }}>
              {cases.length === 0 ? 'No cases yet. Upload a document to begin.' : 'No matches.'}
            </div>
          )}
          {filtered.map((c) => {
            const s = uiStatus(c.status);
            const active = c.case_id === selectedId;
            return (
              <button key={c.case_id} onClick={() => setSelectedId(c.case_id)} style={{
                position: 'relative', width: '100%', textAlign: 'left', padding: '13px 14px 13px 16px',
                borderRadius: '12px', border: `1px solid ${active ? colors.primary : colors.line}`,
                background: active ? '#fff' : 'rgba(255,255,255,.55)', marginBottom: '8px', overflow: 'hidden',
                boxShadow: active ? '0 2px 14px rgba(32,68,150,.10)' : '0 1px 2px rgba(28,26,23,.02)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: s.color, opacity: active ? 1 : 0.55 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '600', color: colors.ink }}>{c.form_type}</span>
                    {c.priority === 'high' && (
                      <span style={{
                        fontFamily: 'Inter, SF Mono, monospace', fontSize: '9px', fontWeight: '700',
                        color: colors.orange, background: '#fbe8e2', padding: '1px 5px', borderRadius: '4px', letterSpacing: '.04em',
                      }}>HIGH</span>
                    )}
                  </div>
                  <span style={{ fontFamily: 'Inter, SF Mono, monospace', fontSize: '10px', color: colors.inkFaint }}>#{shortId(c.case_id)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '11px' }}>
                  <StatusPill status={c.status} />
                  <span style={{ fontFamily: 'Inter, SF Mono, monospace', fontSize: '10px', color: colors.inkFaint }}>
                    {c.field_count} fields{c.low_confidence_count ? ` · ${c.low_confidence_count} low` : ''}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '11px 18px', borderTop: `1px solid ${colors.line}`, display: 'flex',
          alignItems: 'center', gap: '7px', fontFamily: 'Inter, SF Mono, monospace',
          fontSize: '10.5px', color: colors.inkFaint,
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors.green, animation: 'pulse 2s ease-in-out infinite' }} />
          {cases.length} in queue
        </div>
      </aside>

      {/* CENTER: Viewer */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#1a1815' }}>
        <div style={{
          padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#fff', borderBottom: `1px solid ${colors.line}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: colors.ink }}>
                {detail ? `${detail.form_type} — ${shortId(detail.case_id)}` : 'Document Viewer'}
              </div>
              <div style={{ fontFamily: 'Inter, SF Mono, monospace', fontSize: '10.5px', color: colors.inkFaint }}>
                {detail ? `${detail.page_count || 0} pages · ${detail.edition_date || 'no edition date'}` : 'Select a case'}
              </div>
            </div>
            {detail && <StatusPill status={detail.status} />}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {detail ? (
            <iframe
              key={detail.case_id}
              title="pdf"
              src={legal.pdfUrl(detail.case_id)}
              style={{ flex: 1, width: '100%', height: '100%', border: 'none', background: '#1a1815' }}
            />
          ) : (
            <div style={{
              flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '32px',
              backgroundImage: 'radial-gradient(circle at 1px 1px,rgba(255,255,255,.04) 1px,transparent 0)',
              backgroundSize: '22px 22px',
            }}>
              <div style={{ textAlign: 'center', color: '#cfc8bd', marginTop: '80px' }}>
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke={colors.amber} strokeWidth="2" strokeLinecap="round" style={{ margin: '0 auto 18px' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                <h3 style={{ fontSize: '19px', margin: '18px 0 6px', color: '#fff', fontWeight: '600' }}>Upload a document to begin</h3>
                <p style={{ fontSize: '13px', opacity: 0.7, margin: 0 }}>PDF files are supported</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* RIGHT: Extracted Fields */}
      <aside style={{
        width: '380px', flexShrink: 0, borderLeft: `1px solid ${colors.line}`,
        background: '#fff', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${colors.lineSoft}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: colors.ink }}>Extracted Fields</div>
          </div>

          {/* Confidence Card */}
          <div style={{
            marginTop: '12px', padding: '11px 13px', borderRadius: '11px', background: colors.paper,
            border: `1px solid ${colors.line}`, display: 'flex', alignItems: 'center', gap: '11px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={confTone(overallConf)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: colors.inkSoft, fontWeight: '500' }}>Overall Extraction Confidence</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <div style={{ flex: 1, height: '5px', borderRadius: '999px', background: colors.lineSoft, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '999px', background: confTone(overallConf), width: `${overallConf}%` }} />
                </div>
                <span style={{ fontFamily: 'Inter, SF Mono, monospace', fontSize: '12px', fontWeight: '600', color: confTone(overallConf) }}>{overallConf}%</span>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div style={{ marginTop: '10px', fontSize: '11.5px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Stat n={fieldCount} l="Fields" color={colors.inkSoft} bg={colors.lineSoft} />
            <Stat n={needReview} l="Need Review" color={colors.orange} bg="#fbe8e2" />
            <Stat n={nativeCount} l="Native" color={colors.blue} bg="#e6eff8" />
            <Stat n={llmCount} l="LLM" color={colors.violet} bg="#ece7fb" />
            {exceptions.length > 0 && <Stat n={exceptions.length} l="Exceptions" color={colors.orange} bg="#fbe8e2" />}
          </div>
        </div>

        {/* Fields List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {fields.length === 0 && (
            <div style={{ fontSize: '12px', color: colors.inkSoft }}>
              {detail ? 'No fields extracted for this case.' : 'Select a case to view fields.'}
            </div>
          )}
          {detail && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {RECEIPT_ROWS.map((row, ri) => (
                <div key={ri}>
                  {row.map((name) => {
                    if (!name) return null;
                    const cfg = RECEIPT_FIELDS.find((c) => c.name === name);
                    const fr = fieldByName[name];
                    const val = edits[name] ?? fr?.normalized_value ?? fr?.raw_value ?? '';
                    return (
                      <ReceiptField
                        key={name}
                        cfg={cfg}
                        fr={fr}
                        value={val}
                        onChange={(v) => setEdits((prev) => ({ ...prev, [name]: v }))}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Exceptions */}
          {exceptions.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{
                fontFamily: 'Inter, SF Mono, monospace', fontSize: '10px', fontWeight: '700',
                textTransform: 'uppercase', letterSpacing: '.06em', color: colors.orange, marginBottom: '8px',
              }}>Triggered Exceptions ({exceptions.length})</div>
              {exceptions.map((ex) => (
                <div key={ex.seq} style={{
                  padding: '11px 13px', borderRadius: '10px', marginBottom: '8px',
                  background: '#fbe8e2', border: `1px solid ${colors.orange}33`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: colors.ink }}>{ex.exception_title}</span>
                    <span style={{ fontFamily: 'Inter, SF Mono, monospace', fontSize: '8.5px', fontWeight: '700', textTransform: 'uppercase', color: colors.orange }}>{ex.category}</span>
                  </div>
                  {ex.triggered_by && (
                    <div style={{ fontSize: '10.5px', color: colors.inkSoft, marginTop: '4px' }}>{ex.triggered_by}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions — Row 8: Cancel | Save */}
        <div style={{ padding: '14px 18px', borderTop: `1px solid ${colors.line}`, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={() => setEdits({})}
            disabled={!detail || confirming}
            style={{
              padding: '11px 20px', borderRadius: '10px', border: `1px solid ${colors.line}`,
              background: '#fff', color: colors.inkSoft, fontSize: '13.5px', fontWeight: '600',
              cursor: (!detail || confirming) ? 'not-allowed' : 'pointer', opacity: (!detail || confirming) ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!detail || confirming || fields.length === 0}
            style={{
              padding: '11px 24px', borderRadius: '10px', border: 'none', background: colors.primary,
              color: '#fff', fontSize: '13.5px', fontWeight: '600', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '7px', cursor: (!detail || confirming || fields.length === 0) ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 10px rgba(32,68,150,.22)', opacity: (!detail || confirming || fields.length === 0) ? 0.5 : 1,
            }}
          >
            {confirming ? (
              <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            )}
            {confirming ? 'Saving…' : 'Save'}
          </button>
        </div>
      </aside>

      {/* ── Upload Drawer ──────────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(28,26,23,.45)',
            zIndex: 400, display: 'flex', justifyContent: 'flex-end',
          }}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '420px', height: '100%', background: '#fff',
              display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 32px rgba(0,0,0,.18)',
            }}
          >
            {/* Drawer header */}
            <div style={{
              padding: '20px 22px 16px', borderBottom: `1px solid ${colors.line}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: '700', color: colors.ink }}>Upload Documents</div>
                <div style={{ fontSize: '11px', color: colors.inkFaint, marginTop: '2px' }}>PDF files only · AI extraction will begin automatically</div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: colors.inkFaint }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Drop zone */}
            <div style={{ padding: '18px 22px' }}>
              <div
                ref={dropRef}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? colors.primary : colors.line}`,
                  borderRadius: '14px', padding: '36px 20px', textAlign: 'center',
                  background: dragOver ? '#edf1fb' : colors.paper, cursor: 'pointer',
                  transition: 'all .15s',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div style={{ fontSize: '14px', fontWeight: '600', color: colors.ink }}>Drop PDFs here or click to browse</div>
                <div style={{ fontSize: '11.5px', color: colors.inkFaint, marginTop: '4px' }}>Multiple files supported</div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
              />
            </div>

            {/* File list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px' }}>
              {pending.map((item, i) => (
                <div key={i} style={{
                  padding: '12px 14px', borderRadius: '10px', border: `1px solid ${colors.line}`,
                  marginBottom: '8px', background: '#fff',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span style={{ fontSize: '12.5px', fontWeight: '500', color: colors.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.file.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {item.status === 'done' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                      )}
                      {item.status === 'error' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.orange} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                      )}
                      {item.status !== 'done' && (
                        <button
                          onClick={() => setPending((prev) => prev.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: colors.inkFaint }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  {(item.status === 'uploading' || item.status === 'done') && (
                    <div style={{ marginTop: '8px', height: '4px', borderRadius: '999px', background: colors.lineSoft, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: '999px', background: item.status === 'done' ? colors.green : colors.primary, width: `${item.progress}%`, transition: 'width .2s' }} />
                    </div>
                  )}
                  {item.status === 'error' && (
                    <div style={{ marginTop: '5px', fontSize: '10.5px', color: colors.orange }}>Upload failed — try again</div>
                  )}
                </div>
              ))}
            </div>

            {/* Drawer footer */}
            <div style={{
              padding: '16px 22px', borderTop: `1px solid ${colors.line}`,
              display: 'flex', justifyContent: 'flex-end', gap: '10px',
            }}>
              <button
                onClick={() => { setDrawerOpen(false); setPending([]); }}
                style={{
                  padding: '10px 20px', borderRadius: '9px', border: `1px solid ${colors.line}`,
                  background: '#fff', color: colors.inkSoft, fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={startUploadAll}
                disabled={pending.filter((p) => p.status === 'pending').length === 0}
                style={{
                  padding: '10px 24px', borderRadius: '9px', border: 'none',
                  background: colors.primary, color: '#fff', fontSize: '13px', fontWeight: '600',
                  cursor: pending.filter((p) => p.status === 'pending').length === 0 ? 'not-allowed' : 'pointer',
                  opacity: pending.filter((p) => p.status === 'pending').length === 0 ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: '7px',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload {pending.filter((p) => p.status === 'pending').length > 0 ? `(${pending.filter((p) => p.status === 'pending').length})` : ''}
              </button>
            </div>
          </aside>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

// ── one receipt field: label + source badge + confidence bar + typed input ───
const inputBase = {
  width: '100%', padding: '9px 12px', borderRadius: '9px',
  border: `1px solid ${colors.line}`, background: colors.paper,
  fontFamily: 'inherit', fontSize: '13.5px', color: colors.ink,
  outline: 'none', boxSizing: 'border-box',
};

function ReceiptField({ cfg, fr, value, onChange }) {
  const pct = Math.round((fr?.confidence || 0) * 100);
  const low = fr ? pct < 80 : false;
  const tone = confTone(pct);
  const isLlm = fr?.source === 'llm' || fr?.source === 'llm_fallback';
  const hasFr = !!fr;

  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
        <span style={{ fontSize: '11.5px', fontWeight: '700', color: colors.primary }}>
          {cfg.label}{cfg.required && <span style={{ color: colors.orange }}> *</span>}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hasFr && (
            <span style={{
              fontFamily: 'Inter, SF Mono, monospace', fontSize: '8.5px', fontWeight: '700',
              letterSpacing: '.05em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '5px',
              color: isLlm ? colors.violet : colors.blue, background: isLlm ? '#ece7fb' : '#e6eff8',
            }}>{isLlm ? 'LLM' : 'Native'}</span>
          )}
          {hasFr && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '32px', height: '4px', borderRadius: '999px', background: colors.lineSoft, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', borderRadius: '999px', width: `${pct}%`, background: tone }} />
              </span>
              <span style={{ fontFamily: 'Inter, SF Mono, monospace', fontSize: '10px', fontWeight: '600', color: tone }}>{pct}%</span>
            </span>
          )}
        </div>
      </div>

      {cfg.type === 'enum' && (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputBase, appearance: 'none', cursor: 'pointer' }}>
          <option value="">— select —</option>
          {cfg.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}

      {cfg.type === 'search' && (
        <>
          <input
            list={`dl-${cfg.name}`} value={value} placeholder="Type to search…"
            onChange={(e) => onChange(e.target.value)} style={inputBase}
          />
          <datalist id={`dl-${cfg.name}`}>
            {value && <option value={value} />}
          </datalist>
        </>
      )}

      {cfg.type === 'date' && (
        <div style={{ position: 'relative' }}>
          <input
            value={value} placeholder="MM/DD/YYYY"
            onChange={(e) => onChange(e.target.value)}
            style={{ ...inputBase, paddingRight: '34px' }}
          />
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={colors.inkFaint} strokeWidth="2"
            style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
      )}

      {cfg.type === 'textarea' && (
        <textarea
          value={value} rows={3} onChange={(e) => onChange(e.target.value)}
          style={{ ...inputBase, resize: 'vertical', minHeight: '64px', fontFamily: 'inherit' }}
        />
      )}

      {cfg.type === 'text' && (
        <input value={value} onChange={(e) => onChange(e.target.value)} style={inputBase} />
      )}

      {low && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '10.5px', color: colors.orange }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L19 10l-5.1 1.2L12 17l-1.9-5.8L5 10l5.1-1.2z" /></svg>
          Low confidence — verify against original
        </div>
      )}
    </div>
  );
}

function Stat({ n, l, color, bg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: '600',
      padding: '2px 8px', borderRadius: '6px', background: bg, color,
    }}>
      <b style={{ fontFamily: 'Inter, SF Mono, monospace', fontWeight: '700' }}>{n}</b> {l}
    </span>
  );
}

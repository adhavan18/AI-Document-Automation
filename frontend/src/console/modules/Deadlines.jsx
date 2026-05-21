import { useState, useEffect } from 'react';
import { Clock, CheckCircle2, Plus, RotateCcw, Calendar } from 'lucide-react';
import { deadlines as deadlinesApi } from '../api.js';

function urgencyStyle(urgency) {
  if (urgency === 'overdue')  return { dot: 'bg-rose-500', row: 'bg-rose-50/60', badge: 'bg-rose-100 text-rose-700', label: 'Overdue' };
  if (urgency === 'critical') return { dot: 'bg-rose-400', row: 'bg-rose-50/30', badge: 'bg-rose-100 text-rose-600', label: 'This week' };
  if (urgency === 'warning')  return { dot: 'bg-amber-400', row: 'bg-amber-50/20', badge: 'bg-amber-100 text-amber-700', label: 'This month' };
  return { dot: 'bg-emerald-400', row: 'bg-white', badge: 'bg-slate-100 text-slate-500', label: 'Upcoming' };
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

const TYPE_LABELS = {
  passport_expiry:  'Passport Expiry',
  i94_expiry:       'I-94 / Authorized Stay',
  filing_deadline:  'Filing Deadline',
  rfe_response:     'RFE Response',
  custom:           'Custom',
};

export function Deadlines() {
  const [items, setItems]               = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAdd, setShowAdd]           = useState(false);
  const [form, setForm]                 = useState({ label: '', dueDate: '', type: 'custom' });
  const [saving, setSaving]             = useState(false);
  const [loading, setLoading]           = useState(true);

  function load() {
    deadlinesApi.list({ includeCompleted: showCompleted ? '1' : '' })
      .then((d) => setItems(d.deadlines || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [showCompleted]); // eslint-disable-line

  async function handleComplete(id) {
    await deadlinesApi.complete(id);
    load();
  }

  async function handleReopen(id) {
    await deadlinesApi.reopen(id);
    load();
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.label || !form.dueDate) return;
    setSaving(true);
    try {
      await deadlinesApi.create({ label: form.label, dueDate: form.dueDate, type: form.type });
      setForm({ label: '', dueDate: '', type: 'custom' });
      setShowAdd(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  const grouped = {};
  for (const d of items) {
    const g = d.urgency || 'normal';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(d);
  }
  const ORDER = ['overdue', 'critical', 'warning', 'normal'];

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Deadlines & Key Dates</h2>
          <p className="text-xs text-slate-500 mt-0.5">Passport expiries, I-94 stays, filing windows</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded"
            />
            Show completed
          </label>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded"
            style={{ backgroundColor: '#204496' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add deadline
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
        >
          <div className="text-sm font-medium text-slate-900">New deadline</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1 uppercase tracking-wider">Label</label>
              <input
                type="text"
                required
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. I-765 filing window closes"
                className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1 uppercase tracking-wider">Due date</label>
              <input
                type="date"
                required
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1 uppercase tracking-wider">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded focus:outline-none"
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs text-slate-600 ring-1 ring-slate-200 rounded hover:ring-slate-300">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium text-white rounded disabled:opacity-40"
              style={{ backgroundColor: '#204496' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <Calendar className="w-8 h-8 mx-auto mb-3 text-slate-200" />
          <div className="text-sm text-slate-400">No upcoming deadlines</div>
          <div className="text-xs text-slate-300 mt-1">Add one above or create a new case to auto-generate dates</div>
        </div>
      ) : (
        <div className="space-y-4">
          {ORDER.filter((g) => grouped[g]?.length).map((group) => {
            const s = urgencyStyle(group);
            return (
              <div key={group}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${s.badge}`}>
                    {s.label}
                  </span>
                  <span className="text-[10px] text-slate-400">{grouped[group].length} item{grouped[group].length !== 1 ? 's' : ''}</span>
                </div>
                <div className="bg-white border border-slate-200/80 rounded-lg divide-y divide-slate-50 overflow-hidden">
                  {grouped[group].map((d) => (
                    <div key={d.id} className={`flex items-center gap-3 px-4 py-3 ${s.row} ${d.completed ? 'opacity-50' : ''}`}>
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-900">{d.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {TYPE_LABELS[d.type] || d.type} · {fmtDate(d.due_date)}
                          {!d.completed && (
                            <span className={`ml-2 font-medium ${group === 'overdue' ? 'text-rose-600' : group === 'critical' ? 'text-rose-500' : group === 'warning' ? 'text-amber-600' : 'text-slate-400'}`}>
                              {d.daysUntil < 0 ? `${Math.abs(d.daysUntil)}d overdue` : d.daysUntil === 0 ? 'Today' : `${d.daysUntil}d left`}
                            </span>
                          )}
                        </div>
                      </div>
                      {d.completed ? (
                        <button
                          onClick={() => handleReopen(d.id)}
                          className="text-[10px] text-slate-400 hover:text-slate-700 inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reopen
                        </button>
                      ) : (
                        <button
                          onClick={() => handleComplete(d.id)}
                          className="text-[10px] text-slate-500 hover:text-emerald-700 inline-flex items-center gap-1 px-2 py-1 rounded ring-1 ring-slate-200 hover:ring-emerald-300 hover:bg-emerald-50 transition-all"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Mark done
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Inbox, FileCheck2, Users, CheckCircle2, ArrowRight } from 'lucide-react';
import { dashboard } from '../api.js';

function urgencyColor(urgency) {
  if (urgency === 'overdue')  return { dot: 'bg-rose-500',  text: 'text-rose-700',  bg: 'bg-rose-50',  ring: 'ring-rose-200' };
  if (urgency === 'critical') return { dot: 'bg-rose-400',  text: 'text-rose-600',  bg: 'bg-rose-50',  ring: 'ring-rose-100' };
  if (urgency === 'warning')  return { dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200' };
  return { dot: 'bg-emerald-400', text: 'text-slate-600', bg: 'bg-white', ring: 'ring-slate-200' };
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-slate-900', onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-slate-200/80 rounded-lg p-4 text-left hover:shadow-sm transition-shadow w-full"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-slate-50 rounded-md">
          <Icon className="w-4 h-4 text-slate-500" />
        </div>
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-sm font-medium text-slate-700 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </button>
  );
}

export function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboard.getSummary()
      .then(setData)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-400">
        Loading dashboard…
      </div>
    );
  }

  const { stats = {}, upcomingDeadlines = [], recentActivity = [], cases = [] } = data || {};

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Open Cases"
          value={stats.openCases ?? 0}
          sub="H-4 EAD filings"
          onClick={() => onNavigate('uc3')}
        />
        <StatCard
          icon={FileCheck2}
          label="Pending Review"
          value={stats.pendingReview ?? 0}
          sub="PAFs awaiting attorney"
          color={stats.pendingReview > 0 ? 'text-amber-600' : 'text-slate-900'}
          onClick={() => onNavigate('uc2')}
        />
        <StatCard
          icon={Clock}
          label="Deadlines (30 days)"
          value={stats.urgentDeadlines ?? 0}
          sub="within 7 days"
          color={stats.urgentDeadlines > 0 ? 'text-rose-600' : 'text-slate-900'}
          onClick={() => onNavigate('deadlines')}
        />
        <StatCard
          icon={Inbox}
          label="Notice Queue"
          value={stats.noticeQueue ?? 0}
          sub="unverified notices"
          onClick={() => onNavigate('uc1')}
        />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Upcoming deadlines */}
        <div className="col-span-5">
          <div className="bg-white border border-slate-200/80 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Upcoming Deadlines</div>
                <div className="text-xs text-slate-500 mt-0.5">Next 30 days</div>
              </div>
              <button
                onClick={() => onNavigate('deadlines')}
                className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {upcomingDeadlines.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-emerald-400" />
                No deadlines in the next 30 days
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {upcomingDeadlines.map((d) => {
                  const c = urgencyColor(d.urgency);
                  return (
                    <div key={d.id} className={`px-4 py-3 flex items-center gap-3 ${c.bg}`}>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-900 truncate">{d.label}</div>
                        <div className={`text-[10px] mt-0.5 ${c.text}`}>
                          {d.daysUntil < 0
                            ? `Overdue by ${Math.abs(d.daysUntil)} days`
                            : d.daysUntil === 0
                              ? 'Due today'
                              : `Due in ${d.daysUntil} days · ${fmtDate(d.due_date)}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cases at a glance */}
        <div className="col-span-7">
          <div className="bg-white border border-slate-200/80 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Active Cases</div>
                <div className="text-xs text-slate-500 mt-0.5">H-4 EAD filings overview</div>
              </div>
              <button
                onClick={() => onNavigate('uc3')}
                className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
              >
                Open module <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {cases.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">No cases yet</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Applicant</th>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Visa</th>
                    <th className="px-4 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Errors</th>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Next deadline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {cases.map((c) => {
                    const hasErrors = c.counts?.Error > 0;
                    const nextD = c.nextDeadline;
                    const nextDue = nextD ? new Date(nextD.due_date) : null;
                    const daysUntil = nextDue ? Math.ceil((nextDue - new Date()) / 86400000) : null;
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => onNavigate('uc3', c.id)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-slate-900">{c.applicant}</div>
                          <div className="text-[10px] text-slate-400">{c.id}</div>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{c.visaType}</td>
                        <td className="px-4 py-2.5 text-center">
                          {hasErrors
                            ? <span className="inline-flex items-center gap-1 text-rose-600 font-medium"><AlertTriangle className="w-3 h-3" />{c.counts.Error}</span>
                            : c.counts?.verified > 0
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                              : <span className="text-slate-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-2.5">
                          {nextD ? (
                            <span className={daysUntil <= 7 ? 'text-rose-600 font-medium' : daysUntil <= 30 ? 'text-amber-600' : 'text-slate-600'}>
                              {daysUntil <= 0 ? 'Overdue' : `${daysUntil}d · ${fmtDate(nextD.due_date)}`}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="text-sm font-semibold text-slate-900">Recent Activity</div>
          </div>
          <div className="divide-y divide-slate-50">
            {recentActivity.map((a, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-700">{a.label}</span>
                </div>
                <div className="text-[10px] text-slate-400 shrink-0">{fmtDate(a.at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

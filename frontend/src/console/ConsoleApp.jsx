import { useState } from 'react';
import {
  Sparkles, Inbox, FileCheck2, ShieldCheck,
  ChevronRight, Search,
} from 'lucide-react';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { Uc1NoticeIngestion }      from './modules/Uc1NoticeIngestion.jsx';
import { Uc2ComplianceGeneration } from './modules/Uc2ComplianceGeneration.jsx';
import { Uc3CrossValidation }      from './modules/Uc3CrossValidation.jsx';

const MODULES = [
  { id: 'uc1', code: 'UC-01', name: 'Notice Ingestion',  blurb: 'Extract & auto-update',   icon: Inbox,       component: Uc1NoticeIngestion },
  { id: 'uc2', code: 'UC-02', name: 'Compliance Docs',   blurb: 'Generate from sources',   icon: FileCheck2,  component: Uc2ComplianceGeneration },
  { id: 'uc3', code: 'UC-03', name: 'Cross-Validation',  blurb: 'Forms & mismatch review', icon: ShieldCheck, component: Uc3CrossValidation },
];

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

export default function ConsoleApp({ session, onLogout }) {
  const [activeId, setActiveId] = useState('uc1');
  const [search,   setSearch]   = useState('');

  const active = MODULES.find((m) => m.id === activeId);
  const Active = active.component;

  return (
    <div
      className="min-h-screen bg-slate-100/60 text-slate-900"
      style={{ fontFamily: "'IBM Plex Sans', system-ui, -apple-system, sans-serif" }}
    >
      <div className="flex">
        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 min-h-screen bg-white border-r border-slate-200/80 flex flex-col">
          {/* Brand */}
          <div className="px-5 py-5 border-b border-slate-200/80">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-900 rounded-md flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900 tracking-tight">AI Pilot Console</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-[0.1em]">
                  {session?.role ?? 'Immigration · Reviewer'}
                </div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em] px-2 mb-2">
              Use Cases
            </div>
            {MODULES.map((m) => {
              const Icon   = m.icon;
              const active = activeId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => { setActiveId(m.id); setSearch(''); }}
                  className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-md mb-1 transition-all text-left group ${
                    active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400">{m.code}</span>
                      <span className="text-sm font-medium truncate">{m.name}</span>
                    </div>
                    <div className={`text-[10px] truncate ${active ? 'text-slate-400' : 'text-slate-500'}`}>
                      {m.blurb}
                    </div>
                  </div>
                  {active && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-slate-200/80">
            <div className="text-[10px] text-slate-400 uppercase tracking-[0.1em] mb-1">Pilot programme</div>
            <div className="text-xs text-slate-600 leading-relaxed">
              $12K total · 4-month compressed delivery · shared Azure + Doc AI infrastructure
            </div>
          </div>
        </aside>

        {/* ── Main ─────────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          {/* Header */}
          <header className="bg-white border-b border-slate-200/80 px-6 py-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span>Pilot Console</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-slate-900 font-medium">{active.name}</span>
              </div>
              <h1 className="text-xl font-semibold text-slate-900 mt-0.5 tracking-tight">
                {active.code} · {active.name}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search matter, receipt, applicant…"
                  className="pl-7 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
              </div>
              <button
                onClick={onLogout}
                className="text-[11px] text-slate-500 hover:text-slate-900 px-2 py-1 rounded ring-1 ring-slate-200 hover:ring-slate-300"
              >
                Sign out
              </button>
              <div
                title={session?.name}
                className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-[10px] font-semibold text-white"
              >
                {getInitials(session?.name)}
              </div>
            </div>
          </header>

          <div className="p-6">
            <ErrorBoundary>
              <Active key={activeId} search={search} />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

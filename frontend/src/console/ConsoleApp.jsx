import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Inbox, FileCheck2, ShieldCheck,
  Clock, ChevronRight, Search, X,
} from 'lucide-react';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { Dashboard } from './modules/Dashboard.jsx';
import { Uc1NoticeIngestion } from './modules/Uc1NoticeIngestion.jsx';
import { Uc2ComplianceGeneration } from './modules/Uc2ComplianceGeneration.jsx';
import { Uc3CrossValidation } from './modules/Uc3CrossValidation.jsx';
import { Deadlines } from './modules/Deadlines.jsx';
import { search as searchApi } from './api.js';

const MODULES = [
  { id: 'dashboard', name: 'Dashboard',              blurb: 'Overview & deadlines',          icon: LayoutDashboard },
  { id: 'uc1',       name: 'Notice Processing',       blurb: 'Extract notices & auto-update', icon: Inbox },
  { id: 'uc2',       name: 'Compliance Doc (PAF)',     blurb: 'Generate H-1B compliance files', icon: FileCheck2 },
  { id: 'uc3',       name: 'Automate Filing (H4 EAD)', blurb: 'Auto-review & flag data mismatch', icon: ShieldCheck },
  { id: 'deadlines', name: 'Deadlines',               blurb: 'Key dates & expiry alerts',    icon: Clock },
];

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

function SearchDropdown({ results, onSelect, onClose }) {
  if (!results.length) return (
    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg py-3 px-4 text-xs text-slate-400 z-50">
      No results found
    </div>
  );

  const typeLabel = { case: 'Case', matter: 'Matter', notice: 'Notice' };
  const typeColor = { case: 'text-blue-600 bg-blue-50', matter: 'text-purple-600 bg-purple-50', notice: 'text-amber-600 bg-amber-50' };

  return (
    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 max-h-64 overflow-y-auto">
      {results.map((r, i) => (
        <button
          key={i}
          onClick={() => onSelect(r)}
          className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3"
        >
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${typeColor[r.type] || 'text-slate-600 bg-slate-100'}`}>
            {typeLabel[r.type] || r.type}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-slate-900 truncate">{r.label}</div>
            <div className="text-[10px] text-slate-400 truncate">{r.sub}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function ConsoleApp({ session, onLogout }) {
  const [activeId, setActiveId]         = useState('dashboard');
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [activeNoticeId, setActiveNoticeId] = useState(null);
  const [activeMatterId, setActiveMatterId] = useState(null);
  const [search, setSearch]             = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch]     = useState(false);
  const searchRef = useRef(null);

  const active = MODULES.find((m) => m.id === activeId) || MODULES[0];

  // Debounced search
  useEffect(() => {
    if (!search.trim() || search.length < 2) { setSearchResults([]); setShowSearch(false); return; }
    const t = setTimeout(() => {
      searchApi.query(search)
        .then((d) => { setSearchResults(d.results || []); setShowSearch(true); })
        .catch(() => { });
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  // Close search on outside click
  useEffect(() => {
    function handler(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearch(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function navigate(moduleId, recordId = null) {
    setActiveId(moduleId);
    setActiveCaseId(moduleId === 'uc3' ? recordId : null);
    setActiveNoticeId(moduleId === 'uc1' ? recordId : null);
    setActiveMatterId(moduleId === 'uc2' ? recordId : null);
    setSearch('');
    setShowSearch(false);
  }

  function handleSearchSelect(result) {
    navigate(result.module, result.id);
  }

  function renderModule() {
    switch (activeId) {
      case 'dashboard':
        return <Dashboard onNavigate={navigate} />;
      case 'uc1':
        return <Uc1NoticeIngestion key={activeNoticeId || 'notices'} search={search} initialNoticeId={activeNoticeId} />;
      case 'uc2':
        return <Uc2ComplianceGeneration key={activeMatterId || 'matters'} search={search} session={session} initialMatterId={activeMatterId} />;
      case 'uc3':
        return <Uc3CrossValidation key={activeCaseId || 'list'} initialCaseId={activeCaseId} />;
      case 'deadlines':
        return <Deadlines />;
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  }

  return (
    <div
      className="h-screen overflow-hidden bg-slate-100/60 text-slate-900"
      style={{ fontFamily: "'IBM Plex Sans', system-ui, -apple-system, sans-serif" }}
    >
      <div className="flex h-full">
        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 h-full bg-white border-r border-slate-200/80 flex flex-col overflow-y-auto">
          {/* Brand */}
          <div className="px-5 py-4 border-b border-slate-200/80">
            <img
              src="https://gip-us.com/wp-content/uploads/2023/12/gipuheader.png"
              alt="GIP"
              className="h-12 w-auto object-contain"
            />
            <div className="text-[10px] text-slate-500 uppercase tracking-[0.1em] mt-2">
              {session?.role ?? 'Immigration · Reviewer'}
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4">
            {MODULES.map((m) => {
              const Icon = m.icon;
              const isActive = activeId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(m.id)}
                  style={isActive ? { backgroundColor: '#204496' } : {}}
                  className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-md mb-1 transition-all text-left group ${
                    isActive ? 'text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.name}</div>
                    <div className={`text-[10px] truncate ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>{m.blurb}</div>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </nav>

          <div className="px-5 py-4 border-t border-slate-200/80" />
        </aside>

        {/* ── Main ─────────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 flex flex-col min-h-screen">
          {/* Header */}
          <header className="sticky top-0 z-10 bg-white border-b border-slate-200/80 px-6 py-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span>Pilot Console</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-slate-900 font-medium">{active.name}</span>
              </div>
              <h1 className="text-xl font-semibold text-slate-900 mt-0.5 tracking-tight">
                {active.name}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative" ref={searchRef}>
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowSearch(true)}
                  placeholder="Search matter, receipt, applicant…"
                  className="pl-7 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
                {search && (
                  <button
                    onClick={() => { setSearch(''); setShowSearch(false); setSearchResults([]); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                  </button>
                )}
                {showSearch && (
                  <SearchDropdown results={searchResults} onSelect={handleSearchSelect} onClose={() => setShowSearch(false)} />
                )}
              </div>
              <button
                onClick={onLogout}
                className="text-[11px] text-slate-500 hover:text-slate-900 px-2 py-1 rounded ring-1 ring-slate-200 hover:ring-slate-300"
              >
                Sign out
              </button>
              <div
                title={session?.name}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                style={{ backgroundColor: '#204496' }}
              >
                {getInitials(session?.name)}
              </div>
            </div>
          </header>

          <div className="p-6 flex-1 overflow-y-auto">
            <ErrorBoundary>
              {renderModule()}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

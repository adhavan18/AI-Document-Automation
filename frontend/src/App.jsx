import { useState, useEffect } from 'react';
import NoticeExtraction from './components/NoticeExtraction.jsx';
import ComplianceGeneration from './components/ComplianceGeneration.jsx';
import CrossValidation from './components/CrossValidation.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import { loadSession, clearSession } from './auth';

export default function App() {
  const [activeTab, setActiveTab] = useState('extract');
  const [showDemoBanner, setShowDemoBanner] = useState(false);
  const [session, setSession] = useState(() => loadSession());

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setShowDemoBanner((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!session) {
    return <LoginScreen onLogin={(s) => setSession(s)} />;
  }

  return (
    <div
      id="root"
      style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <header
        style={{
          height: 'var(--header-height)',
          background: 'var(--color-navy)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            color: '#fff',
            fontWeight: 400,
          }}
        >
          AI Document Automation
        </h1>

        <div className="header-user">
          <div className="header-user-info">
            <div className="header-user-name">{session.name}</div>
            <div className="header-user-role">{session.role}</div>
          </div>
          <button
            className="header-logout"
            onClick={() => {
              clearSession();
              setSession(null);
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <nav
        style={{
          height: 'var(--tabbar-height)',
          background: '#fff',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'stretch',
          flexShrink: 0,
        }}
      >
        {[
          { key: 'extract', label: 'Notice Extraction' },
          { key: 'generate', label: 'Compliance Document' },
          { key: 'validate', label: 'Cross-Validation' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0 24px',
              height: '100%',
              fontSize: '13px',
              fontWeight: activeTab === tab.key ? 600 : 500,
              color:
                activeTab === tab.key
                  ? 'var(--color-blue)'
                  : 'var(--color-text-muted)',
              background: 'transparent',
              border: 'none',
              borderBottom:
                activeTab === tab.key
                  ? '2px solid var(--color-blue)'
                  : '2px solid transparent',
              cursor: 'pointer',
              borderRadius: 0,
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {showDemoBanner && (
        <div
          style={{
            background: '#FEF9C3',
            borderBottom: '1px solid #FDE047',
            padding: '6px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#713F12',
            flexShrink: 0,
          }}
        >
          <span>
            <strong>Demo Flow:</strong>&nbsp; Tab 1: Use Sample I-797 → Extract
            Fields &nbsp;·&nbsp; Tab 2: Select Matter 001 → Generate Document
            &nbsp;·&nbsp; Tab 3: Use Sample Passport → Run Validation
          </span>
          <span style={{ color: '#92400E', fontWeight: 500 }}>
            Press Ctrl+Shift+D to hide
          </span>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div key={activeTab} className="tab-content" style={{ height: '100%' }}>
          {activeTab === 'extract' && (
            <ErrorBoundary>
              <NoticeExtraction />
            </ErrorBoundary>
          )}
          {activeTab === 'generate' && (
            <ErrorBoundary>
              <ComplianceGeneration />
            </ErrorBoundary>
          )}
          {activeTab === 'validate' && (
            <ErrorBoundary>
              <CrossValidation />
            </ErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}

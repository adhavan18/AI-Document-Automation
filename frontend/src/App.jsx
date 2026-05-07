import { useState, useEffect } from 'react';
import NoticeExtraction from './components/NoticeExtraction.jsx';
import ComplianceGeneration from './components/ComplianceGeneration.jsx';
import CrossValidation from './components/CrossValidation.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

const TABS = [
  { id: 'extract', label: 'Notice Extraction' },
  { id: 'generate', label: 'Compliance Document' },
  { id: 'validate', label: 'Cross-Validation' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('extract');
  const [showDemoBanner, setShowDemoBanner] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setShowDemoBanner((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
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
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            color: '#fff',
          }}
        >
          AI Document Automation
        </div>
        {/* <div
          style={{
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 20,
          }}
        >
          PoC Demo
        </div> */}
      </header>

      <nav
        style={{
          height: 'var(--tabbar-height)',
          background: '#fff',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          flexShrink: 0,
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0 24px',
                height: '100%',
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--color-blue)' : 'var(--color-text-muted)',
                borderBottom: isActive
                  ? '2px solid var(--color-blue)'
                  : '2px solid transparent',
                background: 'transparent',
                borderRadius: 0,
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--color-text)';
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  e.currentTarget.style.color = 'var(--color-text-muted)';
              }}
            >
              {tab.label}
            </button>
          );
        })}
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
            <strong>Demo Flow:</strong>&nbsp;
            Tab 1: Use Sample I-797 → Extract Fields (8s) &nbsp;·&nbsp;
            Tab 2: Select Matter 001 → Generate Document &nbsp;·&nbsp;
            Tab 3: Use Sample Passport → Run Validation
          </span>
          <span style={{ color: '#92400E', fontWeight: 500 }}>
            Press Ctrl+Shift+D to hide
          </span>
        </div>
      )}

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          key={activeTab}
          className="tab-content"
          style={{ height: '100%' }}
        >
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
      </main>
    </>
  );
}

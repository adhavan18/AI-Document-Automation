import { useState, useEffect } from 'react';
import axios from 'axios';
import SplitPanel from './SplitPanel.jsx';
import { saveCache, loadCache } from '../cache';

const MATTER_FIELDS = {
  '001': [
    { label: 'Company', value: 'Acme Corporation' },
    { label: 'Position', value: 'Software Engineer II' },
    { label: 'SOC Code', value: '15-1252' },
    { label: 'Worksite', value: 'San Francisco, CA' },
    { label: 'Wage Level', value: 'Level II — $134,000/yr' },
    { label: 'Start Date', value: 'July 1, 2024' },
    { label: 'End Date', value: 'June 30, 2027' },
  ],
  '002': [
    { label: 'Company', value: 'GlobalTech Inc' },
    { label: 'Position', value: 'Senior Manager, Engineering' },
    { label: 'SOC Code', value: '11-1021' },
    { label: 'Worksite', value: 'New York, NY' },
    { label: 'Wage Level', value: 'Level III — $175,000/yr' },
    { label: 'Start Date', value: 'August 15, 2024' },
    { label: 'End Date', value: 'August 14, 2027' },
  ],
  '003': [
    { label: 'Company', value: 'Innovate LLC' },
    { label: 'Position', value: 'Principal Research Scientist' },
    { label: 'SOC Code', value: '15-2051' },
    { label: 'Worksite', value: 'Palo Alto, CA' },
    { label: 'Wage Level', value: 'Level IV — $220,000/yr' },
    { label: 'Start Date', value: 'September 1, 2024' },
    { label: 'End Date', value: 'August 31, 2027' },
  ],
};

const fadeInStyle = {
  animation: 'mfade 0.2s ease',
};

const keyframes = `@keyframes mfade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`;

function DocIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-text-muted)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
      <line x1="8" y1="9" x2="10" y2="9" />
    </svg>
  );
}

function base64ToBlobUrl(base64) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export default function ComplianceGeneration() {
  const [selectedMatter, setSelectedMatter] = useState('');
  const [result, setResult] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const cached = loadCache('generate');
    if (cached) {
      if (cached.selectedMatter) setSelectedMatter(cached.selectedMatter);
      if (cached.result) setResult(cached.result);
    }
  }, []);

  useEffect(() => {
    if (result || selectedMatter) {
      saveCache('generate', { file: null, result, selectedMatter });
    }
  }, [result, selectedMatter]);

  useEffect(() => {
    if (result?.pdfBase64) {
      const url = base64ToBlobUrl(result.pdfBase64);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPdfUrl(null);
  }, [result]);

  function handleMatterChange(e) {
    setSelectedMatter(e.target.value);
    setResult(null);
    setError(null);
  }

  async function handleGenerate() {
    if (!selectedMatter) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post('/api/generate', {
        matter_id: selectedMatter,
      });
      setResult(response.data);
    } catch (err) {
      const message =
        err.response?.data?.error || err.message || 'Unknown error';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDownload() {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `i129-matter-${selectedMatter}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const fields = selectedMatter ? MATTER_FIELDS[selectedMatter] : null;

  const leftBody = (
    <>
      <style>{keyframes}</style>

      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          marginBottom: 6,
        }}
      >
        Select Matter
      </div>
      <select value={selectedMatter} onChange={handleMatterChange}>
        <option value="" disabled>
          — Select a matter —
        </option>
        <option value="001">Matter 001 — H-1B Extension · Acme Corp</option>
        <option value="002">Matter 002 — L-1A Transfer · GlobalTech Inc</option>
        <option value="003">Matter 003 — O-1 Initial · Innovate LLC</option>
      </select>

      {fields && (
        <table
          key={selectedMatter}
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: 20,
            ...fadeInStyle,
          }}
        >
          <tbody>
            {fields.map((row) => (
              <tr
                key={row.label}
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <td
                  style={{
                    padding: '10px 0',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--color-text-muted)',
                    width: '42%',
                    verticalAlign: 'top',
                  }}
                >
                  {row.label}
                </td>
                <td
                  style={{
                    padding: '10px 0 10px 8px',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--color-text)',
                  }}
                >
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          margin: '20px 0',
        }}
      />

      <button
        type="button"
        className="primary"
        style={{ width: '100%' }}
        disabled={!selectedMatter || isGenerating}
        onClick={handleGenerate}
      >
        {isGenerating ? (
          <span className="processing-label">Generating Form I-129…</span>
        ) : (
          'Generate Form I-129'
        )}
      </button>

      {error && (
        <div
          style={{
            background: 'var(--color-red-bg)',
            border: '1px solid var(--color-red-badge)',
            borderRadius: 6,
            padding: '10px 12px',
            marginTop: 12,
            color: 'var(--color-red-text)',
            fontSize: 12,
          }}
        >
          Error: {error}
        </div>
      )}
    </>
  );

  const rightBody = result && pdfUrl ? (
    <div className="result-appear">
      <div
        style={{
          fontSize: 12,
          color: 'var(--color-text-muted)',
          paddingBottom: 12,
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 16,
        }}
      >
        Form I-129 generated · {(result.processing_time_ms / 1000).toFixed(1)}s ·{' '}
        {result.matter.type}
      </div>

      <div
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        <iframe
          src={pdfUrl}
          style={{ width: '100%', height: 600, border: 'none' }}
          title="Generated Form I-129"
        />
      </div>

      <button
        type="button"
        className="primary"
        style={{ width: '100%', marginTop: 12 }}
        onClick={handleDownload}
      >
        ⬇ Download PDF
      </button>
    </div>
  ) : (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 300,
        textAlign: 'center',
      }}
    >
      <DocIcon />
      <div
        style={{
          fontSize: 14,
          color: 'var(--color-text-muted)',
          marginTop: 12,
        }}
      >
        Generated Form I-129 will appear here
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--color-text-muted)',
          marginTop: 4,
        }}
      >
        Select a matter and click Generate
      </div>
    </div>
  );

  return (
    <SplitPanel
      leftTitle="Matter Details"
      leftBody={leftBody}
      rightTitle="Form I-129 Preview"
      rightBody={rightBody}
    />
  );
}

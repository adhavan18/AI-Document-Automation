import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SplitPanel from './SplitPanel.jsx';

function UploadIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-text-muted)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-blue)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-4.35-4.35a2 2 0 0 0-2.83 0L4 20" />
    </svg>
  );
}

function CompareIcon() {
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
      <rect x="3" y="4" width="9" height="16" rx="1.5" />
      <rect x="12" y="4" width="9" height="16" rx="1.5" />
      <line x1="6" y1="9" x2="9" y2="9" />
      <line x1="6" y1="13" x2="9" y2="13" />
      <line x1="15" y1="9" x2="18" y2="9" />
      <line x1="15" y1="13" x2="18" y2="13" />
    </svg>
  );
}

function truncate(name, max = 40) {
  if (name.length <= max) return name;
  return name.slice(0, max - 1) + '…';
}

export default function CrossValidation() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(e) {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setResult(null);
    setError(null);
  }

  async function handleUseSample() {
    try {
      const response = await fetch('/samples/passport-sample.jpg');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const sampleFile = new File([blob], 'passport-sample.jpg', {
        type: 'image/jpeg',
      });
      setFile(sampleFile);
      setPreviewUrl(URL.createObjectURL(blob));
      setResult(null);
      setError(null);
    } catch {
      setError('Could not load sample passport');
    }
  }

  async function handleValidate() {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('/api/validate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setResult(response.data);
    } catch (err) {
      const message =
        err.response?.data?.error || err.message || 'Unknown error';
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleRemoveFile() {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const isImage = file?.type?.startsWith('image/');

  const leftBody = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {!file ? (
        <div
          className="upload-zone"
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed var(--color-border)',
            borderRadius: 8,
            padding: '32px 20px',
            textAlign: 'center',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          <UploadIcon />
          <div style={{ fontSize: 14, fontWeight: 500, marginTop: 12 }}>
            Drop passport image here
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-text-muted)',
              marginTop: 4,
            }}
          >
            PNG, JPG, or PDF, up to 20MB
          </div>
          <button
            type="button"
            className="secondary"
            style={{ marginTop: 12 }}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Browse file
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
          }}
        >
          <FileIcon />
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {truncate(file.name)}
          </span>
          <button
            type="button"
            className="secondary"
            style={{ padding: '2px 8px', fontSize: 12 }}
            onClick={handleRemoveFile}
          >
            ×
          </button>
        </div>
      )}

      {!file && (
        <div
          style={{
            margin: '16px 0',
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--color-text-muted)',
          }}
        >
          — or —
        </div>
      )}

      <button
        type="button"
        className={file ? 'secondary' : 'primary'}
        style={{ width: '100%', marginTop: file ? 12 : 0 }}
        onClick={handleUseSample}
      >
        Use Sample Passport
      </button>

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
        disabled={!file || isProcessing}
        onClick={handleValidate}
      >
        {isProcessing ? (
          <span className="processing-label">Validating…</span>
        ) : (
          'Run Validation'
        )}
      </button>

      {previewUrl && (
        isImage ? (
          <img
            src={previewUrl}
            alt="Passport preview"
            style={{
              width: '100%',
              borderRadius: 6,
              marginTop: 16,
              border: '1px solid var(--color-border)',
            }}
          />
        ) : (
          <iframe
            src={previewUrl}
            style={{
              width: '100%',
              height: 320,
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              marginTop: 16,
            }}
            title="Passport preview"
          />
        )
      )}
    </>
  );

  const headerCellStyle = {
    padding: '10px 14px',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-muted)',
    textAlign: 'left',
    background: 'var(--color-panel)',
    borderBottom: '1px solid var(--color-border)',
  };

  let rightBody;
  if (error) {
    rightBody = (
      <div
        style={{
          background: 'var(--color-red-bg)',
          border: '1px solid var(--color-red-badge)',
          borderRadius: 8,
          padding: '14px 16px',
        }}
      >
        <div style={{ color: 'var(--color-red-text)', fontSize: 13 }}>
          Validation failed: {error}
        </div>
        <button
          type="button"
          className="secondary"
          style={{ marginTop: 10 }}
          onClick={() => setError(null)}
        >
          Try again
        </button>
      </div>
    );
  } else if (result) {
    const { mismatches, matches, total } = result.summary;
    rightBody = (
      <div className="result-appear">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            paddingBottom: 16,
            borderBottom: '1px solid var(--color-border)',
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 13 }}>
            <span
              style={{ color: 'var(--color-red-text)', fontWeight: 700 }}
            >
              {mismatches}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              {' '}mismatches detected
            </span>
          </span>
          <span style={{ fontSize: 13 }}>
            <span
              style={{ color: 'var(--color-green-text)', fontWeight: 700 }}
            >
              {matches}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              {' '}fields confirmed
            </span>
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              color: 'var(--color-text-muted)',
            }}
          >
            Processed in {(result.processing_time_ms / 1000).toFixed(1)}s
          </span>
        </div>

        <div
          style={{
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid var(--color-border)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...headerCellStyle, width: '18%' }}>Field</th>
                <th style={{ ...headerCellStyle, width: '30%' }}>
                  Document Says
                </th>
                <th style={{ ...headerCellStyle, width: '32%' }}>
                  Questionnaire Says
                </th>
                <th style={{ ...headerCellStyle, width: '20%' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.comparison.map((row, idx) => {
                const isMismatch = row.status === 'MISMATCH';
                const valueColor = isMismatch
                  ? 'var(--color-red-text)'
                  : 'var(--color-green-text)';
                const cellStyle = {
                  padding: '12px 14px',
                  fontSize: 13,
                  verticalAlign: 'middle',
                  borderTop:
                    idx === 0 ? 'none' : '1px solid var(--color-border)',
                };
                return (
                  <tr
                    key={row.field}
                    style={{
                      background: isMismatch
                        ? 'var(--color-red-bg)'
                        : 'var(--color-green-bg)',
                    }}
                  >
                    <td
                      style={{
                        ...cellStyle,
                        fontWeight: 600,
                        color: 'var(--color-text)',
                      }}
                    >
                      {row.label}
                    </td>
                    <td style={cellStyle}>
                      <span style={{ color: valueColor, fontWeight: 500 }}>
                        {row.document_value}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <span style={{ color: valueColor, fontWeight: 500 }}>
                        {row.questionnaire_value}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <span
                        style={{
                          background: isMismatch
                            ? 'var(--color-red-badge)'
                            : 'var(--color-green-badge)',
                          color: isMismatch
                            ? 'var(--color-red-text)'
                            : 'var(--color-green-text)',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: 12,
                          display: 'inline-block',
                        }}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            marginTop: 12,
          }}
        >
          Comparison against applicant questionnaire on file · {total} fields
          checked
        </div>
      </div>
    );
  } else {
    rightBody = (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '40px 20px',
          textAlign: 'center',
        }}
      >
        <CompareIcon />
        <div
          style={{
            fontSize: 14,
            color: 'var(--color-text-muted)',
            marginTop: 12,
          }}
        >
          Upload a passport and click Run Validation
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            marginTop: 4,
          }}
        >
          Side-by-side field comparison will appear here
        </div>
      </div>
    );
  }

  return (
    <SplitPanel
      leftTitle="Passport Document"
      leftBody={leftBody}
      rightTitle="Validation Report"
      rightBody={rightBody}
    />
  );
}

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SplitPanel from './SplitPanel.jsx';
import { saveCache, loadCache } from '../cache';

function confidenceBadge(pct) {
  if (pct >= 90) {
    return {
      bg: 'var(--color-green-badge)',
      text: 'var(--color-green-text)',
      suffix: ' ✓',
    };
  }
  if (pct >= 70) {
    return {
      bg: 'var(--color-yellow-badge)',
      text: 'var(--color-yellow-text)',
      suffix: '',
    };
  }
  return {
    bg: 'var(--color-red-badge)',
    text: 'var(--color-red-text)',
    suffix: ' ⚠',
  };
}

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

function PdfFileIcon() {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function PlaceholderIcon() {
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
      <line x1="8" y1="13" x2="14" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
      <circle cx="17.5" cy="17.5" r="2.5" />
      <line x1="19.5" y1="19.5" x2="21" y2="21" />
    </svg>
  );
}

function truncate(name, max = 40) {
  if (name.length <= max) return name;
  return name.slice(0, max - 1) + '…';
}

export default function NoticeExtraction() {
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

  useEffect(() => {
    const cached = loadCache('extract');
    if (cached) {
      if (cached.file) setFile(cached.file);
      if (cached.previewUrl) setPreviewUrl(cached.previewUrl);
      if (cached.result) setResult(cached.result);
    }
  }, []);

  useEffect(() => {
    if (result || file) {
      saveCache('extract', { file, result });
    }
  }, [result, file]);

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
      const response = await fetch('/samples/i797-sample.pdf');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const sampleFile = new File([blob], 'i797-sample.pdf', {
        type: 'application/pdf',
      });
      setFile(sampleFile);
      setPreviewUrl(URL.createObjectURL(blob));
      setResult(null);
      setError(null);
    } catch {
      setError('Could not load sample document');
    }
  }

  async function handleExtract() {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('/api/extract', formData, {
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
    saveCache('extract', { file: null, result: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const isPdf = file?.type === 'application/pdf';

  const leftBody = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/*"
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
            Drop I-797 Notice here
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-text-muted)',
              marginTop: 4,
            }}
          >
            PDF or image, up to 20MB
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
          <PdfFileIcon />
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
        Use Sample I-797
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
        onClick={handleExtract}
      >
        {isProcessing ? (
          <span className="processing-label">Extracting…</span>
        ) : (
          'Extract Fields'
        )}
      </button>

      {previewUrl && (
        isPdf ? (
          <iframe
            src={previewUrl}
            style={{
              width: '100%',
              height: '340px',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              marginTop: 16,
            }}
            title="Document preview"
          />
        ) : (
          <img
            src={previewUrl}
            style={{
              width: '100%',
              borderRadius: 6,
              marginTop: 16,
            }}
            alt="Document preview"
          />
        )
      )}
    </>
  );

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
          Extraction failed: {error}
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
    rightBody = (
      <div className="result-appear">
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            paddingBottom: 16,
            borderBottom: '1px solid var(--color-border)',
            marginBottom: 16,
          }}
        >
          {result.fields.length} fields extracted · Processed in{' '}
          {(result.processing_time_ms / 1000).toFixed(1)}s
        </div>

        {result.fields.map((field) => {
          const colors = confidenceBadge(field.confidence);
          return (
            <div
              key={field.key || field.label}
              style={{
                background: '#fff',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: '14px 16px',
                marginBottom: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-text-muted)',
                    marginBottom: 4,
                  }}
                >
                  {field.label}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--color-text)',
                  }}
                >
                  {field.value}
                </div>
              </div>
              <span
                style={{
                  background: colors.bg,
                  color: colors.text,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 12,
                  whiteSpace: 'nowrap',
                }}
              >
                {field.confidence}%{colors.suffix}
              </span>
            </div>
          );
        })}

        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            marginTop: 8,
          }}
        >
          Source: {result.document_type}
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
        <PlaceholderIcon />
        <div
          style={{
            fontSize: 14,
            color: 'var(--color-text-muted)',
            marginTop: 12,
          }}
        >
          Upload a document and click Extract Fields
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            marginTop: 4,
          }}
        >
          Results will appear here
        </div>
      </div>
    );
  }

  return (
    <SplitPanel
      leftTitle="Document Input"
      leftBody={leftBody}
      rightTitle="Extracted Fields"
      rightBody={rightBody}
    />
  );
}

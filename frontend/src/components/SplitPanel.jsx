const panelHeaderStyle = {
  height: 44,
  padding: '0 20px',
  display: 'flex',
  alignItems: 'center',
  borderBottom: '1px solid var(--color-border)',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--color-text-muted)',
  flexShrink: 0,
};

export default function SplitPanel({ leftTitle, leftBody, rightTitle, rightBody }) {
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <section
        style={{
          width: '42%',
          background: 'var(--color-panel)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={panelHeaderStyle}>{leftTitle}</div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>{leftBody}</div>
      </section>
      <section
        style={{
          width: '58%',
          background: 'var(--color-bg)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={panelHeaderStyle}>{rightTitle}</div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>{rightBody}</div>
      </section>
    </div>
  );
}

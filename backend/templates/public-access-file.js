// Builds a Public Access File (PAF) for H-1B LCA compliance.
// Format modelled on 20 CFR §655.760. Populated from LCA-extracted matter data.

function lca(arr, label) {
  return arr?.find((f) => f.label === label)?.value ?? '';
}

function deriveValidityEnd(matter) {
  const r = lca(matter.computed, 'Retain Until');
  if (!r) return '';
  try {
    const d = new Date(r);
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  } catch { return ''; }
}

export function buildPublicAccessFileHTML(matter) {
  const today = new Date();
  const todayStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const company    = matter.employer   ?? '—';
  const position   = matter.position   ?? '—';
  const worksite   = matter.worksite   ?? '—';
  const startDate  = matter.lcaCertified ?? '';
  const endDate    = deriveValidityEnd(matter);
  const retainUntil = lca(matter.computed, 'Retain Until');

  const socCode    = lca(matter.lca, 'Occupation Code (SOC)');
  const wageRange  = lca(matter.lca, 'Wage Range');
  const prevWage   = lca(matter.lca, 'Prevailing Wage');
  const postStart  = lca(matter.lca, 'Posting Start');
  const postEnd    = lca(matter.lca, 'Posting End');

  const worksiteState = worksite.split(',')[1]?.trim() || worksite;
  const docRef = `PAF-H1B-${matter.id || ''}`;

  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 10pt;
      color: #1a1a1a;
      background: #F5F3EF;
    }
    .page {
      width: 8.5in;
      min-height: 11in;
      background: #F5F3EF;
      padding: 0;
      page-break-after: always;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .page:last-child { page-break-after: avoid; }
    .page-inner { padding: 0.55in 0.65in 0.9in 0.65in; flex: 1; }

    /* ── Cover page ── */
    .cover-header {
      background: #204496;
      padding: 0.55in 0.65in 0.5in 0.65in;
      color: white;
      position: relative;
      overflow: hidden;
    }
    .cover-header::after {
      content: '';
      position: absolute;
      right: -40px; top: -40px;
      width: 220px; height: 220px;
      border-radius: 50%;
      background: rgba(255,255,255,0.06);
    }
    .cover-header::before {
      content: '';
      position: absolute;
      right: 80px; bottom: -60px;
      width: 140px; height: 140px;
      border-radius: 50%;
      background: rgba(255,255,255,0.04);
    }
    .logo-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 32px;
    }
    .logo-mark {
      width: 42px; height: 42px;
      background: white;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; font-weight: 800; color: #204496;
    }
    .company-name {
      font-size: 15pt; font-weight: 700; letter-spacing: 0.02em;
    }
    .company-tagline {
      font-size: 7.5pt; letter-spacing: 0.18em; color: rgba(255,255,255,0.7);
      margin-top: 2px;
    }
    .cover-super {
      font-size: 7pt; letter-spacing: 0.22em; text-transform: uppercase;
      color: #C8A97E; font-weight: 600; margin-bottom: 10px;
    }
    .cover-title {
      font-size: 34pt; font-weight: 800; line-height: 1.1; margin-bottom: 8px;
    }
    .cover-subtitle {
      font-size: 10pt; color: rgba(255,255,255,0.8);
    }

    /* ── Meta boxes ── */
    .meta-row {
      display: flex; gap: 14px; margin: 24px 0;
    }
    .meta-box {
      flex: 1;
      background: white;
      border: 1px solid #E2DDD6;
      border-radius: 6px;
      padding: 14px 16px 12px;
    }
    .meta-label {
      font-size: 6.5pt; letter-spacing: 0.18em; text-transform: uppercase;
      color: #888; font-weight: 600; margin-bottom: 6px;
    }
    .meta-value {
      font-size: 11pt; font-weight: 700; color: #1a1a1a;
      border-bottom: 2px solid #D0C9BF; padding-bottom: 4px;
    }

    /* ── About callout ── */
    .callout {
      border-left: 4px solid #204496;
      padding: 12px 16px;
      background: white;
      border-radius: 0 6px 6px 0;
      font-size: 9pt; line-height: 1.6; color: #333;
      margin-bottom: 24px;
    }
    .callout b { color: #1a1a1a; }

    /* ── TOC ── */
    .toc-title {
      font-size: 7pt; letter-spacing: 0.22em; text-transform: uppercase;
      font-weight: 700; color: #555; border-bottom: 1.5px solid #C8B99A;
      padding-bottom: 6px; margin-bottom: 12px;
    }
    .toc-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 6px 32px;
    }
    .toc-row {
      display: flex; align-items: baseline; gap: 8px;
      font-size: 9pt; color: #333; padding: 3px 0;
      border-bottom: 1px solid #E8E3DA;
    }
    .toc-num {
      font-size: 7.5pt; font-weight: 700; color: #204496; min-width: 18px;
    }
    .toc-label { flex: 1; }
    .toc-page { font-size: 8pt; color: #999; }

    /* ── Page header (pages 2-6) ── */
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 0.65in;
      border-bottom: 1px solid #D8D2C8;
      background: white;
    }
    .page-header-left {
      display: flex; align-items: center; gap: 10px;
    }
    .page-header-logo {
      width: 28px; height: 28px; background: #204496; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 800; color: white;
    }
    .page-header-title {
      font-size: 9pt; font-weight: 600; color: #1a1a1a;
    }
    .page-header-right {
      font-size: 8pt; color: #999; letter-spacing: 0.05em;
    }

    /* ── Sections ── */
    .section { margin-bottom: 22px; }
    .section-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 10px;
    }
    .section-left { display: flex; align-items: center; gap: 10px; }
    .section-num {
      background: #204496; color: white;
      font-size: 8pt; font-weight: 700;
      width: 28px; height: 28px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .section-title-text {
      font-size: 13pt; font-weight: 700; color: #1a1a1a;
    }
    .section-sub {
      font-size: 8pt; color: #888; font-style: italic;
    }

    /* ── Field card ── */
    .card {
      background: white; border: 1px solid #E2DDD6;
      border-radius: 8px; padding: 16px 18px;
      margin-bottom: 10px;
    }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; }
    .field-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 16px; }
    .field { padding: 10px 0 6px; border-bottom: 1px solid #E8E3DA; }
    .field:last-child { border-bottom: none; }
    .field-full { grid-column: 1 / -1; }
    .field-label {
      font-size: 6.5pt; letter-spacing: 0.18em; text-transform: uppercase;
      color: #888; font-weight: 600; margin-bottom: 4px;
    }
    .field-value {
      font-size: 10pt; font-weight: 500; color: #1a1a1a;
      border-bottom: 1.5px solid #D0C9BF; padding-bottom: 3px;
      min-height: 18px;
    }

    /* ── LCA checkbox list ── */
    .check-list { display: flex; flex-direction: column; gap: 8px; }
    .check-item { display: flex; align-items: flex-start; gap: 10px; font-size: 9pt; color: #333; }
    .checkbox {
      width: 14px; height: 14px; border: 1.5px solid #C0BAB0;
      border-radius: 3px; flex-shrink: 0; margin-top: 1px;
      background: white;
    }

    /* ── Benefits grid ── */
    .benefits-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .benefit-card {
      background: white; border: 1px solid #E2DDD6; border-radius: 6px;
      padding: 10px 12px; display: flex; align-items: flex-start; gap: 10px;
    }
    .benefit-icon {
      width: 28px; height: 28px; background: #F0EDE8; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; flex-shrink: 0; color: #204496;
    }
    .benefit-name { font-size: 8.5pt; font-weight: 700; color: #1a1a1a; }
    .benefit-desc { font-size: 7.5pt; color: #777; margin-top: 1px; }

    /* ── Posting grid ── */
    .posting-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
    .posting-card {
      background: white; border: 1px solid #E2DDD6; border-radius: 6px;
      padding: 12px 14px;
    }
    .posting-num {
      display: inline-flex; align-items: center; justify-content: center;
      width: 20px; height: 20px; background: #204496; color: white;
      border-radius: 50%; font-size: 7.5pt; font-weight: 700;
      margin-bottom: 6px;
    }
    .posting-label { font-size: 8.5pt; font-weight: 700; color: #1a1a1a; }
    .posting-line { border-bottom: 1px solid #E0DBD3; margin-top: 8px; height: 16px; }

    /* ── Obligation box ── */
    .obligation-box {
      background: #204496; color: white;
      border-radius: 8px; padding: 18px 20px; margin-bottom: 14px;
      position: relative; overflow: hidden;
    }
    .obligation-box::after {
      content: '';
      position: absolute;
      right: -20px; bottom: -30px;
      width: 120px; height: 120px;
      border-radius: 50%;
      background: rgba(255,255,255,0.05);
    }
    .obligation-label {
      font-size: 6.5pt; letter-spacing: 0.22em; color: #C8A97E;
      font-weight: 700; margin-bottom: 8px;
    }
    .obligation-text { font-size: 9pt; line-height: 1.65; color: rgba(255,255,255,0.9); }

    .maintained-box {
      background: #EEF0F8; border-left: 4px solid #204496;
      border-radius: 0 6px 6px 0; padding: 12px 16px;
      font-size: 9pt; line-height: 1.6; color: #333; margin-bottom: 14px;
    }
    .maintained-box b { color: #1a1a1a; }

    /* ── Certification ── */
    .cert-text {
      font-size: 9pt; line-height: 1.65; color: #333; margin-bottom: 18px;
    }
    .cert-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
    .cert-field { padding: 10px 0; border-bottom: 1px solid #D0C9BF; }
    .cert-field-label {
      font-size: 6.5pt; letter-spacing: 0.18em; text-transform: uppercase;
      color: #888; font-weight: 600; margin-bottom: 14px;
    }
    .sig-line {
      border-bottom: 2px solid #1a1a1a; height: 28px; margin-bottom: 4px;
    }

    /* ── Page footer ── */
    .page-footer {
      position: absolute; bottom: 0; left: 0; right: 0;
      padding: 12px 0.65in;
      border-top: 1px solid #D8D2C8;
      display: flex; align-items: center; justify-content: space-between;
    }
    .footer-left { font-size: 7.5pt; color: #999; }
    .footer-center { font-size: 7.5pt; font-weight: 700; color: #555; }
    .footer-right { font-size: 7.5pt; color: #999; }
    .footer-confidential { color: #C8A97E; font-weight: 700; font-size: 7.5pt; }

    @page { size: letter; margin: 0; }
  `;

  function field(label, value, fullWidth = false) {
    return `<div class="field${fullWidth ? ' field-full' : ''}">
      <div class="field-label">${label}</div>
      <div class="field-value">${value || ''}</div>
    </div>`;
  }

  function pageHeader(right = 'H-1B · PAF') {
    return `<div class="page-header">
      <div class="page-header-left">
        <div class="page-header-logo">G</div>
        <div class="page-header-title">${company} · Public Access File</div>
      </div>
      <div class="page-header-right">${right}</div>
    </div>`;
  }

  function sectionHead(num, title, sub = '') {
    return `<div class="section-header">
      <div class="section-left">
        <div class="section-num">${String(num).padStart(2,'0')}</div>
        <div class="section-title-text">${title}</div>
      </div>
      ${sub ? `<div class="section-sub">${sub}</div>` : ''}
    </div>`;
  }

  function pageFooter(page, total = 6) {
    return `<div class="page-footer">
      <div class="footer-left">${company.toUpperCase()} · PAF / H-1B</div>
      <div class="footer-center">Page ${page} of ${total}</div>
      <div class="footer-right">${page === total ? '· End of document' : ''}</div>
    </div>`;
  }

  // ── PAGE 1 — COVER ────────────────────────────────────────────────────
  const page1 = `
  <div class="page" style="background:#F5F3EF;">
    <div class="cover-header">
      <div class="logo-row">
        <div class="logo-mark">G</div>
        <div>
          <div class="company-name">${company.toUpperCase()}</div>
          <div class="company-tagline">TALENT · COMPLIANCE · MOBILITY</div>
        </div>
      </div>
      <div class="cover-super">U.S. DEPARTMENT OF LABOR · FORM COMPLIANCE</div>
      <div class="cover-title">Public Access File</div>
      <div class="cover-subtitle">H-1B Nonimmigrant Worker · Labor Condition Application Record</div>
    </div>

    <div class="page-inner">
      <div class="meta-row">
        <div class="meta-box">
          <div class="meta-label">Document Reference</div>
          <div class="meta-value">${docRef}</div>
        </div>
        <div class="meta-box">
          <div class="meta-label">Worksite Jurisdiction</div>
          <div class="meta-value">${worksite}</div>
        </div>
        <div class="meta-box">
          <div class="meta-label">Prepared Date</div>
          <div class="meta-value">${todayStr}</div>
        </div>
      </div>

      <div class="callout">
        <b>About this file.</b> This Public Access File contains the documentation required by 20 CFR §655.760 in support of the
        Labor Condition Application (LCA) filed for an H-1B nonimmigrant worker. It is maintained by ${company} and
        must be made available for public examination within one (1) working day after the date the LCA is filed with the
        U.S. Department of Labor.
      </div>

      <div class="toc-title">CONTENTS</div>
      <div class="toc-grid">
        <div class="toc-row"><span class="toc-num">01</span><span class="toc-label">Employer Information</span><span class="toc-page">p. 2</span></div>
        <div class="toc-row"><span class="toc-num">06</span><span class="toc-label">Benefits Summary</span><span class="toc-page">p. 4</span></div>
        <div class="toc-row"><span class="toc-num">02</span><span class="toc-label">Employee Information</span><span class="toc-page">p. 2</span></div>
        <div class="toc-row"><span class="toc-num">07</span><span class="toc-label">Notice of Filing / Posting</span><span class="toc-page">p. 4</span></div>
        <div class="toc-row"><span class="toc-num">03</span><span class="toc-label">Certified LCA</span><span class="toc-page">p. 3</span></div>
        <div class="toc-row"><span class="toc-num">08</span><span class="toc-label">H-1B Dependency</span><span class="toc-page">p. 5</span></div>
        <div class="toc-row"><span class="toc-num">04</span><span class="toc-label">Wage Rate Documentation</span><span class="toc-page">p. 3</span></div>
        <div class="toc-row"><span class="toc-num">09</span><span class="toc-label">Supporting Documents</span><span class="toc-page">p. 5</span></div>
        <div class="toc-row"><span class="toc-num">05</span><span class="toc-label">Actual Wage Memorandum</span><span class="toc-page">p. 3</span></div>
        <div class="toc-row"><span class="toc-num">10</span><span class="toc-label">Compliance &amp; Certification</span><span class="toc-page">p. 6</span></div>
      </div>
    </div>

    <div class="page-footer">
      <div class="footer-left">${company} · ${worksite}</div>
      <div></div>
      <div class="footer-confidential">CONFIDENTIAL</div>
    </div>
  </div>`;

  // ── PAGE 2 — SECTIONS 01 & 02 ─────────────────────────────────────────
  const page2 = `
  <div class="page">
    ${pageHeader()}
    <div class="page-inner">

      <div class="section">
        ${sectionHead(1, 'Employer Information', 'Required · 20 CFR §655.760(a)')}
        <div class="card">
          <div class="field-grid">
            ${field('Employer Name', company)}
            ${field('Federal Employer ID (FEIN)', '')}
            ${field('Registered Business Address', worksite, true)}
            ${field('HR / Immigration Contact', '')}
            ${field('Phone Number', '')}
            ${field('Email Address', '')}
            ${field('Corporate Website', '')}
          </div>
        </div>
      </div>

      <div class="section">
        ${sectionHead(2, 'Employee Information', 'H-1B Beneficiary')}
        <div class="card">
          <div class="field-grid">
            ${field('Employee Full Legal Name', '', true)}
            ${field('Job Title', position)}
            ${field('SOC Occupation Code', socCode)}
            ${field('Authorized Work Location(s)', worksite, true)}
            ${field('Employment Start Date', startDate)}
            ${field('Employment End Date', endDate)}
            ${field('Visa Classification', 'H-1B Specialty Occupation')}
            ${field('Full-Time / Part-Time', 'Full-Time')}
          </div>
        </div>
      </div>

    </div>
    ${pageFooter(2)}
  </div>`;

  // ── PAGE 3 — SECTIONS 03, 04, 05 ────────────────────────────────────
  const page3 = `
  <div class="page">
    ${pageHeader()}
    <div class="page-inner">

      <div class="section">
        ${sectionHead(3, 'Certified Labor Condition Application', 'ETA Form 9035 / 9035E')}
        <div class="card">
          <div class="field-grid">
            ${field('LCA Case Number', '')}
            ${field('Validity Start Date', startDate)}
            ${field('Validity End Date', endDate)}
          </div>
          <div style="height:10px;"></div>
          <div class="check-list">
            <div class="check-item"><div class="checkbox"></div><span><b>Certified ETA Form 9035 / 9035E</b> — signed copy attached</span></div>
            <div class="check-item"><div class="checkbox"></div><span><b>Cover letter</b> from the U.S. Department of Labor confirming certification</span></div>
          </div>
        </div>
      </div>

      <div class="section">
        ${sectionHead(4, 'Wage Rate Documentation', 'Prevailing &amp; offered wage')}
        <div class="card">
          <div class="field-grid-3">
            ${field('Offered Salary / Wage', prevWage)}
            ${field('Pay Frequency', 'Annual')}
            ${field('Wage Level', '')}
          </div>
          <div class="field-grid">
            ${field('Prevailing Wage Source', 'U.S. Department of Labor')}
            ${field('Prevailing Wage Amount', prevWage)}
            ${field('Full-Time / Part-Time', 'Full-Time')}
            ${field('Source Publication Date', '')}
          </div>
          <div style="margin-top:8px;">
            ${field('Offered Wage Range', wageRange, true)}
          </div>
        </div>
      </div>

      <div class="section">
        ${sectionHead(5, 'Actual Wage Memorandum', 'Methodology statement')}
        <div class="card">
          <div class="callout" style="margin-bottom:10px;">
            <b>Required statement.</b> Describe the wage system used by ${company} to determine compensation for workers in the
            same role with substantially similar experience and qualifications, including factors used (experience, education,
            specialization, responsibility, location).
          </div>
          <div style="min-height:60px;border:1px solid #E2DDD6;border-radius:4px;padding:10px;"></div>
        </div>
      </div>

    </div>
    ${pageFooter(3)}
  </div>`;

  // ── PAGE 4 — SECTIONS 06 & 07 ─────────────────────────────────────────
  const page4 = `
  <div class="page">
    ${pageHeader()}
    <div class="page-inner">

      <div class="section">
        ${sectionHead(6, 'Benefits Summary', 'Parity with U.S. workers')}
        <div class="callout" style="margin-bottom:10px;">
          ${company} affirms that H-1B nonimmigrant workers are offered benefits on the same basis and in accordance with
          the same criteria as similarly employed U.S. workers.
        </div>
        <div class="benefits-grid">
          <div class="benefit-card">
            <div class="benefit-icon">+</div>
            <div><div class="benefit-name">Medical Insurance</div><div class="benefit-desc">Health, dental, vision coverage</div></div>
          </div>
          <div class="benefit-card">
            <div class="benefit-icon">☀</div>
            <div><div class="benefit-name">Paid Time Off</div><div class="benefit-desc">Vacation, sick leave, holidays</div></div>
          </div>
          <div class="benefit-card">
            <div class="benefit-icon">$</div>
            <div><div class="benefit-name">Retirement Benefits</div><div class="benefit-desc">401(k) with employer match</div></div>
          </div>
          <div class="benefit-card">
            <div class="benefit-icon">★</div>
            <div><div class="benefit-name">Bonus Programs</div><div class="benefit-desc">Performance &amp; annual bonuses</div></div>
          </div>
          <div class="benefit-card">
            <div class="benefit-icon">⚙</div>
            <div><div class="benefit-name">Disability &amp; Life</div><div class="benefit-desc">Short-term, long-term, life insurance</div></div>
          </div>
          <div class="benefit-card">
            <div class="benefit-icon">⌂</div>
            <div><div class="benefit-name">Other Benefits</div><div class="benefit-desc">Professional development, relocation</div></div>
          </div>
        </div>
      </div>

      <div class="section">
        ${sectionHead(7, 'Notice of Filing &amp; Posting Evidence', '10 consecutive business days')}
        <div class="card">
          <div class="field-grid">
            ${field('Posting Start Date', postStart)}
            ${field('Posting End Date', postEnd)}
          </div>
          <div class="posting-grid">
            <div class="posting-card">
              <div class="posting-num">1</div>
              <div class="posting-label">Physical Posting Location</div>
              <div class="posting-line"></div>
            </div>
            <div class="posting-card">
              <div class="posting-num">2</div>
              <div class="posting-label">Physical Posting Location</div>
              <div class="posting-line"></div>
            </div>
            <div class="posting-card">
              <div class="posting-num">3</div>
              <div class="posting-label">Electronic Notice Method</div>
              <div class="posting-line"></div>
            </div>
            <div class="posting-card">
              <div class="posting-num">4</div>
              <div class="posting-label">Distribution Audience</div>
              <div class="posting-line"></div>
            </div>
          </div>
        </div>
      </div>

    </div>
    ${pageFooter(4)}
  </div>`;

  // ── PAGE 5 — SECTIONS 08 & 09 ─────────────────────────────────────────
  const page5 = `
  <div class="page">
    ${pageHeader()}
    <div class="page-inner">

      <div class="section">
        ${sectionHead(8, 'H-1B Dependency &amp; Willful Violator Status', 'If applicable')}
        <div class="card">
          <div class="check-list">
            <div class="check-item"><div class="checkbox"></div><span><b>Dependency calculation</b> — ratio of H-1B workers to total U.S. workforce documented as of the LCA filing date</span></div>
            <div class="check-item"><div class="checkbox"></div><span><b>Recruitment attestation</b> — good-faith steps taken to recruit U.S. workers for the position</span></div>
            <div class="check-item"><div class="checkbox"></div><span><b>Non-displacement statement</b> — no U.S. worker displaced 90 days before or after the H-1B petition</span></div>
            <div class="check-item"><div class="checkbox"></div><span><b>Secondary displacement attestation</b> — required when placing workers at another employer's worksite</span></div>
            <div class="check-item"><div class="checkbox"></div><span><b>Exempt H-1B worker</b> — documented if employee qualifies for exemption (master's degree or $60,000+ wage)</span></div>
          </div>
        </div>
      </div>

      <div class="section">
        ${sectionHead(9, 'Supporting Documents', 'Optional / recommended')}
        <div class="card">
          <div class="check-list">
            <div class="check-item"><div class="checkbox"></div><span><b>Organizational Chart</b> showing the H-1B worker's reporting structure</span></div>
            <div class="check-item"><div class="checkbox"></div><span><b>Position Description</b> with duties, responsibilities, and required qualifications</span></div>
            <div class="check-item"><div class="checkbox"></div><span><b>Worksite Information Sheet</b> for each authorized work location</span></div>
            <div class="check-item"><div class="checkbox"></div><span><b>Remote Work Addendum</b> covering hybrid or home-based arrangements</span></div>
            <div class="check-item"><div class="checkbox"></div><span><b>Educational credentials</b> — degree evaluation, transcripts, license copies</span></div>
            <div class="check-item"><div class="checkbox"></div><span><b>Employment offer letter</b> and any subsequent compensation amendments</span></div>
          </div>
        </div>
      </div>

    </div>
    ${pageFooter(5)}
  </div>`;

  // ── PAGE 6 — SECTION 10 ───────────────────────────────────────────────
  const page6 = `
  <div class="page">
    ${pageHeader()}
    <div class="page-inner">

      <div class="section">
        ${sectionHead(10, 'Compliance Notes', 'Retention &amp; access')}

        <div class="obligation-box">
          <div class="obligation-label">PUBLIC ACCESS OBLIGATION</div>
          <div class="obligation-text">
            This Public Access File must be made available for public examination within one (1) working day after
            the date the Labor Condition Application is filed with the U.S. Department of Labor, and retained for a
            period of one (1) year beyond the last date on which any H-1B nonimmigrant is employed under the
            LCA — or one (1) year from the date of LCA withdrawal if no nonimmigrant is employed.
            ${retainUntil ? `<br><br><b>Retain Until: ${retainUntil}</b>` : ''}
          </div>
        </div>

        <div class="maintained-box">
          <b>Maintained by:</b> ${company}, Human Resources &amp; Global Mobility. Inquiries regarding access to this file may be
          directed to the HR / Immigration Contact identified in Section 01. All records retained in accordance with 20 CFR §655.760.
        </div>
      </div>

      <div class="section">
        ${sectionHead('✓', 'Certification', 'Prepared and attested')}
        <div class="card">
          <div class="cert-text">
            I certify that the information contained in this Public Access File is true and correct to the best of my knowledge, and
            that the documentation referenced herein is maintained in accordance with the regulations of the U.S. Department of
            Labor governing the H-1B nonimmigrant worker program.
          </div>
          <div class="cert-grid">
            <div class="cert-field">
              <div class="cert-field-label">Prepared By</div>
            </div>
            <div class="cert-field">
              <div class="cert-field-label">Title</div>
            </div>
            <div class="cert-field" style="padding-top:20px;">
              <div class="sig-line"></div>
              <div class="cert-field-label" style="margin-bottom:0;margin-top:4px;">Authorized Signature</div>
            </div>
            <div class="cert-field" style="padding-top:20px;">
              <div class="sig-line"></div>
              <div class="cert-field-label" style="margin-bottom:0;margin-top:4px;">Date</div>
            </div>
          </div>
        </div>
      </div>

    </div>
    ${pageFooter(6)}
  </div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Public Access File — ${company}</title>
<style>${css}</style>
</head>
<body>
${page1}
${page2}
${page3}
${page4}
${page5}
${page6}
</body>
</html>`;
}

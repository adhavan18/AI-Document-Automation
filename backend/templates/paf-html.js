// HTML template for the H-1B Public Access File.
// Rendered to PDF via Puppeteer — no coordinate calibration needed.

function lca(arr, label) {
  return arr?.find((f) => f.label === label)?.value ?? '';
}

function deriveValidityEnd(matter) {
  const r = matter.computed?.find((f) => f.label === 'Retain Until')?.value;
  if (!r || r === 'Not found') return '';
  try {
    const d = new Date(r);
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  } catch { return ''; }
}

function today() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function field(label, value, opts = {}) {
  const colClass = opts.half ? 'col-half' : opts.third ? 'col-third' : 'col-full';
  return `
    <div class="field ${colClass}">
      <div class="field-label">${label}</div>
      <div class="field-value">${value || '&nbsp;'}</div>
    </div>`;
}

export function buildPafHtml(matter) {
  const employer   = matter.employer   ?? '';
  const position   = matter.position   ?? '';
  const worksite   = matter.worksite   ?? '';
  const employee   = matter.employeeName ?? '';
  const startDate  = matter.lcaCertified ?? '';
  const endDate    = deriveValidityEnd(matter);
  const retainUntil = lca(matter.computed, 'Retain Until');
  const socCode    = lca(matter.lca, 'Occupation Code (SOC)');
  const wageRange  = lca(matter.lca, 'Wage Range');
  const prevWage   = lca(matter.lca, 'Prevailing Wage');
  const postStart  = lca(matter.lca, 'Posting Start');
  const postEnd    = lca(matter.lca, 'Posting End');
  const docRef     = matter.id ?? '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@400;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 9pt;
  color: #1a1a1a;
  background: white;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

@page { size: Letter; margin: 0; }

.page {
  width: 612pt;
  height: 792pt;
  overflow: hidden;
  page-break-after: always;
  display: flex;
  flex-direction: column;
  position: relative;
}
.page:last-child { page-break-after: auto; }

/* ── Header bar (all inner pages) ─────────────────────────── */
.page-header {
  background: white;
  border-bottom: 1pt solid #e0e0e0;
  padding: 10pt 36pt;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.page-header-left { display: flex; align-items: center; gap: 8pt; font-size: 8pt; color: #555; }
.page-header-logo {
  width: 18pt; height: 18pt; background: #1a6968; border-radius: 3pt;
  color: white; font-weight: 700; font-size: 10pt;
  display: flex; align-items: center; justify-content: center;
}
.page-header-right { font-size: 8pt; color: #888; }

/* ── Page footer ───────────────────────────────────────────── */
.page-footer {
  border-top: 1pt solid #e0e0e0;
  padding: 8pt 36pt;
  display: flex;
  justify-content: space-between;
  font-size: 7pt;
  color: #888;
  flex-shrink: 0;
  margin-top: auto;
}

/* ── Cover page ────────────────────────────────────────────── */
.cover-hero {
  background: #1a6968;
  color: white;
  padding: 36pt 48pt 32pt;
  flex-shrink: 0;
}
.cover-logo-row { display: flex; align-items: center; gap: 10pt; margin-bottom: 20pt; }
.cover-logo-box {
  width: 28pt; height: 28pt; background: rgba(255,255,255,0.15);
  border-radius: 5pt; color: white; font-weight: 700; font-size: 15pt;
  display: flex; align-items: center; justify-content: center;
}
.cover-brand { font-weight: 700; font-size: 13pt; letter-spacing: 0.05em; }
.cover-brand-sub { font-size: 7pt; letter-spacing: 0.15em; opacity: 0.7; margin-top: 2pt; }
.cover-eyebrow { font-size: 7pt; letter-spacing: 0.12em; opacity: 0.75; margin-bottom: 8pt; text-transform: uppercase; }
.cover-title { font-family: 'IBM Plex Serif', serif; font-size: 28pt; font-weight: 600; line-height: 1.15; }
.cover-subtitle { font-size: 9pt; opacity: 0.75; margin-top: 6pt; }

.cover-meta {
  padding: 18pt 48pt;
  display: flex;
  gap: 0;
  border-bottom: 1pt solid #e8e8e8;
  flex-shrink: 0;
}
.cover-meta-cell {
  flex: 1;
  padding-right: 24pt;
  border-right: 1pt solid #e8e8e8;
  margin-right: 24pt;
}
.cover-meta-cell:last-child { border-right: none; margin-right: 0; }
.meta-label { font-size: 7pt; font-weight: 600; letter-spacing: 0.08em; color: #888; text-transform: uppercase; margin-bottom: 4pt; }
.meta-value { font-size: 9.5pt; color: #1a1a1a; }

.cover-about {
  margin: 18pt 48pt;
  padding: 14pt 16pt;
  border-left: 3pt solid #1a6968;
  background: #f7fafa;
  font-size: 8pt;
  line-height: 1.6;
  color: #444;
  flex-shrink: 0;
}

.cover-contents { padding: 12pt 48pt 0; flex-shrink: 0; }
.contents-label { font-size: 8pt; font-weight: 600; letter-spacing: 0.1em; color: #888; text-transform: uppercase; margin-bottom: 10pt; }
.contents-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5pt 32pt; }
.contents-row { display: flex; align-items: baseline; gap: 6pt; font-size: 8pt; }
.contents-num { color: #1a6968; font-weight: 600; min-width: 16pt; }
.contents-name { flex: 1; }
.contents-page { color: #888; }

/* ── Section cards ─────────────────────────────────────────── */
.page-body { padding: 20pt 36pt; flex: 1; overflow: hidden; }

.section {
  border: 1pt solid #e0e0e0;
  border-radius: 5pt;
  overflow: hidden;
  margin-bottom: 16pt;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8pt 14pt;
  background: #f9f9f9;
  border-bottom: 1pt solid #e0e0e0;
}
.section-left { display: flex; align-items: center; gap: 10pt; }
.section-num {
  width: 22pt; height: 22pt; background: #e8f3f3; border-radius: 4pt;
  color: #1a6968; font-weight: 700; font-size: 9pt;
  display: flex; align-items: center; justify-content: center;
}
.section-title { font-size: 11pt; font-weight: 600; }
.section-note { font-size: 7pt; color: #888; font-style: italic; }

.section-body { padding: 12pt 14pt; }

/* ── Fields ────────────────────────────────────────────────── */
.fields-row { display: flex; gap: 0; margin-bottom: 12pt; }
.fields-row:last-child { margin-bottom: 0; }

.field { padding-right: 20pt; }
.field:last-child { padding-right: 0; }
.col-full  { flex: 1; }
.col-half  { flex: 1; max-width: 50%; }
.col-third { flex: 1; max-width: 33.33%; }

.field-label {
  font-size: 6.5pt;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #888;
  text-transform: uppercase;
  margin-bottom: 3pt;
}
.field-value {
  font-size: 9pt;
  color: #1a1a1a;
  border-bottom: 1pt solid #e0e0e0;
  padding-bottom: 4pt;
  min-height: 16pt;
}

/* ── Static content blocks ─────────────────────────────────── */
.info-box {
  background: #f0f7f7;
  border-left: 2pt solid #1a6968;
  padding: 10pt 12pt;
  font-size: 8pt;
  line-height: 1.6;
  color: #444;
  margin-bottom: 12pt;
}

.benefits-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; }
.benefit-card {
  border: 1pt solid #e0e0e0;
  border-radius: 4pt;
  padding: 9pt 11pt;
  display: flex;
  align-items: flex-start;
  gap: 8pt;
}
.benefit-icon {
  width: 16pt; height: 16pt; background: #e8f3f3; border-radius: 50%;
  color: #1a6968; font-weight: 700; font-size: 9pt;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.benefit-name { font-size: 8.5pt; font-weight: 600; }
.benefit-sub  { font-size: 7pt; color: #888; margin-top: 1pt; }

.cert-statement {
  border: 1pt solid #e0e0e0;
  border-radius: 5pt;
  padding: 20pt 24pt;
  margin-bottom: 16pt;
  font-size: 8.5pt;
  line-height: 1.7;
  color: #444;
}
.sig-row {
  display: flex;
  gap: 32pt;
  margin-top: 24pt;
}
.sig-block { flex: 1; }
.sig-line { border-bottom: 1pt solid #1a1a1a; height: 24pt; margin-bottom: 4pt; }
.sig-label { font-size: 7pt; color: #888; }

.confidential { color: #c0392b; font-weight: 600; letter-spacing: 0.08em; }
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════
     PAGE 1 · COVER
     ══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="cover-hero">
    <div class="cover-logo-row">
      <div class="cover-logo-box">${employer.charAt(0).toUpperCase()}</div>
      <div>
        <div class="cover-brand">${employer.toUpperCase()}</div>
        <div class="cover-brand-sub">TALENT &nbsp;·&nbsp; COMPLIANCE &nbsp;·&nbsp; MOBILITY</div>
      </div>
    </div>
    <div class="cover-eyebrow">U.S. Department of Labor &nbsp;·&nbsp; Form Compliance</div>
    <div class="cover-title">Public Access File</div>
    <div class="cover-subtitle">H-1B Nonimmigrant Worker &nbsp;·&nbsp; Labor Condition Application Record</div>
  </div>

  <div class="cover-meta">
    <div class="cover-meta-cell">
      <div class="meta-label">Document Reference</div>
      <div class="meta-value">${docRef}</div>
    </div>
    <div class="cover-meta-cell">
      <div class="meta-label">Worksite Jurisdiction</div>
      <div class="meta-value">${worksite}</div>
    </div>
    <div class="cover-meta-cell">
      <div class="meta-label">Prepared Date</div>
      <div class="meta-value">${today()}</div>
    </div>
  </div>

  <div class="cover-about">
    <strong>About this file.</strong> This Public Access File contains the documentation required by 20 CFR §655.760
    in support of the Labor Condition Application (LCA) filed for an H-1B nonimmigrant worker. It is maintained by
    ${employer} and must be made available for public examination within one (1) working day after the date the LCA
    is filed with the U.S. Department of Labor.
  </div>

  <div class="cover-contents">
    <div class="contents-label">Contents</div>
    <div class="contents-grid">
      <div class="contents-row"><span class="contents-num">01</span><span class="contents-name">Employer Information</span><span class="contents-page">p. 2</span></div>
      <div class="contents-row"><span class="contents-num">06</span><span class="contents-name">Benefits Summary</span><span class="contents-page">p. 4</span></div>
      <div class="contents-row"><span class="contents-num">02</span><span class="contents-name">Employee Information</span><span class="contents-page">p. 2</span></div>
      <div class="contents-row"><span class="contents-num">07</span><span class="contents-name">Notice of Filing / Posting</span><span class="contents-page">p. 4</span></div>
      <div class="contents-row"><span class="contents-num">03</span><span class="contents-name">Certified LCA</span><span class="contents-page">p. 3</span></div>
      <div class="contents-row"><span class="contents-num">08</span><span class="contents-name">H-1B Dependency</span><span class="contents-page">p. 5</span></div>
      <div class="contents-row"><span class="contents-num">04</span><span class="contents-name">Wage Rate Documentation</span><span class="contents-page">p. 3</span></div>
      <div class="contents-row"><span class="contents-num">09</span><span class="contents-name">Supporting Documents</span><span class="contents-page">p. 5</span></div>
      <div class="contents-row"><span class="contents-num">05</span><span class="contents-name">Actual Wage Memorandum</span><span class="contents-page">p. 3</span></div>
      <div class="contents-row"><span class="contents-num">10</span><span class="contents-name">Compliance &amp; Certification</span><span class="contents-page">p. 6</span></div>
    </div>
  </div>

  <div class="page-footer">
    <span>${employer.toUpperCase()}</span>
    <span>1200 Allegheny Plaza, Suite 400 &nbsp;·&nbsp; Charleston, WV 25301 &nbsp;·&nbsp; acmeresources.com</span>
    <span class="confidential">CONFIDENTIAL</span>
  </div>
</div>


<!-- ═══════════════════════════════════════════════════════════
     PAGE 2 · EMPLOYER + EMPLOYEE INFORMATION
     ══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-left">
      <div class="page-header-logo">${employer.charAt(0).toUpperCase()}</div>
      <span>${employer} &nbsp;·&nbsp; Public Access File</span>
    </div>
    <div class="page-header-right">H-1B &nbsp; PAF</div>
  </div>

  <div class="page-body">
    <div class="section">
      <div class="section-header">
        <div class="section-left">
          <div class="section-num">01</div>
          <div class="section-title">Employer Information</div>
        </div>
        <div class="section-note">Required · 20 CFR §655.760(a)</div>
      </div>
      <div class="section-body">
        <div class="fields-row">
          ${field('Employer Name', `<strong>${employer}</strong>`)}
          ${field('Federal Employer ID (FEIN)', '', { half: true })}
        </div>
        <div class="fields-row">
          ${field('Registered Business Address', worksite)}
        </div>
        <div class="fields-row">
          ${field('HR / Immigration Contact', '', { half: true })}
          ${field('Phone Number', '', { half: true })}
        </div>
        <div class="fields-row">
          ${field('Email Address', '', { half: true })}
          ${field('Corporate Website', '', { half: true })}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-left">
          <div class="section-num">02</div>
          <div class="section-title">Employee Information</div>
        </div>
        <div class="section-note">H-1B Beneficiary</div>
      </div>
      <div class="section-body">
        <div class="fields-row">
          ${field('Employee Full Legal Name', employee)}
        </div>
        <div class="fields-row">
          ${field('Job Title', position, { half: true })}
          ${field('SOC Occupation Code', socCode, { half: true })}
        </div>
        <div class="fields-row">
          ${field('Authorized Work Location(s)', worksite)}
        </div>
        <div class="fields-row">
          ${field('Employment Start Date', startDate, { half: true })}
          ${field('Employment End Date', endDate, { half: true })}
        </div>
        <div class="fields-row">
          ${field('Visa Classification', 'H-1B Specialty Occupation', { half: true })}
          ${field('Full-Time / Part-Time', 'Full-Time', { half: true })}
        </div>
      </div>
    </div>
  </div>

  <div class="page-footer">
    <span>${employer.toUpperCase()} &nbsp; PAF / H-1B</span>
    <span>Page 2 of 6</span>
    <span>acmeresources.com</span>
  </div>
</div>


<!-- ═══════════════════════════════════════════════════════════
     PAGE 3 · CERTIFIED LCA + WAGE RATE + ACTUAL WAGE MEMO
     ══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-left">
      <div class="page-header-logo">${employer.charAt(0).toUpperCase()}</div>
      <span>${employer} &nbsp;·&nbsp; Public Access File</span>
    </div>
    <div class="page-header-right">H-1B &nbsp; PAF</div>
  </div>

  <div class="page-body">
    <div class="section">
      <div class="section-header">
        <div class="section-left">
          <div class="section-num">03</div>
          <div class="section-title">Certified Labor Condition Application</div>
        </div>
        <div class="section-note">ETA Form 9035 / 9035E</div>
      </div>
      <div class="section-body">
        <div class="fields-row">
          ${field('LCA Case Number', docRef, { third: true })}
          ${field('Validity Start Date', startDate, { third: true })}
          ${field('Validity End Date', endDate, { third: true })}
        </div>
        <div style="font-size:8pt; color:#555; margin-top:8pt;">
          ☐ &nbsp;<strong>Certified ETA Form 9035 / 9035E</strong> — signed copy attached<br>
          <span style="margin-left:16pt;">☐ &nbsp;<strong>Cover letter</strong> from the U.S. Department of Labor confirming certification</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-left">
          <div class="section-num">04</div>
          <div class="section-title">Wage Rate Documentation</div>
        </div>
        <div class="section-note">Prevailing &amp; offered wage</div>
      </div>
      <div class="section-body">
        <div class="fields-row">
          ${field('Offered Salary / Wage', wageRange ? `$ ${wageRange}` : '', { third: true })}
          ${field('Pay Frequency', 'Annually', { third: true })}
          ${field('Wage Level', '', { third: true })}
        </div>
        <div class="fields-row">
          ${field('Prevailing Wage Source', 'U.S. Department of Labor / FLC Data Center', { half: true })}
          ${field('Prevailing Wage Amount', prevWage, { half: true })}
        </div>
        <div class="fields-row">
          ${field('Full-Time / Part-Time', 'Full-Time', { half: true })}
          ${field('Source Publication Date', '', { half: true })}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-left">
          <div class="section-num">05</div>
          <div class="section-title">Actual Wage Memorandum</div>
        </div>
        <div class="section-note">Methodology statement</div>
      </div>
      <div class="section-body">
        <div class="info-box">
          Required statement. Describe the wage system used by ${employer} to determine compensation for workers in the
          same role with substantially similar experience and qualifications, including factors used (experience,
          education, specialization, responsibility, location).
        </div>
        <div style="border: 1pt solid #e0e0e0; border-radius: 4pt; height: 54pt;"></div>
      </div>
    </div>
  </div>

  <div class="page-footer">
    <span>${employer.toUpperCase()} &nbsp; PAF / H-1B</span>
    <span>Page 3 of 6</span>
    <span>acmeresources.com</span>
  </div>
</div>


<!-- ═══════════════════════════════════════════════════════════
     PAGE 4 · BENEFITS SUMMARY + NOTICE OF FILING
     ══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-left">
      <div class="page-header-logo">${employer.charAt(0).toUpperCase()}</div>
      <span>${employer} &nbsp;·&nbsp; Public Access File</span>
    </div>
    <div class="page-header-right">H-1B &nbsp; PAF</div>
  </div>

  <div class="page-body">
    <div class="section">
      <div class="section-header">
        <div class="section-left">
          <div class="section-num">06</div>
          <div class="section-title">Benefits Summary</div>
        </div>
        <div class="section-note">Parity with U.S. workers</div>
      </div>
      <div class="section-body">
        <div class="info-box" style="margin-bottom:12pt;">
          ${employer} affirms that H-1B nonimmigrant workers are offered benefits on the same basis and in accordance
          with the same criteria as similarly employed U.S. workers.
        </div>
        <div class="benefits-grid">
          <div class="benefit-card">
            <div class="benefit-icon">+</div>
            <div><div class="benefit-name">Medical Insurance</div><div class="benefit-sub">Health, dental, vision coverage</div></div>
          </div>
          <div class="benefit-card">
            <div class="benefit-icon">◎</div>
            <div><div class="benefit-name">Paid Time Off</div><div class="benefit-sub">Vacation, sick leave, holidays</div></div>
          </div>
          <div class="benefit-card">
            <div class="benefit-icon">$</div>
            <div><div class="benefit-name">Retirement Benefits</div><div class="benefit-sub">401(k) with employer match</div></div>
          </div>
          <div class="benefit-card">
            <div class="benefit-icon">★</div>
            <div><div class="benefit-name">Bonus Programs</div><div class="benefit-sub">Performance &amp; annual bonuses</div></div>
          </div>
          <div class="benefit-card">
            <div class="benefit-icon">◈</div>
            <div><div class="benefit-name">Disability &amp; Life</div><div class="benefit-sub">Short-term, long-term, life insurance</div></div>
          </div>
          <div class="benefit-card">
            <div class="benefit-icon">◇</div>
            <div><div class="benefit-name">Other Benefits</div><div class="benefit-sub">Stock, options, professional development</div></div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-left">
          <div class="section-num">07</div>
          <div class="section-title">Notice of Filing &amp; Posting Evidence</div>
        </div>
        <div class="section-note">10 consecutive business days</div>
      </div>
      <div class="section-body">
        <div class="fields-row">
          ${field('Posting Start Date', postStart, { half: true })}
          ${field('Posting End Date', postEnd, { half: true })}
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8pt; margin-top:8pt;">
          <div style="border:1pt solid #e0e0e0; border-radius:4pt; padding:9pt 11pt; font-size:8pt;">
            <span style="color:#1a6968; font-weight:700; margin-right:6pt;">1</span> Physical Posting Location
            <div style="border-bottom:1pt solid #e0e0e0; margin-top:8pt; height:16pt;"></div>
          </div>
          <div style="border:1pt solid #e0e0e0; border-radius:4pt; padding:9pt 11pt; font-size:8pt;">
            <span style="color:#1a6968; font-weight:700; margin-right:6pt;">2</span> Physical Posting Location
            <div style="border-bottom:1pt solid #e0e0e0; margin-top:8pt; height:16pt;"></div>
          </div>
          <div style="border:1pt solid #e0e0e0; border-radius:4pt; padding:9pt 11pt; font-size:8pt;">
            <span style="color:#1a6968; font-weight:700; margin-right:6pt;">3</span> Electronic Notice Method
            <div style="border-bottom:1pt solid #e0e0e0; margin-top:8pt; height:16pt;"></div>
          </div>
          <div style="border:1pt solid #e0e0e0; border-radius:4pt; padding:9pt 11pt; font-size:8pt;">
            <span style="color:#1a6968; font-weight:700; margin-right:6pt;">4</span> Distribution Audience
            <div style="border-bottom:1pt solid #e0e0e0; margin-top:8pt; height:16pt;"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="page-footer">
    <span>${employer.toUpperCase()} &nbsp; PAF / H-1B</span>
    <span>Page 4 of 6</span>
    <span>acmeresources.com</span>
  </div>
</div>


<!-- ═══════════════════════════════════════════════════════════
     PAGE 5 · H-1B DEPENDENCY + SUPPORTING DOCUMENTS
     ══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-left">
      <div class="page-header-logo">${employer.charAt(0).toUpperCase()}</div>
      <span>${employer} &nbsp;·&nbsp; Public Access File</span>
    </div>
    <div class="page-header-right">H-1B &nbsp; PAF</div>
  </div>

  <div class="page-body">
    <div class="section">
      <div class="section-header">
        <div class="section-left">
          <div class="section-num">08</div>
          <div class="section-title">H-1B Dependency &amp; Willful Violator Status</div>
        </div>
        <div class="section-note">INA §212(n)(1)(E)–(G)</div>
      </div>
      <div class="section-body">
        <div style="font-size:8pt; line-height:1.7; color:#444;">
          ☐ &nbsp;<strong>H-1B Dependent Employer</strong> — additional attestations attached (displacement / recruitment)<br>
          ☑ &nbsp;<strong>Non-H-1B-Dependent Employer</strong> — standard attestations apply; no additional requirements<br>
          ☐ &nbsp;<strong>Willful Violator</strong> — employer has been found to be a willful violator within the past 3 years
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-left">
          <div class="section-num">09</div>
          <div class="section-title">Supporting Documents Checklist</div>
        </div>
        <div class="section-note">Retain for ${retainUntil || '1 year post-validity'}</div>
      </div>
      <div class="section-body">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:5pt; font-size:8pt; line-height:1.8;">
          <div>☑ &nbsp;Certified ETA-9035E (LCA)</div>
          <div>☑ &nbsp;Prevailing wage determination</div>
          <div>☑ &nbsp;Actual wage documentation</div>
          <div>☑ &nbsp;Benefits parity documentation</div>
          <div>☑ &nbsp;Public notice posting evidence</div>
          <div>☑ &nbsp;Employer H-1B dependency determination</div>
          <div>☑ &nbsp;Job description / offer letter</div>
          <div>☑ &nbsp;This Public Access File cover sheet</div>
        </div>
        <div class="fields-row" style="margin-top:14pt;">
          ${field('Records Retain Until', retainUntil, { half: true })}
          ${field('Custodian of Record', '', { half: true })}
        </div>
      </div>
    </div>
  </div>

  <div class="page-footer">
    <span>${employer.toUpperCase()} &nbsp; PAF / H-1B</span>
    <span>Page 5 of 6</span>
    <span>acmeresources.com</span>
  </div>
</div>


<!-- ═══════════════════════════════════════════════════════════
     PAGE 6 · COMPLIANCE & CERTIFICATION
     ══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-left">
      <div class="page-header-logo">${employer.charAt(0).toUpperCase()}</div>
      <span>${employer} &nbsp;·&nbsp; Public Access File</span>
    </div>
    <div class="page-header-right">H-1B &nbsp; PAF</div>
  </div>

  <div class="page-body">
    <div class="section">
      <div class="section-header">
        <div class="section-left">
          <div class="section-num">10</div>
          <div class="section-title">Compliance &amp; Certification</div>
        </div>
        <div class="section-note">Authorized signatory</div>
      </div>
      <div class="section-body">
        <div class="cert-statement">
          I, the undersigned authorized representative of <strong>${employer}</strong>, hereby certify under penalty
          of perjury that the foregoing statements and the information contained in this Public Access File are true
          and correct to the best of my knowledge, that this employer has filed or will timely file the required Labor
          Condition Application with the U.S. Department of Labor, and that this Public Access File has been prepared
          and is maintained in conformance with 20 CFR §655.760.
          <div class="sig-row">
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-label">Authorized Signature</div>
            </div>
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-label">Printed Name &amp; Title</div>
            </div>
            <div class="sig-block" style="max-width:120pt;">
              <div class="sig-line" style="text-align:right; padding-right:4pt; line-height:24pt; color:#1a1a1a; font-size:9pt;">${today()}</div>
              <div class="sig-label">Date</div>
            </div>
          </div>
        </div>

        <div style="font-size:7.5pt; color:#888; line-height:1.6; border-top:1pt solid #e8e8e8; padding-top:12pt;">
          This Public Access File was prepared by ${employer} in accordance with the H-1B program requirements of
          the Immigration and Nationality Act (INA) and the U.S. Department of Labor regulations at 20 CFR Part 655,
          Subpart H. Any person may request access to this file during normal business hours. Misrepresentation of
          material facts on a Labor Condition Application may result in civil money penalties and debarment.
        </div>
      </div>
    </div>
  </div>

  <div class="page-footer">
    <span>${employer.toUpperCase()} &nbsp; PAF / H-1B</span>
    <span>Page 6 of 6</span>
    <span class="confidential">CONFIDENTIAL</span>
  </div>
</div>

</body>
</html>`;
}

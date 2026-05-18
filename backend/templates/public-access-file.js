// Builds a "Public Access File · LCA Compliance" PDF-ready HTML document.
// Input: matter object from the store (id, employer, position, worksite, cms[], lca[], computed[], inserts)

function val(arr, label) {
  return arr?.find((f) => f.label === label)?.value ?? '—';
}

export function buildPublicAccessFileHTML(matter) {
  const employer      = matter.employer ?? '—';
  const position      = matter.position ?? '—';
  const worksite      = matter.worksite ?? '—';
  const lcaCertified  = matter.lcaCertified ?? '—';

  const validityStart = val(matter.cms, 'Validity Start');
  const validityEnd   = val(matter.cms, 'Validity End');
  const socCode       = val(matter.lca, 'Occupation Code (SOC)');
  const prevWage      = val(matter.lca, 'Prevailing Wage');
  const wageRange     = val(matter.lca, 'Wage Range');
  const postStart     = val(matter.lca, 'Posting Start');
  const postEnd       = val(matter.lca, 'Posting End');
  const retainUntil   = val(matter.computed, 'Retain Until');
  const validityPeriod = validityStart !== '—' && validityEnd !== '—'
    ? `${validityStart} → ${validityEnd}`
    : '—';
  const inserts = matter.inserts ?? '';

  const row = (label, value) => `
    <tr>
      <td class="label">${label}</td>
      <td class="value">${value}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 11pt;
    color: #111;
    background: #fff;
  }
  .page {
    width: 8.5in;
    min-height: 11in;
    padding: 1in 1.1in 1in 1.1in;
  }
  .cover-header {
    text-align: center;
    border-bottom: 2px solid #333;
    padding-bottom: 18px;
    margin-bottom: 28px;
  }
  .cover-header .label-small {
    font-family: 'Arial', sans-serif;
    font-size: 7pt;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #555;
    margin-bottom: 8px;
  }
  .cover-header h1 {
    font-size: 18pt;
    font-weight: 600;
    color: #111;
  }
  .cover-header .subtitle {
    font-family: 'Arial', sans-serif;
    font-size: 9pt;
    color: #444;
    margin-top: 4px;
  }
  table.fields {
    width: 100%;
    border-collapse: collapse;
    margin-top: 12px;
  }
  table.fields td {
    padding: 7px 0;
    border-bottom: 1px solid #e8e8e8;
    vertical-align: top;
  }
  td.label {
    width: 42%;
    font-family: 'Arial', sans-serif;
    font-size: 9pt;
    color: #555;
  }
  td.value {
    font-size: 10pt;
    font-weight: 600;
    color: #111;
  }
  .section-title {
    font-family: 'Arial', sans-serif;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #555;
    margin: 28px 0 10px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid #ccc;
  }
  .inserts-box {
    margin-top: 28px;
    padding: 12px 16px;
    background: #f8f5ff;
    border: 1px solid #d8ccf5;
    border-radius: 4px;
    font-family: 'Arial', sans-serif;
    font-size: 9pt;
    color: #5a3fa0;
  }
  .inserts-box .inserts-label {
    font-weight: 700;
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 4px;
  }
  .continuation {
    margin-top: 36px;
    padding-top: 16px;
    border-top: 1px dashed #ccc;
    font-family: 'Arial', sans-serif;
    font-size: 8.5pt;
    font-style: italic;
    color: #777;
  }
  .footer {
    position: fixed;
    bottom: 0.5in;
    left: 1.1in;
    right: 1.1in;
    font-family: 'Arial', sans-serif;
    font-size: 7pt;
    color: #999;
    border-top: 1px solid #ddd;
    padding-top: 6px;
    display: flex;
    justify-content: space-between;
  }
  @page { size: letter; margin: 0; }
</style>
</head>
<body>
<div class="page">

  <div class="cover-header">
    <div class="label-small">Public Access File · LCA Compliance</div>
    <h1>${employer}</h1>
    <div class="subtitle">LCA Certified: ${lcaCertified}</div>
  </div>

  <div class="section-title">Position &amp; Worksite</div>
  <table class="fields">
    ${row('Position Title', position)}
    ${row('Worksite', worksite)}
  </table>

  <div class="section-title">Labor Condition Application</div>
  <table class="fields">
    ${row('Occupation Code (SOC)', socCode)}
    ${row('Wage Range', wageRange)}
    ${row('Prevailing Wage', prevWage)}
    ${row('Posting Start', postStart)}
    ${row('Posting End', postEnd)}
  </table>

  <div class="section-title">Validity &amp; Retention</div>
  <table class="fields">
    ${row('Validity Period', validityPeriod)}
    ${row('Retain Until', retainUntil)}
  </table>

  ${inserts ? `
  <div class="inserts-box">
    <div class="inserts-label">Inserts</div>
    ${inserts}
  </div>` : ''}

  <div class="continuation">
    Continued: certified LCA pages 1–4, prevailing-wage chart, posting attestations, employer's written notice records…
  </div>

  <div class="footer">
    <span>${employer} — Public Access File</span>
    <span>Page 1 of 1</span>
  </div>

</div>
</body>
</html>`;
}

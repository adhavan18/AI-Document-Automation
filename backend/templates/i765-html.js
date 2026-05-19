// Pure HTML I-765 (Application for Employment Authorization) template.
// No background images — form structure fully replicated in CSS.
// Renders to PDF via Puppeteer at Letter (612×792pt) size.

function resolvedValue(c, field) {
  const choice = c.resolved?.[field];
  if (!choice) return c.questionnaire?.[field] ?? '';
  const row = (c.rows || []).find((r) => r.field === field);
  if (!row) return c.questionnaire?.[field] ?? '';
  return choice === 'document' ? row.extracted : row.questionnaire;
}

function parseName(full) {
  const parts = (full || '').trim().split(/\s+/);
  if (parts.length === 1) return { last: parts[0], first: '', middle: '' };
  if (parts.length === 2) return { last: parts[1], first: parts[0], middle: '' };
  return { last: parts[parts.length - 1], first: parts[0], middle: parts.slice(1, -1).join(' ') };
}

function parseAddress(addr) {
  const m = (addr || '').match(/^(.+?),\s*(.+?),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (m) return { street: m[1], city: m[2], state: m[3], zip: m[4] };
  return { street: addr || '', city: '', state: '', zip: '' };
}

function fmtDate(iso) {
  if (!iso || iso === 'Not found' || iso === '—') return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

const chk = (checked = false) =>
  `<span class="chk">${checked ? 'X' : ''}</span>`;

const fbox = (value = '', style = '') =>
  `<div class="fbox" style="${style}">${value}</div>`;

const ni = (num, body) =>
  `<div class="ni"><div class="ni-num">${num}</div><div class="ni-body">${body}</div></div>`;

const secHdr = (text) => `<div class="sec-hdr">${text}</div>`;
const italHdr = (text) => `<div class="ital-hdr">${text}</div>`;

export function buildI765Html(c) {
  const name      = parseName(resolvedValue(c, 'Full Legal Name') || c.applicant || '');
  const dob       = fmtDate(resolvedValue(c, 'Date of Birth'));
  const cob       = resolvedValue(c, 'Country of Birth');
  const passport  = resolvedValue(c, 'Passport Number');
  const passExp   = fmtDate(resolvedValue(c, 'Passport Expiry'));
  const entryDate = fmtDate(resolvedValue(c, 'Most Recent Entry Date'));
  const visa      = resolvedValue(c, 'Visa Class on Entry');
  const addr      = parseAddress(resolvedValue(c, 'Current Address'));
  const today     = fmtDate(new Date().toISOString().split('T')[0]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:Arial,Helvetica,sans-serif; font-size:8pt; color:#000; background:white; }
@page { size:Letter; margin:0; }

.page {
  width:612pt; height:792pt;
  padding:16pt 28pt 16pt 28pt;
  overflow:hidden;
  page-break-after:always;
  position:relative;
}

/* Structural */
.bar      { background:#000; height:5pt; margin:4pt 0; }
.two-col  { display:flex; gap:10pt; }
.col-l    { flex:0 0 272pt; }
.col-r    { flex:1; }

/* Headers */
.sec-hdr  { background:#c8c8c8; font-weight:bold; font-size:8.5pt; padding:2pt 4pt; border:0.5pt solid #555; margin-bottom:3pt; margin-top:3pt; }
.ital-hdr { background:#e4e4e4; font-weight:bold; font-style:italic; font-size:8.5pt; padding:2pt 4pt; margin-bottom:3pt; margin-top:3pt; }

/* Form items */
.ni      { display:flex; gap:3pt; margin-bottom:2.5pt; align-items:flex-start; }
.ni-num  { font-size:7.5pt; font-weight:bold; min-width:22pt; flex-shrink:0; padding-top:1pt; }
.ni-body { flex:1; font-size:7.5pt; line-height:1.35; }

/* Field boxes */
.fbox {
  border:0.75pt solid #000; height:14pt; padding:1pt 3pt;
  font-size:9pt; display:block; width:100%; margin-top:1.5pt;
}
.fbox-sm { display:inline-block; border:0.75pt solid #000; height:13pt; padding:1pt 2pt; font-size:9pt; vertical-align:bottom; }
.fbox-tall { border:0.75pt solid #000; height:28pt; padding:1pt 3pt; font-size:9pt; display:block; width:100%; margin-top:1.5pt; }

/* Checkbox */
.chk {
  display:inline-block; width:9pt; height:9pt; border:0.75pt solid #000;
  text-align:center; line-height:9pt; font-size:8pt; font-weight:bold;
  vertical-align:middle; margin-right:2pt; flex-shrink:0;
}

/* Footer */
.foot {
  position:absolute; bottom:7pt; left:28pt; right:28pt;
  display:flex; justify-content:space-between;
  font-size:6.5pt; border-top:0.5pt solid #888; padding-top:2pt;
}

/* Inline label+field combos */
.irow { display:flex; align-items:center; gap:6pt; flex-wrap:wrap; margin-top:2pt; }
</style>
</head>
<body>

<!-- ══════════════════════ PAGE 1 of 7 ══════════════════════ -->
<div class="page">

  <!-- Title header -->
  <div style="display:flex;align-items:flex-start;margin-bottom:3pt;">
    <div style="width:52pt;height:50pt;border:0.5pt solid #ccc;display:flex;align-items:center;justify-content:center;font-size:6pt;color:#aaa;text-align:center;">DHS<br>SEAL</div>
    <div style="flex:1;text-align:center;padding:0 8pt;">
      <div style="font-size:14pt;font-weight:bold;">Application For Employment Authorization</div>
      <div style="font-size:8.5pt;font-weight:bold;margin-top:2pt;">Department of Homeland Security</div>
      <div style="font-size:8pt;">U.S. Citizenship and Immigration Services</div>
    </div>
    <div style="text-align:right;font-size:7.5pt;line-height:1.5;font-weight:bold;">
      USCIS<br>Form I-765<br>OMB No. 1615-0040<br>Expires 08/31/2027
    </div>
  </div>

  <div class="bar"></div>

  <!-- For USCIS Use Only -->
  <div style="border:0.75pt solid #000;display:flex;margin-bottom:4pt;font-size:7pt;">
    <div style="padding:4pt 6pt;border-right:0.75pt solid #000;min-width:130pt;">
      <div style="margin-bottom:5pt;">${chk()} <strong>Authorization/Extension Valid From</strong><div style="border-bottom:0.75pt solid #000;width:80pt;height:10pt;margin-top:2pt;"></div></div>
      <div style="margin-bottom:5pt;">${chk()} <strong>Authorization/Extension Valid Through</strong><div style="border-bottom:0.75pt solid #000;width:80pt;height:10pt;margin-top:2pt;"></div></div>
      <div style="margin-bottom:3pt;"><strong>Alien Registration Number</strong> &nbsp;A-<span class="fbox-sm" style="width:68pt;"></span></div>
      <div><strong>Remarks</strong></div>
    </div>
    <div style="flex:1;border-right:0.75pt solid #000;padding:4pt 6pt;text-align:center;font-weight:bold;">Fee Stamp</div>
    <div style="flex:1;padding:4pt 6pt;text-align:center;font-weight:bold;">Action Block</div>
  </div>

  <!-- Attorney box -->
  <div style="border:0.75pt solid #000;display:flex;margin-bottom:4pt;font-size:7pt;">
    <div style="background:#e8e8e8;padding:3pt 5pt;border-right:0.75pt solid #000;min-width:80pt;font-weight:bold;font-size:7pt;">
      To be completed by an Attorney or Accredited Representative (if any).
    </div>
    <div style="padding:3pt 5pt;border-right:0.75pt solid #000;width:110pt;">
      ${chk()} Select this box if Form G-28 is attached.
    </div>
    <div style="padding:3pt 5pt;border-right:0.75pt solid #000;flex:1;">
      Attorney State Bar Number (if applicable)<div class="fbox" style="margin-top:2pt;height:12pt;"></div>
    </div>
    <div style="padding:3pt 5pt;flex:1.5;">
      Attorney or Accredited Representative USCIS Online Account Number (if any)<div class="fbox" style="margin-top:2pt;height:12pt;"></div>
    </div>
  </div>

  <div style="font-weight:bold;font-size:8.5pt;margin-bottom:4pt;">&#9658; START HERE - Type or print in black ink.</div>

  <div class="two-col">
    <!-- LEFT: Part 1 + Part 2 name -->
    <div class="col-l">
      ${secHdr('Part 1.&nbsp; Reason for Applying')}
      <div style="font-size:7.5pt;margin-bottom:3pt;"><strong>I am applying for</strong> (select <strong>only one</strong> box):</div>

      ${ni('1.a.', `${chk(true)}&nbsp;Initial permission to accept employment.`)}
      ${ni('1.b.', `${chk(false)}&nbsp;Replacement of lost, stolen, or damaged employment authorization document, or correction of my employment authorization document NOT DUE to U.S. Citizenship and Immigration Services (USCIS) error.
        <div style="font-size:7pt;margin-top:2pt;"><strong>NOTE:</strong> Replacement (correction) of an employment authorization document due to USCIS error does not require a new Form I-765 and filing fee. Refer to <span style="color:#00f;">www.uscis.gov/i-765</span> for further details.</div>`)}
      ${ni('1.c.', `${chk(false)}&nbsp;Renewal of my permission to accept employment. (Attach a copy of your previous employment authorization document.)`)}

      ${secHdr('Part 2.&nbsp; Information About You')}
      ${italHdr('Your Full Legal Name')}

      ${ni('1.a.', `<div style="font-size:7pt;">Family Name (Last Name)</div>${fbox(name.last)}`)}
      ${ni('1.b.', `<div style="font-size:7pt;">Given Name (First Name)</div>${fbox(name.first)}`)}
      ${ni('1.c.', `<div style="font-size:7pt;">Middle Name</div>${fbox(name.middle)}`)}
    </div>

    <!-- RIGHT: Other Names Used -->
    <div class="col-r">
      ${italHdr('Other Names Used')}
      <div style="font-size:7pt;margin-bottom:4pt;">Provide all other names you have ever used, including aliases, maiden name, and nicknames. If you need extra space to complete this section, use the space provided in <strong>Part 6. Additional Information</strong>.</div>

      ${['2','3','4'].map(n => `
        ${ni(`${n}.a.`, `<div style="font-size:7pt;">Family Name (Last Name)</div>${fbox('')}`)}
        ${ni(`${n}.b.`, `<div style="font-size:7pt;">Given Name (First Name)</div>${fbox('')}`)}
        ${ni(`${n}.c.`, `<div style="font-size:7pt;">Middle Name</div>${fbox('')}`)}
      `).join('')}
    </div>
  </div>

  <div class="foot"><span>Form I-765 &nbsp; Edition 08/21/25</span><span>Page 1 of 7</span></div>
</div>

<!-- ══════════════════════ PAGE 2 of 7 ══════════════════════ -->
<div class="page">
  <div class="bar"></div>

  <div class="two-col">
    <div class="col-l">
      ${secHdr('Part 2.&nbsp; Information About You <span style="font-weight:normal">(continued)</span>')}
      ${italHdr('Your U.S. Mailing Address')}

      ${ni('5.a.', `<div style="font-size:7pt;">In Care Of Name (if any)</div>${fbox('')}`)}
      ${ni('5.b.', `<div style="font-size:7pt;">Street Number and Name</div>${fbox(addr.street)}`)}
      ${ni('5.c.', `<div class="irow">${chk()}<span style="font-size:7pt;">Apt.</span>${chk()}<span style="font-size:7pt;">Ste.</span>${chk()}<span style="font-size:7pt;">Flr.</span><span class="fbox-sm" style="width:120pt;"></span></div>`)}
      ${ni('5.d.', `<div style="font-size:7pt;">City or Town</div>${fbox(addr.city)}`)}
      ${ni('', `<div style="display:flex;gap:8pt;">
        <div style="flex:0 0 75pt;"><div style="font-size:7pt;">5.e. State</div>${fbox(addr.state)}</div>
        <div style="flex:1;"><div style="font-size:7pt;">5.f. ZIP Code</div>${fbox(addr.zip)}</div>
      </div>`)}

      ${ni('6.', `<div style="font-size:7.5pt;">Is your current mailing address the same as your physical address?</div>
        <div style="margin-top:2pt;">${chk(true)}<span style="font-size:7.5pt;margin-right:12pt">Yes</span>${chk()}<span style="font-size:7.5pt;">No</span></div>
        <div style="font-size:7pt;margin-top:2pt;"><strong>NOTE:</strong> If you answered "No" to <strong>Item Number 6.</strong>, provide your physical address below.</div>`)}

      ${italHdr('U.S. Physical Address')}
      ${ni('7.a.', `<div style="font-size:7pt;">Street Number and Name</div>${fbox('')}`)}
      ${ni('7.b.', `<div class="irow">${chk()}<span style="font-size:7pt;">Apt.</span>${chk()}<span style="font-size:7pt;">Ste.</span>${chk()}<span style="font-size:7pt;">Flr.</span><span class="fbox-sm" style="width:120pt;"></span></div>`)}
      ${ni('7.c.', `<div style="font-size:7pt;">City or Town</div>${fbox('')}`)}
      ${ni('', `<div style="display:flex;gap:8pt;">
        <div style="flex:0 0 75pt;"><div style="font-size:7pt;">7.d. State</div>${fbox('')}</div>
        <div style="flex:1;"><div style="font-size:7pt;">7.e. ZIP Code</div>${fbox('')}</div>
      </div>`)}
    </div>

    <div class="col-r">
      ${italHdr('Other Information')}

      ${ni('8.', `<div style="font-size:7.5pt;">Alien Registration Number (A-Number) (if any)</div>
        <div style="margin-top:2pt;">&#9658; A-<span class="fbox-sm" style="width:95pt;"></span></div>`)}
      ${ni('9.', `<div style="font-size:7.5pt;">USCIS Online Account Number (if any)</div>
        <div style="margin-top:2pt;">&#9658; <span class="fbox-sm" style="width:110pt;"></span></div>`)}
      ${ni('10.', `<div style="display:flex;align-items:center;gap:14pt;font-size:7.5pt;">
        <span>Sex</span>
        <span>${chk()} Male</span>
        <span>${chk(true)} Female</span>
      </div>`)}
      ${ni('11.', `<div style="font-size:7.5pt;margin-bottom:2pt;">Marital Status</div>
        <div style="display:flex;gap:8pt;flex-wrap:wrap;font-size:7.5pt;">
          <span>${chk()} Single</span>
          <span>${chk(true)} Married</span>
          <span>${chk()} Divorced</span>
          <span>${chk()} Widowed</span>
        </div>`)}
      ${ni('12.', `<div style="font-size:7.5pt;">Have you previously filed Form I-765?</div>
        <div style="margin-top:2pt;font-size:7.5pt;">${chk()} Yes &nbsp;&nbsp; ${chk(true)} No</div>`)}
      ${ni('13.', `<div style="font-size:7.5pt;">Provide your Social Security number (SSN) (if known).</div>
        <div style="margin-top:2pt;">&#9658; <span class="fbox-sm" style="width:110pt;"></span></div>`)}

      ${italHdr('Your Country or Countries of Citizenship or Nationality')}
      <div style="font-size:7pt;margin-bottom:3pt;">List all countries where you are currently a citizen or national. If you need extra space to complete this item, use the space provided in <strong>Part 6. Additional Information</strong>.</div>

      ${ni('14.a.', `<div style="font-size:7pt;">Country</div>${fbox(cob)}`)}
      ${ni('14.b.', `<div style="font-size:7pt;">Country</div>${fbox('')}`)}
    </div>
  </div>

  <div class="foot"><span>Form I-765 &nbsp; Edition 08/21/25</span><span>Page 2 of 7</span></div>
</div>

<!-- ══════════════════════ PAGE 3 of 7 ══════════════════════ -->
<div class="page">
  <div class="bar"></div>

  <div class="two-col">
    <div class="col-l">
      ${secHdr('Part 2.&nbsp; Information About You <span style="font-weight:normal">(continued)</span>')}
      ${italHdr('Place of Birth')}
      <div style="font-size:7pt;margin-bottom:3pt;">List the city/town/village, state/province, and country where you were born.</div>

      ${ni('15.a.', `<div style="font-size:7pt;">City/Town/Village of Birth</div>${fbox('')}`)}
      ${ni('15.b.', `<div style="font-size:7pt;">State/Province of Birth</div>${fbox('')}`)}
      ${ni('15.c.', `<div style="font-size:7pt;">Country of Birth</div>${fbox(cob)}`)}
      ${ni('16.', `<div class="irow"><span style="font-size:7.5pt;">Date of Birth (mm/dd/yyyy)</span><span class="fbox-sm" style="width:75pt;">${dob}</span></div>`)}

      ${italHdr('Information About Your Last Arrival in the United States')}

      ${ni('17.', `<div style="font-size:7.5pt;">Form I-94 Arrival-Departure Record Number (if any)</div>
        <div style="margin-top:2pt;">&#9658; <span class="fbox-sm" style="width:115pt;"></span></div>`)}
      ${ni('18.', `<div style="font-size:7.5pt;">Passport Number of Your Most Recently Issued Passport</div>${fbox(passport)}`)}
      ${ni('19.', `<div style="font-size:7.5pt;">Travel Document Number (if any)</div>${fbox('')}`)}
      ${ni('20.', `<div style="font-size:7.5pt;">Country That Issued Your Passport or Travel Document</div>${fbox(cob)}`)}
      ${ni('21.', `<div class="irow" style="flex-wrap:wrap;">
        <span style="font-size:7.5pt;">Expiration Date for Passport or Travel Document (mm/dd/yyyy)</span>
        <span class="fbox-sm" style="width:72pt;">${passExp}</span>
      </div>`)}
      ${ni('22.', `<div class="irow" style="flex-wrap:wrap;">
        <span style="font-size:7.5pt;">Date of Your Last Arrival Into the United States, On or About (mm/dd/yyyy)</span>
        <span class="fbox-sm" style="width:72pt;">${entryDate}</span>
      </div>`)}
      ${ni('23.', `<div style="font-size:7.5pt;">Place of Your Last Arrival Into the United States</div>${fbox('')}`)}
      ${ni('24.', `<div style="font-size:7.5pt;">Immigration Status at Your Last Arrival (for example, B-2 visitor, F-1 student, or no status)</div>${fbox(visa)}`)}
      ${ni('25.', `<div style="font-size:7.5pt;">Your Current Immigration Status or Category (for example, B-2 visitor, F-1 student, parolee, deferred action, or no status or category)</div>${fbox(visa)}`)}
      ${ni('26.', `<div style="font-size:7.5pt;">Student and Exchange Visitor Information System (SEVIS) Number (if any)</div>
        <div style="margin-top:2pt;">&#9658; N-<span class="fbox-sm" style="width:104pt;"></span></div>`)}
    </div>

    <div class="col-r">
      ${italHdr('Information About Your Eligibility Category')}

      ${ni('27.', `<div style="font-size:7.5pt;"><strong>Eligibility Category.</strong> Refer to the <strong>Who May File Form I-765</strong> section of the Form I-765 Instructions to determine the appropriate eligibility category for this application. Enter the appropriate letter and number for your eligibility category below (for example, (a)(8), (c)(17)(iii)).</div>
        <div style="margin-top:5pt;display:flex;align-items:center;justify-content:center;gap:3pt;font-size:11pt;">
          <span>(</span><div style="border:1.5pt solid #000;width:20pt;height:20pt;text-align:center;line-height:20pt;font-weight:bold;">c</div><span>)</span>
          <span>(</span><div style="border:1.5pt solid #000;width:20pt;height:20pt;text-align:center;line-height:20pt;font-weight:bold;">2</div><span>)</span>
          <span>(</span><div style="border:1.5pt solid #000;width:20pt;height:20pt;text-align:center;line-height:20pt;font-weight:bold;">6</div><span>)</span>
        </div>`)}

      ${ni('28.', `<div style="font-size:7.5pt;"><strong>(c)(3)(C) STEM OPT Eligibility Category.</strong> If you entered the eligibility category (c)(3)(C) in <strong>Item Number 27.</strong>, provide the information requested in <strong>Item Numbers 28.a - 28.c.</strong></div>`)}
      ${ni('28.a.', `<div style="font-size:7pt;">Degree</div>${fbox('')}`)}
      ${ni('28.b.', `<div style="font-size:7pt;">Employer's Name as Listed in E-Verify</div>${fbox('')}`)}
      ${ni('28.c.', `<div style="font-size:7pt;">Employer's E-Verify Company Identification Number or a Valid E-Verify Client Company Identification Number</div>${fbox('')}`)}

      ${ni('29.', `<div style="font-size:7.5pt;"><strong>(c)(26) Eligibility Category.</strong> If you entered the eligibility category (c)(26) in <strong>Item Number 27.</strong>, provide the receipt number of your H-1B spouse's most recent Form I-797 Notice for Form I-129, Petition for a Nonimmigrant Worker.</div>
        <div style="margin-top:2pt;">&#9658; <span class="fbox-sm" style="width:100pt;"></span></div>`)}

      ${ni('30.', `<div style="font-size:7.5pt;"><strong>(c)(8) Eligibility Category.</strong> If you entered the eligibility category (c)(8) in <strong>Item Number 27.</strong>, have you <strong>EVER</strong> been arrested for and/or convicted of any crime?</div>
        <div style="margin-top:2pt;">${chk()} Yes &nbsp;&nbsp; ${chk()} No</div>`)}

      ${ni('31.a.', `<div style="font-size:7.5pt;"><strong>(c)(35) and (c)(36) Eligibility Category.</strong> If you entered the eligibility category (c)(35) in <strong>Item Number 27.</strong>, please provide the receipt number of your Form I-797 Notice for Form I-140, Immigrant Petition for Alien Worker. If you entered the eligibility category (c)(36) in <strong>Item Number 27.</strong>, please provide the receipt number of your spouse's or parent's Form I-797 Notice for Form I-140.</div>
        <div style="margin-top:2pt;">&#9658; <span class="fbox-sm" style="width:100pt;"></span></div>`)}

      ${ni('31.b.', `<div style="font-size:7.5pt;">If you entered the eligibility category (c)(35) or (c)(36) in <strong>Item Number 27.</strong>, have you <strong>EVER</strong> been arrested for and/or convicted of any crime?</div>
        <div style="margin-top:2pt;">${chk()} Yes &nbsp;&nbsp; ${chk()} No</div>`)}
    </div>
  </div>

  <div class="foot"><span>Form I-765 &nbsp; Edition 08/21/25</span><span>Page 3 of 7</span></div>
</div>

<!-- ══════════════════════ PAGE 4 of 7 ══════════════════════ -->
<div class="page">
  <div class="bar"></div>

  <div class="two-col">
    <div class="col-l">
      ${secHdr('Part 3.&nbsp; Applicant\'s Statement, Contact Information, Certification, and Signature')}
      <div style="font-size:7pt;margin-bottom:3pt;"><strong>NOTE:</strong> Read the <strong>Penalties</strong> section of the Form I-765 Instructions before completing this section. You must file Form I-765 while in the United States.</div>

      ${italHdr('Applicant\'s Statement')}
      <div style="font-size:7pt;margin-bottom:3pt;"><strong>NOTE:</strong> Select the box for either <strong>Item Number 1.a.</strong> or <strong>1.b.</strong> If applicable, select the box for <strong>Item Number 2.</strong></div>

      ${ni('1.a.', `${chk(true)} I can read and understand English, and I have read and understand every question and instruction on this application and my answer to every question.`)}
      ${ni('1.b.', `${chk()} The interpreter named in <strong>Part 4.</strong> read to me every question and instruction on this application and my answer to every question in<br><span class="fbox-sm" style="width:175pt;margin:2pt 0;display:inline-block;"></span>, a language in which I am fluent, and I understood everything.`)}
      ${ni('2.', `${chk()} At my request, the preparer named in <strong>Part 5.</strong>,<br><span class="fbox-sm" style="width:175pt;margin:2pt 0;display:inline-block;"></span>, prepared this application for me based only upon information I provided or authorized.`)}

      ${italHdr('Applicant\'s Contact Information')}
      ${ni('3.', `<div style="font-size:7.5pt;">Applicant's Daytime Telephone Number</div>${fbox('')}`)}
      ${ni('4.', `<div style="font-size:7.5pt;">Applicant's Mobile Telephone Number (if any)</div>${fbox('')}`)}
      ${ni('5.', `<div style="font-size:7.5pt;">Applicant's Email Address (if any)</div>${fbox('')}`)}
      ${ni('6.', `${chk()} Select this box if you are a Salvadoran or Guatemalan national eligible for benefits under the ABC settlement agreement.`)}
    </div>

    <div class="col-r">
      ${italHdr('Applicant\'s Certification')}
      <div style="font-size:7pt;line-height:1.4;margin-bottom:5pt;">
        Copies of any documents I have submitted are exact photocopies of unaltered, original documents, and I understand that USCIS may require that I submit original documents to USCIS at a later date. Furthermore, I authorize the release of any information from any and all of my records that USCIS may need to determine my eligibility for the immigration benefit that I seek.
        <br><br>
        I furthermore authorize release of information contained in this application, in supporting documents, and in my USCIS records, to other entities and persons where necessary for the administration and enforcement of U.S. immigration law.
        <br><br>
        I understand that USCIS may require me to appear for an appointment to take my biometrics and, if required, I will be required to sign an oath reaffirming that:
        <br><br>
        <strong>1)</strong> I reviewed and provided or authorized all of the information in my application; and<br>
        <strong>2)</strong> I understood all of the information contained in, and submitted with, my application; and<br>
        <strong>3)</strong> All of this information was complete, true, and correct at the time of filing.
        <br><br>
        I certify, under penalty of perjury, that I provided or authorized all of the information in my application. I understand all of the information contained in, and submitted with, my application, and that all of this information is complete, true, and correct.
      </div>

      ${italHdr('Applicant\'s Signature')}
      ${ni('7.a.', `<div style="font-size:7.5pt;">Applicant's Signature</div>
        <div style="display:flex;align-items:center;gap:4pt;margin-top:2pt;">
          <span style="font-size:10pt;">&#9658;</span>${fbox('', 'flex:1;height:18pt;margin-top:0;')}
        </div>`)}
      ${ni('7.b.', `<div class="irow"><span style="font-size:7.5pt;">Date of Signature (mm/dd/yyyy)</span><span class="fbox-sm" style="width:72pt;">${today}</span></div>`)}
      <div style="font-size:7pt;margin:4pt 0;"><strong>NOTE TO ALL APPLICANTS:</strong> If you do not completely fill out this application or fail to submit required documents listed in the Instructions, USCIS may deny your application.</div>

      ${secHdr('Part 4.&nbsp; Interpreter\'s Contact Information, Certification, and Signature')}
      <div style="font-size:7.5pt;margin:2pt 0;">Provide the following information about the interpreter.</div>
      ${italHdr('Interpreter\'s Full Name')}
      ${ni('1.a.', `<div style="font-size:7pt;">Interpreter's Family Name (Last Name)</div>${fbox('')}`)}
      ${ni('1.b.', `<div style="font-size:7pt;">Interpreter's Given Name (First Name)</div>${fbox('')}`)}
      ${ni('2.', `<div style="font-size:7pt;">Interpreter's Business or Organization Name (if any)</div>${fbox('')}`)}
    </div>
  </div>

  <div class="foot"><span>Form I-765 &nbsp; Edition 08/21/25</span><span>Page 4 of 7</span></div>
</div>

<!-- ══════════════════════ PAGE 5 of 7 ══════════════════════ -->
<div class="page">
  <div class="bar"></div>
  <div style="font-size:7.5pt;margin-bottom:4pt;">Part 4. Interpreter's Contact Information, Certification, and Signature (continued)</div>

  <div class="two-col">
    <div class="col-l">
      ${italHdr('Interpreter\'s Mailing Address')}
      ${ni('3.a.', `<div style="font-size:7pt;">Street Number and Name</div>${fbox('')}`)}
      ${ni('3.b.', `<div class="irow">${chk()}<span style="font-size:7pt;">Apt.</span>${chk()}<span style="font-size:7pt;">Ste.</span>${chk()}<span style="font-size:7pt;">Flr.</span><span class="fbox-sm" style="width:95pt;"></span></div>`)}
      ${ni('3.c.', `<div style="font-size:7pt;">City or Town</div>${fbox('')}`)}
      ${ni('3.d.', `<div style="font-size:7pt;">State</div>${fbox('', 'width:60pt;')}`)}
      ${ni('3.e.', `<div style="font-size:7pt;">ZIP Code</div>${fbox('')}`)}
      ${ni('3.f.', `<div style="font-size:7pt;">Province</div>${fbox('')}`)}
      ${ni('3.g.', `<div style="font-size:7pt;">Postal Code</div>${fbox('')}`)}
      ${ni('3.h.', `<div style="font-size:7pt;">Country</div>${fbox('')}`)}

      ${italHdr('Interpreter\'s Contact Information')}
      ${ni('4.', `<div style="font-size:7pt;">Interpreter's Daytime Telephone Number</div>${fbox('')}`)}
      ${ni('5.', `<div style="font-size:7pt;">Interpreter's Mobile Telephone Number (if any)</div>${fbox('')}`)}
      ${ni('6.', `<div style="font-size:7pt;">Interpreter's Email Address (if any)</div>${fbox('')}`)}
    </div>

    <div class="col-r">
      ${italHdr('Interpreter\'s Certification')}
      <div style="font-size:7pt;line-height:1.4;margin-bottom:5pt;">I certify, under penalty of perjury, that I am fluent in English and <span class="fbox-sm" style="width:120pt;"></span>, which is the same language used in <strong>Item Number 1.b. in Part 3.</strong>, and that I have read every question and instruction on this application to this applicant in the identified language, and the applicant has confirmed that they understand every question and instruction on this application.</div>

      ${italHdr('Interpreter\'s Signature')}
      ${ni('7.a.', `<div style="font-size:7.5pt;">Interpreter's Signature</div>
        <div style="display:flex;align-items:center;gap:4pt;margin-top:2pt;">
          <span>&#9658;</span>${fbox('', 'flex:1;height:18pt;margin-top:0;')}
        </div>`)}
      ${ni('7.b.', `<div class="irow"><span style="font-size:7.5pt;">Date of Signature (mm/dd/yyyy)</span><span class="fbox-sm" style="width:72pt;"></span></div>`)}

      ${secHdr('Part 5.&nbsp; Contact Information, Declaration, and Signature of the Person Preparing this Application, if Other Than the Applicant')}
      <div style="font-size:7.5pt;margin:2pt 0;">Provide the following information about the preparer.</div>
      ${italHdr('Preparer\'s Full Name')}
      ${ni('1.a.', `<div style="font-size:7pt;">Preparer's Family Name (Last Name)</div>${fbox('')}`)}
      ${ni('1.b.', `<div style="font-size:7pt;">Preparer's Given Name (First Name)</div>${fbox('')}`)}
    </div>
  </div>

  <div class="foot"><span>Form I-765 &nbsp; Edition 08/21/25</span><span>Page 5 of 7</span></div>
</div>

<!-- ══════════════════════ PAGE 6 of 7 ══════════════════════ -->
<div class="page">
  <div class="bar"></div>
  <div style="font-size:7.5pt;margin-bottom:4pt;">Part 5. Contact Information, Declaration, and Signature of the Person Preparing this Application (continued)</div>

  <div class="two-col">
    <div class="col-l">
      ${italHdr('Preparer\'s Mailing Address')}
      ${ni('2.a.', `<div style="font-size:7pt;">Street Number and Name</div>${fbox('')}`)}
      ${ni('2.b.', `<div class="irow">${chk()}<span style="font-size:7pt;">Apt.</span>${chk()}<span style="font-size:7pt;">Ste.</span>${chk()}<span style="font-size:7pt;">Flr.</span><span class="fbox-sm" style="width:95pt;"></span></div>`)}
      ${ni('2.c.', `<div style="font-size:7pt;">City or Town</div>${fbox('')}`)}
      ${ni('2.d.', `<div style="font-size:7pt;">State</div>${fbox('', 'width:60pt;')}`)}
      ${ni('2.e.', `<div style="font-size:7pt;">ZIP Code</div>${fbox('')}`)}
      ${ni('2.f.', `<div style="font-size:7pt;">Province</div>${fbox('')}`)}
      ${ni('2.g.', `<div style="font-size:7pt;">Postal Code</div>${fbox('')}`)}
      ${ni('2.h.', `<div style="font-size:7pt;">Country</div>${fbox('')}`)}

      ${italHdr('Preparer\'s Contact Information')}
      ${ni('3.', `<div style="font-size:7pt;">Preparer's Daytime Telephone Number</div>${fbox('')}`)}
      ${ni('4.', `<div style="font-size:7pt;">Preparer's Mobile Telephone Number (if any)</div>${fbox('')}`)}
      ${ni('5.', `<div style="font-size:7pt;">Preparer's Email Address (if any)</div>${fbox('')}`)}
    </div>

    <div class="col-r">
      ${italHdr('Preparer\'s Statement')}
      <div style="font-size:7pt;line-height:1.4;margin-bottom:5pt;">I declare under penalty of perjury that I prepared this application at the request of the above-named applicant. The applicant then reviewed this completed application and stated that they understood all of the information contained in, and submitted with, this completed application.</div>
      ${ni('6.', `${chk()} I am not an attorney or accredited representative but have prepared this application on behalf of the applicant and with the applicant's consent.`)}

      ${italHdr('Preparer\'s Signature')}
      ${ni('7.a.', `<div style="font-size:7.5pt;">Preparer's Signature</div>
        <div style="display:flex;align-items:center;gap:4pt;margin-top:2pt;">
          <span>&#9658;</span>${fbox('', 'flex:1;height:18pt;margin-top:0;')}
        </div>`)}
      ${ni('7.b.', `<div class="irow"><span style="font-size:7.5pt;">Date of Signature (mm/dd/yyyy)</span><span class="fbox-sm" style="width:72pt;"></span></div>`)}
    </div>
  </div>

  <div class="foot"><span>Form I-765 &nbsp; Edition 08/21/25</span><span>Page 6 of 7</span></div>
</div>

<!-- ══════════════════════ PAGE 7 of 7 ══════════════════════ -->
<div class="page">
  <div class="bar"></div>

  ${secHdr('Part 6.&nbsp; Additional Information')}
  <div style="font-size:7.5pt;margin:3pt 0 6pt 0;">If you need extra space to complete any item within this application, use the space below. Identify the Part and Item Number applicable to your answer. Use as many continuation sheets as necessary.</div>

  ${Array(5).fill(0).map(() => `
  <div style="display:flex;gap:6pt;margin-bottom:6pt;align-items:flex-start;">
    <div style="font-size:7pt;min-width:60pt;">
      Part ____<br>Item Number ____
    </div>
    <div class="fbox-tall" style="flex:1;height:35pt;"></div>
  </div>
  `).join('')}

  <div class="foot"><span>Form I-765 &nbsp; Edition 08/21/25</span><span>Page 7 of 7</span></div>
</div>

</body>
</html>`;
}

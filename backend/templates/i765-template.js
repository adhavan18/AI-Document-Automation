// Form I-765 — Application for Employment Authorization
// Populated from UC3 case validation data (resolved values take precedence).

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
  // "142 Cypress Ln, Plano TX 75024"
  const m = (addr || '').match(/^(.+?),\s*([^,]+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (m) return { street: m[1], city: m[2], state: m[3], zip: m[4] };
  return { street: addr, city: '', state: '', zip: '' };
}

function fmtDate(iso) {
  if (!iso || iso === 'Not found' || iso === '—') return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

function today() {
  return fmtDate(new Date().toISOString().split('T')[0]);
}

export function buildI765HTML(c) {
  const name    = parseName(resolvedValue(c, 'Full Legal Name') || c.applicant);
  const dob     = fmtDate(resolvedValue(c, 'Date of Birth'));
  const cob     = resolvedValue(c, 'Country of Birth');
  const entryDate = fmtDate(resolvedValue(c, 'Most Recent Entry Date'));
  const visaClass = resolvedValue(c, 'Visa Class on Entry');
  const addr    = parseAddress(resolvedValue(c, 'Current Address'));
  const passportNo = resolvedValue(c, 'Passport Number');

  const css = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; color: #000; background: #fff; }
    .page { width: 8.5in; min-height: 11in; padding: 0.35in 0.45in; page-break-after: always; }
    .page:last-child { page-break-after: auto; }

    /* ── Header ── */
    .form-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
    .form-header-left { font-size: 7.5pt; line-height: 1.4; }
    .form-header-left .agency { font-weight: bold; font-size: 8pt; }
    .form-title-bar { background: #003366; color: #fff; text-align: center; padding: 5px 0 4px; margin-bottom: 6px; }
    .form-title-bar .title { font-size: 13pt; font-weight: bold; letter-spacing: 0.3px; }
    .form-title-bar .subtitle { font-size: 7.5pt; margin-top: 1px; }
    .omb-bar { display: flex; justify-content: space-between; font-size: 7pt; color: #333; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 2px 0; margin-bottom: 8px; }

    /* ── Parts / Sections ── */
    .part-header { background: #003366; color: #fff; font-weight: bold; font-size: 8.5pt; padding: 3px 6px; margin: 8px 0 4px; }
    .part-sub { font-size: 7.5pt; font-style: italic; color: #333; margin-bottom: 4px; }
    .instruction { font-size: 7.5pt; color: #333; margin-bottom: 5px; line-height: 1.4; }

    /* ── Field rows ── */
    .field-row { display: flex; gap: 6px; margin-bottom: 5px; align-items: flex-end; }
    .field-block { display: flex; flex-direction: column; flex: 1; }
    .field-block.w2  { flex: 2; }
    .field-block.w3  { flex: 3; }
    .field-block.w4  { flex: 4; }
    .field-block.w5  { flex: 5; }
    .field-block.w6  { flex: 6; }
    .field-block.fixed-sm  { flex: 0 0 1.1in; }
    .field-block.fixed-md  { flex: 0 0 1.6in; }
    .field-block.fixed-lg  { flex: 0 0 2.4in; }
    .field-label { font-size: 6.8pt; color: #333; margin-bottom: 2px; line-height: 1.2; }
    .field-label .item-no { font-weight: bold; color: #000; margin-right: 2px; }
    .field-box { border: 1px solid #000; min-height: 17px; padding: 1px 3px; font-size: 8.5pt; display: flex; align-items: center; background: #fff; }
    .field-box.shaded { background: #e8e8e8; }
    .field-box.filled { background: #f0f4ff; font-weight: 500; }
    .field-box.date { font-family: 'Courier New', monospace; letter-spacing: 0.5px; }

    /* ── Checkbox rows ── */
    .cb-group { display: flex; flex-direction: column; gap: 3px; margin-bottom: 5px; }
    .cb-row { display: flex; align-items: center; gap: 5px; font-size: 8pt; line-height: 1.3; }
    .cb-box { width: 11px; height: 11px; border: 1px solid #000; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 9pt; font-weight: bold; }
    .cb-inline { display: flex; gap: 14px; margin-bottom: 5px; }
    .cb-inline .cb-row { gap: 4px; }

    /* ── Table-style grid ── */
    .form-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    .form-table td, .form-table th { border: 1px solid #000; padding: 2px 4px; font-size: 8pt; vertical-align: top; }
    .form-table th { background: #003366; color: #fff; font-size: 7.5pt; font-weight: bold; padding: 3px 4px; }

    /* ── Signature area ── */
    .sig-area { border: 1px solid #000; min-height: 36px; margin-bottom: 4px; padding: 4px 6px; display: flex; align-items: flex-end; }
    .sig-label { font-size: 7pt; color: #333; }
    .sig-row { display: flex; gap: 8px; align-items: flex-end; }

    /* ── Divider / rule ── */
    .rule { border-top: 1px solid #000; margin: 7px 0; }
    .rule-thin { border-top: 1px solid #ccc; margin: 5px 0; }
    .page-footer { font-size: 7pt; color: #555; border-top: 1px solid #000; padding-top: 3px; margin-top: 10px; display: flex; justify-content: space-between; }

    /* ── Certification box ── */
    .cert-box { border: 1px solid #000; padding: 6px 8px; font-size: 7.5pt; line-height: 1.5; margin-bottom: 6px; background: #fafafa; }

    /* ── Shaded section header ── */
    .section-note { background: #f0f0f0; border: 1px solid #ccc; padding: 3px 6px; font-size: 7.5pt; color: #444; margin-bottom: 4px; }

    /* ── For Official Use Only box ── */
    .official-box { border: 2px solid #000; padding: 6px; font-size: 7.5pt; margin-bottom: 6px; }
    .official-box .title { font-weight: bold; text-align: center; font-size: 8pt; margin-bottom: 4px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 3px; }
  `;

  // Helper: single field block
  function fb(no, label, value, cls = '') {
    const filled = value ? ' filled' : '';
    return `<div class="field-block ${cls}">
      <div class="field-label"><span class="item-no">${no}.</span>${label}</div>
      <div class="field-box${filled}">${value || '&nbsp;'}</div>
    </div>`;
  }
  function fbDate(no, label, value, cls = '') {
    const filled = value ? ' filled' : '';
    return `<div class="field-block ${cls}">
      <div class="field-label"><span class="item-no">${no}.</span>${label}</div>
      <div class="field-box date${filled}">${value || 'MM/DD/YYYY'}</div>
    </div>`;
  }
  function cb(checked, label) {
    return `<div class="cb-row"><div class="cb-box">${checked ? '&#10003;' : ''}</div><span>${label}</span></div>`;
  }

  /* ────────────────────────────────────────────────────────────
     PAGE 1 — Parts 1 & 2 (top half)
  ──────────────────────────────────────────────────────────── */
  const page1 = `
  <div class="page">
    <!-- Header -->
    <div class="form-header">
      <div class="form-header-left">
        <div class="agency">Department of Homeland Security</div>
        <div>U.S. Citizenship and Immigration Services</div>
      </div>
      <div style="font-size:7pt; text-align:right; line-height:1.5;">
        <div style="font-weight:bold;">Form I-765</div>
        <div>OMB No. 1615-0040</div>
        <div>Expires 04/30/2026</div>
      </div>
    </div>

    <div class="form-title-bar">
      <div class="title">Application for Employment Authorization</div>
      <div class="subtitle">For USCIS Use Only &nbsp;|&nbsp; Read the instructions before completing this form.</div>
    </div>

    <div class="omb-bar">
      <span><strong>START HERE:</strong> Type or print in black ink.</span>
      <span>Form I-765 Edition 04/01/24 &nbsp;&bull;&nbsp; Page 1 of 5</span>
    </div>

    <!-- PART 1 -->
    <div class="part-header">Part 1. Reason for Applying</div>
    <div class="instruction">Select the appropriate box below. See the instructions for information about the filing fee.</div>

    <div class="cb-group" style="margin-bottom:6px;">
      ${cb(true,  '1.a. &nbsp;Initial permission to accept employment')}
      ${cb(false, '1.b. &nbsp;Renewal of my permission to accept employment (attach a copy of your previous EAD)')}
      ${cb(false, '1.c. &nbsp;Replacement of my lost, stolen, or damaged Employment Authorization Document (EAD)')}
    </div>

    <div class="field-row">
      ${fb('2', 'Eligibility Category (see instructions)', '(c)(26) — H-4 Dependent Spouse', 'w4')}
      <div class="field-block w2">
        <div class="field-label"><span class="item-no">2.a.</span>I am applying for an EAD based on my pending (Check one):</div>
        <div style="display:flex; gap:8px; margin-top:2px;">
          ${cb(false, 'Form I-485')}
          ${cb(false, 'Form I-589')}
          ${cb(false, 'Form I-590')}
        </div>
      </div>
    </div>

    <!-- PART 2 -->
    <div class="part-header">Part 2. Information About You</div>

    <div class="field-row">
      ${fb('3', 'Family Name (Last Name)', name.last, 'w3')}
      ${fb('4', 'Given Name (First Name)', name.first, 'w3')}
      ${fb('5', 'Middle Name (if applicable)', name.middle, 'w2')}
    </div>

    <div class="field-row">
      ${fb('6.a', 'Other Last Names Used (including Maiden Name)', '', 'w4')}
      ${fb('6.b', 'Other First/Middle Names Used', '', 'w4')}
    </div>

    <div class="field-row">
      ${fb('7', 'U.S. Social Security Number (if any)', '', 'fixed-md')}
      ${fb('8', 'USCIS Online Account Number (if any)', '', 'fixed-md')}
      ${fb('9', 'Alien Registration Number / USCIS Number (A-Number)', '', 'fixed-lg')}
    </div>

    <div class="field-row">
      ${fbDate('10.a', 'Date of Birth (MM/DD/YYYY)', dob, 'fixed-md')}
      ${fb('11', 'Country of Birth', cob, 'w3')}
      ${fb('12', 'Country of Citizenship or Nationality', cob, 'w3')}
    </div>

    <div class="field-row" style="align-items:flex-start;">
      <div class="field-block fixed-sm">
        <div class="field-label"><span class="item-no">13.</span>Gender</div>
        <div class="cb-group" style="flex-direction:row; gap:10px; margin-top:2px;">
          ${cb(false, 'Male')}
          ${cb(true,  'Female')}
        </div>
      </div>
      <div class="field-block fixed-md">
        <div class="field-label"><span class="item-no">14.</span>Marital Status</div>
        <div style="display:flex; gap:8px; margin-top:2px; flex-wrap:wrap;">
          ${cb(false, 'Single')}
          ${cb(true,  'Married')}
          ${cb(false, 'Divorced')}
          ${cb(false, 'Widowed')}
        </div>
      </div>
      ${fb('15', 'Height', '', 'fixed-sm')}
      ${fb('16', 'Hair Color', '', 'fixed-sm')}
      ${fb('17', 'Eye Color', '', 'fixed-sm')}
    </div>

    <div class="field-row">
      ${fb('18', 'Alien Admission Number or Petition Number (if any)', passportNo ? `Passport: ${passportNo}` : '', 'w4')}
      ${fbDate('19.a', 'Date of Last Entry into the United States (MM/DD/YYYY)', entryDate, 'fixed-md')}
    </div>

    <div class="field-row">
      ${fb('20', 'Place of Last Entry into the United States (City and State)', '', 'w4')}
      ${fb('21', 'Manner of Last Entry (Visa type, if known)', visaClass, 'w3')}
    </div>

    <div class="field-row">
      ${fb('22', 'Status at Last Entry', visaClass, 'w3')}
      ${fb('23', 'Current Immigration Status (if different from status at last entry)', visaClass, 'w3')}
    </div>

    <div class="field-row">
      ${fb('24', 'SEVIS Number (if applicable)', '', 'w3')}
      ${fb('25', 'Name of School (if applicable)', '', 'w5')}
    </div>

    <div class="rule"></div>
    <div style="font-size:7.5pt; font-weight:bold; margin-bottom:3px;">Mailing Address</div>
    <div class="field-row">
      ${fb('26.a', 'Street Number and Name', addr.street, 'w5')}
      ${fb('26.b', 'Apt. / Ste. / Flr.', '', 'fixed-sm')}
    </div>
    <div class="field-row">
      ${fb('26.c', 'City or Town', addr.city, 'w3')}
      ${fb('26.d', 'State', addr.state, 'fixed-sm')}
      ${fb('26.e', 'ZIP Code', addr.zip, 'fixed-sm')}
      ${fb('26.f', 'Province (foreign address only)', '', 'w2')}
      ${fb('26.g', 'Country (foreign address only)', '', 'w2')}
    </div>

    <div class="page-footer">
      <span>Form I-765 Edition 04/01/24</span>
      <span>Page 1 of 5</span>
    </div>
  </div>`;

  /* ────────────────────────────────────────────────────────────
     PAGE 2 — Part 2 continued + Part 3 Certification
  ──────────────────────────────────────────────────────────── */
  const page2 = `
  <div class="page">
    <div class="omb-bar">
      <span><strong>Form I-765</strong> &nbsp;Application for Employment Authorization</span>
      <span>OMB No. 1615-0040 &nbsp;&bull;&nbsp; Expires 04/30/2026 &nbsp;&bull;&nbsp; Page 2 of 5</span>
    </div>

    <div class="part-header">Part 2. Information About You (continued)</div>

    <div class="instruction">Physical Address in the United States (if different from mailing address above):</div>
    <div class="field-row">
      ${fb('27.a', 'Street Number and Name', '', 'w5')}
      ${fb('27.b', 'Apt. / Ste. / Flr.', '', 'fixed-sm')}
    </div>
    <div class="field-row">
      ${fb('27.c', 'City or Town', '', 'w3')}
      ${fb('27.d', 'State', '', 'fixed-sm')}
      ${fb('27.e', 'ZIP Code', '', 'fixed-sm')}
    </div>

    <div class="rule"></div>
    <div class="instruction" style="font-weight:bold;">Employer or School Information</div>

    <div class="field-row">
      ${fb('28.a', 'Employer or School Name', '', 'w5')}
      ${fb('28.b', 'Occupation', '', 'w3')}
    </div>
    <div class="field-row">
      ${fb('28.c', 'Street Number and Name', '', 'w5')}
      ${fb('28.d', 'Apt. / Ste. / Flr.', '', 'fixed-sm')}
    </div>
    <div class="field-row">
      ${fb('28.e', 'City or Town', '', 'w3')}
      ${fb('28.f', 'State', '', 'fixed-sm')}
      ${fb('28.g', 'ZIP Code', '', 'fixed-sm')}
      ${fb('28.h', 'Province', '', 'w2')}
      ${fb('28.i', 'Country', '', 'w2')}
    </div>

    <div class="rule"></div>
    <div class="instruction" style="font-weight:bold;">Last Entry into the United States — Travel Information</div>

    <div class="field-row">
      ${fb('29', 'Last Port-of-Entry City', '', 'w3')}
      ${fb('30', 'Last Port-of-Entry State', '', 'fixed-sm')}
      ${fbDate('31', 'Date Last Entry (MM/DD/YYYY)', entryDate, 'fixed-md')}
    </div>
    <div class="field-row">
      ${fb('32', 'Departure City', '', 'w3')}
      ${fb('33', 'Departure Country', '', 'w3')}
      ${fbDate('34', 'Date of Departure (MM/DD/YYYY)', '', 'fixed-md')}
    </div>

    <div class="rule"></div>

    <!-- PART 3 -->
    <div class="part-header">Part 3. Applicant's Statement, Certification, and Signature</div>
    <div class="instruction"><strong>Read the Statements below before signing.</strong></div>

    <div class="section-note">
      <strong>Note:</strong> Select the appropriate box if a preparer or interpreter assisted in completing this application.
      Complete the relevant Part(s) below.
    </div>

    <div class="cb-group" style="margin-bottom:6px;">
      ${cb(true,  'I can read and understand English, and I have read and understand every question and instruction on this application and my answer to every question.')}
      ${cb(false, 'The interpreter named in Part 4 read to me every question and instruction on this application and my answer to every question in _________________ , a language in which I am fluent, and I understood everything.')}
    </div>

    <div class="cert-box">
      <strong>Applicant's Certification</strong><br/>
      Copies of any documents I have submitted are exact photocopies of unaltered, original documents, and I
      understand that USCIS may require submission of original documents at a later date. I authorize the release of
      any information from any and all of my records that USCIS may need to determine eligibility for the
      immigration benefit I am seeking. I further authorize release of information contained in this application,
      in supporting documents, and in my USCIS records, to other entities and persons where necessary for the
      administration and enforcement of U.S. immigration law.<br/><br/>
      I understand that USCIS will require me to appear for an appointment to take my biometrics (fingerprints,
      photograph, and/or signature) and, at that time, I will be required to sign an oath reaffirming that:<br/>
      (1) I reviewed and understand the contents of this application signed with my full, true signature; and<br/>
      (2) that all information in my application is complete, true, and correct.<br/><br/>
      I certify, under penalty of perjury, that I provided or authorized all of the information in my application,
      I understand all of the information contained in, and submitted with, my application, and that all of this
      information is complete, true, and correct.
    </div>

    <div class="field-row" style="align-items:flex-end;">
      <div class="field-block w5">
        <div class="field-label">Applicant's Signature</div>
        <div class="sig-area" style="min-height:42px;"></div>
      </div>
      <div class="field-block fixed-md">
        ${fbDate('35', 'Date of Signature (MM/DD/YYYY)', today())}
      </div>
    </div>

    <div class="field-row">
      ${fb('36', "Applicant's Daytime Phone Number", '', 'w3')}
      ${fb('37', "Applicant's Mobile Phone Number (if any)", '', 'w3')}
      ${fb('38', "Applicant's Email Address (if any)", '', 'w4')}
    </div>

    <div class="page-footer">
      <span>Form I-765 Edition 04/01/24</span>
      <span>Page 2 of 5</span>
    </div>
  </div>`;

  /* ────────────────────────────────────────────────────────────
     PAGE 3 — Part 4 (Interpreter) + Part 5 (Preparer)
  ──────────────────────────────────────────────────────────── */
  const page3 = `
  <div class="page">
    <div class="omb-bar">
      <span><strong>Form I-765</strong> &nbsp;Application for Employment Authorization</span>
      <span>OMB No. 1615-0040 &nbsp;&bull;&nbsp; Expires 04/30/2026 &nbsp;&bull;&nbsp; Page 3 of 5</span>
    </div>

    <!-- PART 4 -->
    <div class="part-header">Part 4. Interpreter's Contact Information, Certification, and Signature</div>
    <div class="instruction">
      Provide the following information about the interpreter. <strong>NOTE:</strong> The applicant must also complete Part 3.
    </div>

    <div class="cb-group" style="margin-bottom:5px;">
      ${cb(true, 'I did not use an interpreter.')}
      ${cb(false, 'I used an interpreter.')}
    </div>

    <div class="field-row">
      ${fb('1.a', "Interpreter's Family Name (Last Name)", '', 'w3')}
      ${fb('1.b', "Interpreter's Given Name (First Name)", '', 'w3')}
    </div>
    <div class="field-row">
      ${fb('2', "Interpreter's Business or Organization Name (if applicable)", '', 'w5')}
      ${fb('3', 'Interpreter's Daytime Phone Number', '', 'w3')}
    </div>
    <div class="field-row">
      ${fb('4', "Interpreter's Mobile Phone Number (if any)", '', 'w3')}
      ${fb('5', "Interpreter's Email Address (if any)", '', 'w5')}
    </div>
    <div class="field-row">
      ${fb('6.a', 'Street Number and Name', '', 'w5')}
      ${fb('6.b', 'Apt. / Ste. / Flr.', '', 'fixed-sm')}
    </div>
    <div class="field-row">
      ${fb('6.c', 'City or Town', '', 'w3')}
      ${fb('6.d', 'State', '', 'fixed-sm')}
      ${fb('6.e', 'ZIP Code', '', 'fixed-sm')}
      ${fb('6.f', 'Province', '', 'w2')}
      ${fb('6.g', 'Country', '', 'w2')}
    </div>

    <div class="cert-box">
      <strong>Interpreter's Certification</strong><br/>
      I certify, under penalty of perjury, that I am fluent in English and _________________ , and I have read to
      this applicant in the identified language every question and instruction on this application and the
      applicant's answer to every question. The applicant informed me that the applicant understands every
      instruction, question, and answer on the form, including the Applicant's Certification.
    </div>

    <div class="field-row" style="align-items:flex-end;">
      <div class="field-block w5">
        <div class="field-label">Interpreter's Signature</div>
        <div class="sig-area" style="min-height:42px;"></div>
      </div>
      <div class="field-block fixed-md">
        ${fbDate('7', 'Date of Signature (MM/DD/YYYY)', '')}
      </div>
    </div>

    <div class="rule" style="margin:10px 0;"></div>

    <!-- PART 5 -->
    <div class="part-header">Part 5. Contact Information, Declaration, and Signature of the Person Preparing this Application, if Other Than the Applicant</div>
    <div class="instruction">
      Provide the following information about the preparer. <strong>NOTE:</strong> The applicant must also complete Part 3.
    </div>

    <div class="cb-group" style="margin-bottom:5px;">
      ${cb(true,  'I did not use a preparer.')}
      ${cb(false, 'A preparer assisted in completing this application.')}
    </div>

    <div class="field-row">
      ${fb('1.a', "Preparer's Family Name (Last Name)", '', 'w3')}
      ${fb('1.b', "Preparer's Given Name (First Name)", '', 'w3')}
    </div>
    <div class="field-row">
      ${fb('2', "Preparer's Business or Organization Name (if applicable)", '', 'w5')}
      ${fb('3', "Preparer's Daytime Phone Number", '', 'w3')}
    </div>
    <div class="field-row">
      ${fb('4', "Preparer's Mobile Phone Number (if any)", '', 'w3')}
      ${fb('5', "Preparer's Email Address (if any)", '', 'w5')}
    </div>
    <div class="field-row">
      ${fb('6.a', 'Street Number and Name', '', 'w5')}
      ${fb('6.b', 'Apt. / Ste. / Flr.', '', 'fixed-sm')}
    </div>
    <div class="field-row">
      ${fb('6.c', 'City or Town', '', 'w3')}
      ${fb('6.d', 'State', '', 'fixed-sm')}
      ${fb('6.e', 'ZIP Code', '', 'fixed-sm')}
      ${fb('6.f', 'Province', '', 'w2')}
      ${fb('6.g', 'Country', '', 'w2')}
    </div>

    <div class="cert-box">
      <strong>Preparer's Certification</strong><br/>
      I certify, under penalty of perjury, that I prepared this application at the request of the applicant. The
      applicant then reviewed this completed application and informed me that they understand all of the
      information contained in, and submitted with, this completed application. I further certify, under penalty
      of perjury, that all of the information in this application is complete, true, and correct.
    </div>

    <div class="field-row" style="align-items:flex-end;">
      <div class="field-block w5">
        <div class="field-label">Preparer's Signature</div>
        <div class="sig-area" style="min-height:42px;"></div>
      </div>
      <div class="field-block fixed-md">
        ${fbDate('7', 'Date of Signature (MM/DD/YYYY)', '')}
      </div>
    </div>

    <div class="page-footer">
      <span>Form I-765 Edition 04/01/24</span>
      <span>Page 3 of 5</span>
    </div>
  </div>`;

  /* ────────────────────────────────────────────────────────────
     PAGE 4 — Part 6. Additional Information (continuation)
  ──────────────────────────────────────────────────────────── */
  // Build additional info rows from resolved validation data
  const rowData = (c.rows || []).map((r) => {
    const choice = c.resolved?.[r.field];
    const finalVal = choice
      ? (choice === 'document' ? r.extracted : r.questionnaire)
      : r.questionnaire;
    return { field: r.field, value: finalVal, match: r.match || !!choice };
  });

  const additionalRows = rowData.map((r, i) => `
    <div class="field-row">
      ${fb(`${i + 1}`, r.field, r.value, 'w8')}
    </div>`).join('');

  const page4 = `
  <div class="page">
    <div class="omb-bar">
      <span><strong>Form I-765</strong> &nbsp;Application for Employment Authorization</span>
      <span>OMB No. 1615-0040 &nbsp;&bull;&nbsp; Expires 04/30/2026 &nbsp;&bull;&nbsp; Page 4 of 5</span>
    </div>

    <div class="part-header">Part 6. Additional Information</div>
    <div class="instruction">
      If you need extra space to complete any section of this application, use the space below.
      Identify the Part and Item Number to which your answer refers.
    </div>

    <div class="field-row">
      ${fb('', 'Case ID / Reference', `${c.id} — ${c.applicant}`, 'w8')}
    </div>
    <div class="field-row">
      ${fb('', 'Application Type', `${c.type} · dependent of ${c.primary}`, 'w8')}
    </div>
    <div class="field-row">
      ${fb('', 'Intake Date', c.intake || '', 'w4')}
      ${fb('', 'Form Generated', today(), 'w4')}
    </div>

    <div class="rule"></div>
    <div style="font-size:7.5pt; font-weight:bold; margin-bottom:4px;">Verified Field Values (from AI cross-validation)</div>

    ${additionalRows || `<div class="instruction" style="color:#888;">No validated fields — run AI validation before saving.</div>`}

    <div class="rule" style="margin-top:12px;"></div>

    <!-- Extra continuation lines -->
    ${Array.from({ length: 8 }).map(() => `
    <div class="field-row">
      <div class="field-block w2">
        <div class="field-label">Part &nbsp;&nbsp;&nbsp; Item Number</div>
        <div class="field-box">&nbsp;</div>
      </div>
      <div class="field-block w8">
        <div class="field-label">Additional Information</div>
        <div class="field-box">&nbsp;</div>
      </div>
    </div>`).join('')}

    <div class="page-footer">
      <span>Form I-765 Edition 04/01/24</span>
      <span>Page 4 of 5</span>
    </div>
  </div>`;

  /* ────────────────────────────────────────────────────────────
     PAGE 5 — For Official Use Only + Instructions excerpt
  ──────────────────────────────────────────────────────────── */
  const page5 = `
  <div class="page">
    <div class="omb-bar">
      <span><strong>Form I-765</strong> &nbsp;Application for Employment Authorization</span>
      <span>OMB No. 1615-0040 &nbsp;&bull;&nbsp; Expires 04/30/2026 &nbsp;&bull;&nbsp; Page 5 of 5</span>
    </div>

    <div class="official-box">
      <div class="title">For USCIS Official Use Only — Do Not Write Below This Line</div>
      <div class="field-row">
        ${fb('', 'Classification', '', 'w3')}
        ${fb('', 'Action Block', '', 'w5')}
      </div>
      <div class="field-row">
        ${fb('', 'Remarks', '', 'w8')}
      </div>
      <div class="field-row">
        ${fbDate('', 'Date (MM/DD/YYYY)', '', 'fixed-md')}
        ${fb('', 'Location Code', '', 'fixed-sm')}
        ${fb('', 'Reviewer ID', '', 'fixed-sm')}
        ${fb('', 'Officer Initials', '', 'fixed-sm')}
      </div>
      <div style="min-height:80px; border:1px solid #000; margin-top:6px; padding:4px; font-size:7.5pt; color:#555;">
        Action / Notes:
      </div>
    </div>

    <div class="rule"></div>
    <div style="font-size:7.5pt; font-weight:bold; margin-bottom:4px; color:#003366;">Document Checklist — Required Supporting Documents for (c)(26) H-4 EAD</div>
    <table class="form-table">
      <tr><th style="width:40%;">Required Document</th><th style="width:45%;">Notes</th><th style="width:15%;">Enclosed</th></tr>
      <tr><td>Valid Passport (bio-data page)</td><td>Must be valid for duration of requested EAD</td><td style="text-align:center;">&#10003;</td></tr>
      <tr><td>Form I-94 (Arrival/Departure Record)</td><td>Most recent — H-4 class of admission</td><td style="text-align:center;">&#10003;</td></tr>
      <tr><td>I-797 Approval Notice for H-4 status</td><td>Copy of most recent approval</td><td></td></tr>
      <tr><td>Proof that principal beneficiary holds H-1B status</td><td>Copy of H-1B approval notice</td><td></td></tr>
      <tr><td>Proof that principal beneficiary is AC21-eligible</td><td>I-140 approval or priority date evidence</td><td></td></tr>
      <tr><td>Two passport-style photographs</td><td>White background, 2 × 2 inches</td><td></td></tr>
      <tr><td>Filing fee (Form G-1055 or fee waiver)</td><td>Check current USCIS fee schedule</td><td></td></tr>
    </table>

    <div class="rule"></div>
    <div style="font-size:7.5pt; font-weight:bold; margin-bottom:4px; color:#003366;">Filing Instructions</div>
    <div style="font-size:7.5pt; line-height:1.6; color:#333;">
      Mail the completed application to the appropriate USCIS Lockbox facility listed in the
      Form I-765 instructions available at <strong>uscis.gov/i-765</strong>. If you are filing online,
      submit through your USCIS online account. Keep a copy of all documents for your records.
      Processing times are available on the USCIS website at <strong>uscis.gov/processing-times</strong>.
    </div>

    <div class="rule" style="margin-top: 20px;"></div>
    <div style="font-size:7pt; color:#555; line-height:1.5;">
      An agency may not conduct or sponsor an information collection, and a person is not required to respond to,
      a collection of information unless it displays a currently valid OMB control number. Public reporting burden
      for this collection of information is estimated at 5.67 hours per response, including the time for reviewing
      instructions, gathering the required documentation and information, completing the application, preparing
      statements, attaching necessary documentation, and submitting the application. Send comments regarding this
      burden estimate or any other aspect of this collection of information, including suggestions for reducing
      this burden, to: U.S. Citizenship and Immigration Services, Office of Policy and Strategy, Regulatory
      Coordination Division, 5900 Capital Gateway Drive, Camp Springs, MD 20746-4076. OMB No. 1615-0040.
      Do not mail your completed Form I-765 to this address.
    </div>

    <div class="page-footer">
      <span>Form I-765 Edition 04/01/24 &nbsp;|&nbsp; OMB No. 1615-0040 &nbsp;|&nbsp; Expires 04/30/2026</span>
      <span>Page 5 of 5</span>
    </div>
  </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Form I-765 — Application for Employment Authorization — ${c.id}</title>
  <style>${css}</style>
</head>
<body>
  ${page1}
  ${page2}
  ${page3}
  ${page4}
  ${page5}
</body>
</html>`;
}

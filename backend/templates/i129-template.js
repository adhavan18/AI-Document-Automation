// Builds a Form I-129 (Petition for Nonimmigrant Worker) PDF-ready HTML document.
// Adapted for LCA-extracted matter data: employer/position/worksite/lca[]/computed[].
// Classification: H-1B Specialty Occupation.
// Beneficiary fields are left blank — to be completed before filing.

function lca(arr, label) {
  return arr?.find((f) => f.label === label)?.value ?? '—';
}

function deriveValidityEnd(matter) {
  const retainUntil = lca(matter.computed, 'Retain Until');
  if (!retainUntil || retainUntil === '—' || retainUntil === 'Not found') return '—';
  try {
    const d = new Date(retainUntil);
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  } catch { return '—'; }
}

export function buildI129HTML(matter) {
  const today = new Date();
  const mm    = String(today.getMonth() + 1).padStart(2, '0');
  const dd    = String(today.getDate()).padStart(2, '0');
  const yyyy  = today.getFullYear();
  const todayStr = `${mm}/${dd}/${yyyy}`;

  const company   = matter.employer ?? '—';
  const position  = matter.position ?? '—';
  const worksite  = matter.worksite ?? '—';
  const startDate = matter.lcaCertified ?? '—';
  const endDate   = deriveValidityEnd(matter);

  const socCode   = lca(matter.lca, 'Occupation Code (SOC)');
  const wageRange = lca(matter.lca, 'Wage Range');
  const prevWage  = lca(matter.lca, 'Prevailing Wage');
  const postStart = lca(matter.lca, 'Posting Start');
  const postEnd   = lca(matter.lca, 'Posting End');
  const retainUntil = lca(matter.computed, 'Retain Until');

  const worksiteParts = worksite.split(',');
  const workCity  = worksiteParts[0]?.trim() || '';
  const workState = worksiteParts[1]?.trim().substring(0, 2) || '';

  // Strip "/ yr" from prevailing wage to get a plain dollar figure for the wage field
  const offeredWage = prevWage.replace(/\s*\/\s*yr.*$/i, '').replace('$', '').trim();

  const emailSafe = company.toLowerCase().replace(/[^a-z]/g, '');

  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #000; background: #fff; }
    .page { width: 750px; margin: 0 auto; padding: 20px 24px; page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
    table { border-collapse: collapse; width: 100%; }
    td, th { vertical-align: top; }
    .form-title { text-align: center; font-size: 16px; font-weight: bold; margin: 4px 0 2px 0; }
    .form-sub { text-align: center; font-size: 10px; font-weight: bold; }
    .form-sub2 { text-align: center; font-size: 9px; }
    .omb-box { border: 1px solid #000; padding: 3px 6px; font-size: 9px; text-align: right; }
    .omb-title { font-size: 13px; font-weight: bold; }
    .header-rule { border: none; border-top: 3px solid #000; margin: 4px 0 2px 0; }
    .header-rule2 { border: none; border-top: 1px solid #000; margin: 2px 0; }
    .start-here { font-size: 10px; font-weight: bold; margin: 6px 0 4px 0; }
    .part-header { background: #D0D0D0; border: 1px solid #000; padding: 3px 6px; font-size: 10px; font-weight: bold; margin-top: 8px; margin-bottom: 0; }
    .field-row { display: flex; width: 100%; }
    .field-box { border: 1px solid #000; padding: 2px 4px; min-height: 30px; flex: 1; }
    .field-box + .field-box { border-left: none; }
    .field-label { font-size: 7.5px; color: #000; margin-bottom: 1px; }
    .field-value { font-size: 10px; font-weight: bold; padding-top: 1px; }
    .item-row { margin-top: 8px; }
    .indent { margin-left: 20px; }
    .cb-row { margin: 4px 0; }
    .cb { font-size: 12px; }
    .sig-line { border-bottom: 1px solid #000; min-height: 22px; margin: 2px 0; }
    .arrow { font-size: 12px; }
    .uscis-block { border: 1px solid #000; }
    .uscis-block td { border: 1px solid #000; padding: 3px 5px; font-size: 9px; }
    .section-header { background: #D0D0D0; border: 1px solid #000; border-bottom: none; padding: 3px 6px; font-size: 10px; font-weight: bold; }
    .bordered-row { border: 1px solid #000; padding: 4px 6px; border-top: none; }
    .page-footer { margin-top: 16px; border-top: 1px solid #000; padding-top: 4px; font-size: 8px; }
    .supplement-header { text-align: center; font-size: 14px; font-weight: bold; margin: 6px 0 2px 0; }
  `;

  function fieldBox(label, value, flex = 1, minH = '30px') {
    return `<div class="field-box" style="flex:${flex};min-height:${minH};">
      <div class="field-label">${label}</div>
      <div class="field-value">${value || ''}</div>
    </div>`;
  }

  function row(...boxes) {
    return `<div class="field-row">${boxes.join('')}</div>`;
  }

  function checked(yes) { return yes ? '&#9745;' : '&#9744;'; }

  function yesNo(isYes) {
    return `<span class="cb">${checked(isYes)}</span> Yes &nbsp;&nbsp; <span class="cb">${checked(!isYes)}</span> No`;
  }

  function partHeader(text) {
    return `<div class="part-header">${text}</div>`;
  }

  function sectionHeader(text) {
    return `<div class="section-header">${text}</div>`;
  }

  function footer(page) {
    return `<div class="page-footer">
      <table><tr>
        <td style="text-align:left;">Form I-129 Edition 02/27/26</td>
        <td style="text-align:right;">Page ${page} of 8</td>
      </tr></table>
    </div>`;
  }

  function aptSteFrNum() {
    return `
      <div class="field-row">
        <div class="field-box" style="flex:0.4;"><div class="field-label">Apt.</div><div class="field-value"></div></div>
        <div class="field-box" style="flex:0.4;border-left:none;"><div class="field-label">Ste.</div><div class="field-value"></div></div>
        <div class="field-box" style="flex:0.4;border-left:none;"><div class="field-label">Flr.</div><div class="field-value"></div></div>
        <div class="field-box" style="flex:1;border-left:none;"><div class="field-label">Number</div><div class="field-value"></div></div>
      </div>`;
  }

  const sealBlock = `<div style="width:52px;height:52px;border:1px solid #aaa;display:flex;align-items:center;justify-content:center;font-size:7px;text-align:center;color:#666;">DEPT OF<br/>HOMELAND<br/>SECURITY</div>`;

  const ombBlock = `<div class="omb-box">
    <div class="omb-title">USCIS</div>
    <div style="font-weight:bold;">Form I-129</div>
    <div>OMB No. 1615-0009</div>
    <div>Expires 12/31/2027</div>
  </div>`;

  // ── PAGE 1 ──────────────────────────────────────────────────────────
  const page1 = `
  <div class="page">
    <table>
      <tr>
        <td style="width:60px;vertical-align:middle;">${sealBlock}</td>
        <td style="text-align:center;vertical-align:middle;">
          <div class="form-title">Petition for a Nonimmigrant Worker</div>
          <div class="form-sub">Department of Homeland Security</div>
          <div class="form-sub2">U.S. Citizenship and Immigration Services</div>
        </td>
        <td style="width:140px;vertical-align:top;">${ombBlock}</td>
      </tr>
    </table>

    <hr class="header-rule"/>
    <hr class="header-rule2"/>

    <table class="uscis-block" style="margin-bottom:8px;">
      <tr>
        <td style="width:55px;vertical-align:middle;font-weight:bold;font-size:9px;" rowspan="3">For<br/>USCIS<br/>Use<br/>Only</td>
        <td style="font-weight:bold;">Receipt</td>
        <td style="font-weight:bold;">Partial Approval (explain)</td>
        <td style="font-weight:bold;">Action Block</td>
      </tr>
      <tr>
        <td style="height:40px;"></td>
        <td></td>
        <td></td>
      </tr>
      <tr>
        <td style="font-size:8px;">
          Class: H-1B<br/>
          No. of Workers: 1<br/>
          Job Code: ${socCode}<br/>
          Validity Dates: ________________<br/>
          From: ________________<br/>
          To: ________________
        </td>
        <td style="font-size:8px;vertical-align:top;padding-top:4px;">
          <span class="cb">&#9744;</span> <strong>Classification Approved</strong><br/>
          <span class="cb">&#9744;</span> Consulate/POE/PFI Notified<br/>
          At: ________________<br/>
          <span class="cb">&#9744;</span> Extension Granted<br/>
          <span class="cb">&#9744;</span> COS/Extension Granted
        </td>
        <td></td>
      </tr>
    </table>

    <div class="start-here">&#9658; START HERE - Type or print in black ink.</div>

    ${partHeader('Part 1. Petitioner Information')}

    <p style="font-size:9px;margin:4px 0;">If you are an individual filing this petition, complete <strong>Item Number 1.</strong> If you are a company or an organization filing this petition, complete <strong>Item Number 2.</strong></p>

    <div class="item-row">
      <strong>1. Legal Name of Individual Petitioner</strong>
      ${row(fieldBox('Family Name (Last Name)', ''), fieldBox('Given Name (First Name)', ''), fieldBox('Middle Name', ''))}
    </div>

    <div class="item-row">
      <strong>2. Company or Organization Name</strong>
      ${row(fieldBox('', company))}
    </div>

    <div class="item-row">
      <strong>3. Mailing Address of Individual, Company or Organization</strong>
      ${row(fieldBox('In Care Of Name', ''))}
      ${row(fieldBox('Street Number and Name', '', 3))}
      ${aptSteFrNum()}
      ${row(fieldBox('City or Town', workCity, 2), fieldBox('State', workState, 0.5), fieldBox('ZIP Code', '', 0.8))}
      ${row(fieldBox('Province', '', 1), fieldBox('Postal Code', '', 1), fieldBox('Country', 'United States', 1))}
    </div>

    <div class="item-row">
      <strong>4. Contact Information</strong>
      ${row(fieldBox('Daytime Telephone Number', '', 1), fieldBox('Mobile Telephone Number', '', 1), fieldBox('Email Address (if any)', `hr@${emailSafe}.com`, 1.5))}
    </div>

    <div class="item-row"><strong>Other Information</strong></div>
    <div class="item-row">
      <strong>5.</strong> Federal Employer Identification Number (FEIN)
      <br/>&#9658; ${row(fieldBox('', '', 1, '24px'))}
    </div>

    <div class="item-row" style="display:flex;align-items:center;gap:20px;">
      <span><strong>6.</strong> Are you a nonprofit organized as tax exempt or a governmental research organization?</span>
      <span>${yesNo(false)}</span>
    </div>

    <div class="item-row" style="margin-top:6px;">
      ${row(
        fieldBox('7. U.S. Social Security Number (if any)', 'N/A', 1),
        fieldBox('8. Individual IRS Tax Number', 'N/A', 1)
      )}
    </div>

    ${footer(1)}
  </div>`;

  // ── PAGE 2 ──────────────────────────────────────────────────────────
  const page2 = `
  <div class="page">
    ${partHeader('Part 2. Information About This Petition')}

    <div class="item-row">
      <strong>1.</strong> Requested Nonimmigrant Classification (Write classification symbol):
      ${row(fieldBox('', 'H-1B', 0.3))}
    </div>

    <div class="item-row">
      <strong>2.</strong> Basis for Classification (select only one box):
      <div class="indent">
        <div class="cb-row"><span class="cb">${checked(true)}</span> a. New employment.</div>
        <div class="cb-row"><span class="cb">${checked(false)}</span> b. New concurrent employment.</div>
        <div class="cb-row"><span class="cb">${checked(false)}</span> c. Change of employer.</div>
        <div class="cb-row"><span class="cb">${checked(false)}</span> d. Amended petition.</div>
        <div class="cb-row"><span class="cb">${checked(false)}</span> e. Change in previously approved employment.</div>
        <div class="cb-row"><span class="cb">${checked(false)}</span> f. Continuation of previously approved employment without change with the same employer.</div>
      </div>
    </div>

    <div class="item-row">
      <strong>3.</strong> Provide the most recent petition/application receipt number for the beneficiary. If none exists, indicate "None."
      ${row(fieldBox('', 'None', 1, '24px'))}
    </div>

    <div class="item-row">
      <strong>4.</strong> Requested Action (select only one box):
      <div class="indent">
        <div class="cb-row"><span class="cb">${checked(true)}</span> a. Notify the office in Part 4. so each beneficiary can obtain a visa or be admitted.</div>
        <div class="cb-row"><span class="cb">${checked(false)}</span> b. Change the status and extend the stay of each beneficiary because the beneficiary(ies) is/are now in the United States in another status.</div>
        <div class="cb-row"><span class="cb">${checked(false)}</span> c. Extend the stay of each beneficiary because the beneficiary(ies) now hold(s) this status.</div>
        <div class="cb-row"><span class="cb">${checked(false)}</span> d. Amend the stay of each beneficiary because the beneficiary(ies) now hold(s) this status and is/are not seeking additional time from the current authorized period of stay.</div>
        <div class="cb-row"><span class="cb">${checked(false)}</span> e. Extend the status of a nonimmigrant classification based on a free trade agreement.</div>
        <div class="cb-row"><span class="cb">${checked(false)}</span> f. Change status to a nonimmigrant classification based on a free trade agreement.</div>
      </div>
    </div>

    <div class="item-row">
      <strong>5.</strong> Total number of workers included in this petition.
      ${row(fieldBox('', '1', 0.2, '24px'))}
    </div>

    ${partHeader('Part 3. Beneficiary Information')}

    <p style="font-size:9px;margin:4px 0;">Complete the blocks below. Use the Attachment-1 sheet to name each beneficiary included in this petition.</p>

    <div class="item-row" style="display:flex;gap:20px;align-items:center;">
      <strong>1.</strong> Type of Beneficiaries Requested (select only one box)
      &nbsp;<span class="cb">${checked(true)}</span> Named &nbsp;&nbsp;
      <span class="cb">${checked(false)}</span> Unnamed (for H-2A or H-2B petitions only)
    </div>

    <div class="item-row">
      <strong>2.</strong> If an Entertainment Group, Provide the Group Name
      ${row(fieldBox('', 'N/A'))}
    </div>

    <div class="item-row">
      <strong>3.</strong> Provide Name of Beneficiary<br/>
      &#9658;
      ${row(fieldBox('Family Name (Last Name)', ''), fieldBox('Given Name (First Name)', ''), fieldBox('Middle Name', ''))}
    </div>

    <div class="item-row">
      <strong>4.</strong> Provide all other names the beneficiary has used. Include nicknames, aliases, maiden name, and names from all previous marriages.
      ${row(fieldBox('', ''))}
    </div>

    <div class="item-row">
      <strong>5.</strong> Other Information
      ${row(
        fieldBox('Date of birth (mm/dd/yyyy)', '', 1),
        fieldBox('Sex', '', 0.5),
        fieldBox('U.S. Social Security Number (if any)', 'N/A', 1),
        fieldBox('Alien Registration Number (A-Number)', 'N/A', 1),
        fieldBox('Province of Birth', '', 1)
      )}
    </div>

    <div class="item-row">
      <strong>6.</strong> If the beneficiary is in the United States, complete the following:
      ${row(
        fieldBox('Country of Birth', '', 1),
        fieldBox('I-94 Arrival-Departure Record Number', '', 1),
        fieldBox('Date of Last Arrival (mm/dd/yyyy)', '', 1)
      )}
      ${row(
        fieldBox('Passport or Travel Document Number', '', 1),
        fieldBox('Passport or Travel Document Country of Issuance', '', 1),
        fieldBox('Date Passport or Travel Document Issued (mm/dd/yyyy)', '', 1),
        fieldBox('Date Passport or Travel Document Expires (mm/dd/yyyy)', '', 1)
      )}
      ${row(
        fieldBox('Current Nonimmigrant Status', '', 1),
        fieldBox('Date Status Expires (mm/dd/yyyy) or D/S', '', 1),
        fieldBox('Country of Citizenship or Nationality', '', 1)
      )}
      ${row(
        fieldBox('Employment Authorization Document (EAD) Number (if any)', 'N/A', 1),
        fieldBox('Student and Exchange Visitor Information System (SEVIS) Number (if any)', 'N/A', 1)
      )}
    </div>

    <div class="item-row">
      <strong>7.</strong> Current Residential U.S. Address (if applicable) (do not list a P.O. Box)
      ${row(fieldBox('Street Number and Name', '', 2))}
      ${aptSteFrNum()}
      ${row(fieldBox('City or Town', '', 1.5), fieldBox('State', '', 0.4), fieldBox('ZIP Code', '', 0.6))}
    </div>

    ${footer(2)}
  </div>`;

  // ── PAGE 3 ──────────────────────────────────────────────────────────
  const page3 = `
  <div class="page">
    ${partHeader('Part 4. Processing Information')}

    <div class="item-row">
      <strong>1.</strong> If a beneficiary or beneficiaries named in Part 3. is/are outside the United States, or a requested extension of stay or change of status cannot be granted, state the U.S. Consulate or inspection facility you want notified if this petition is approved.
    </div>
    <div class="item-row indent">
      <strong>a.</strong> Type of Office: &nbsp;
      <span class="cb">&#9744;</span> Consulate &nbsp;&nbsp;
      <span class="cb">&#9744;</span> Pre-flight inspection &nbsp;&nbsp;
      <span class="cb">&#9744;</span> Port of Entry
    </div>
    ${row(fieldBox('b. Office Address (City)', '', 1.5), fieldBox('c. U.S. State or Foreign Country', '', 1))}

    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>2.</strong> Does each person in this petition have a valid passport?</span>
      <span>${yesNo(true)}</span>
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>3.</strong> Are you filing any other petitions with this one?</span>
      <span>${yesNo(false)} &nbsp; If yes, how many? &#9658;</span>
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>4.</strong> Are you filing any applications for replacement/initial I-94, Arrival-Departure Records with this petition?</span>
      <span>${yesNo(false)}</span>
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>5.</strong> Are you filing any applications for dependents with this petition?</span>
      <span>${yesNo(false)} &nbsp; If yes, how many? &#9658;</span>
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>6.</strong> Is any beneficiary in this petition in removal proceedings?</span>
      <span>${yesNo(false)}</span>
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>7.</strong> Have you ever filed an immigrant petition for any beneficiary in this petition?</span>
      <span>${yesNo(false)}</span>
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>8.</strong> Did you indicate you were filing a new petition in Part 2.?</span>
      <span>${yesNo(true)}</span>
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>9.</strong> Have you ever previously filed a nonimmigrant petition for this beneficiary?</span>
      <span>${yesNo(false)}</span>
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span>&nbsp;&nbsp;&nbsp;&nbsp;<strong>a.</strong> Has any beneficiary in this petition ever been given the classification you are now requesting within the last seven years?</span>
      <span>${yesNo(false)}</span>
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span>&nbsp;&nbsp;&nbsp;&nbsp;<strong>b.</strong> Has any beneficiary in this petition ever been denied the classification you are now requesting within the last seven years?</span>
      <span>${yesNo(false)}</span>
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>10.</strong> If you are filing for an entertainment group, has any beneficiary in this petition not been with the group for at least one year?</span>
      <span>${yesNo(false)}</span>
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>11.a.</strong> Has any beneficiary in this petition ever been a J-1 exchange visitor or J-2 dependent of a J-1 exchange visitor?</span>
      <span>${yesNo(false)}</span>
    </div>

    <div class="item-row">
      <strong>d. Beneficiary's Foreign Address</strong>
      ${row(fieldBox('Street Number and Name', '', 2))}
      ${aptSteFrNum()}
      ${row(fieldBox('City or Town', '', 1.5), fieldBox('State', '', 0.5), fieldBox('Province', '', 1), fieldBox('Postal Code', '', 0.8), fieldBox('Country', '', 1))}
    </div>

    ${footer(3)}
  </div>`;

  // ── PAGE 4 ──────────────────────────────────────────────────────────
  const page4 = `
  <div class="page">
    ${partHeader('Part 5. Basic Information About the Proposed Employment and Employer')}

    <div class="item-row"><strong>Attach the Form I-129 supplement relevant to the classification of the worker(s) you are requesting.</strong></div>

    <div class="item-row">
      <strong>1.</strong> Job Title
      ${row(fieldBox('', position))}
    </div>

    <div class="item-row">
      <strong>2.</strong> Labor Condition Application (LCA) or Employment and Training Administration (ETA) Case Number
      ${row(fieldBox('', ''))}
    </div>

    <div class="item-row">
      <strong>3.</strong> Address(es) where the beneficiary(ies) will work if different from address in Part 1.
      <div style="margin-left:12px;margin-top:4px;">
        <div style="font-size:9px;font-weight:bold;">Address 1</div>
        ${row(fieldBox('Street Number and Name', '', 2))}
        ${aptSteFrNum()}
        ${row(fieldBox('City or Town', workCity, 1.5), fieldBox('State', workState, 0.4), fieldBox('ZIP Code', '', 0.6))}
        <div style="display:flex;gap:20px;margin-top:4px;">
          <span>Is this a third-party location? ${yesNo(false)}</span>
        </div>
      </div>
    </div>

    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>4.</strong> Did you include an itinerary with the petition?</span>
      <span>${yesNo(false)}</span>
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>5.</strong> Will the beneficiary(ies) work for you off-site at another company or organization's location?</span>
      <span>${yesNo(false)}</span>
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>6.</strong> Will the beneficiary(ies) work exclusively in the Commonwealth of the Northern Mariana Islands (CNMI)?</span>
      <span>${yesNo(false)}</span>
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>7.</strong> Is this a full-time position?</span>
      <span>${yesNo(true)}</span>
    </div>
    <div class="item-row">
      <strong>8.</strong> If the answer to Item Number 7. is no, how many hours per week for the position? &#9658; 40
    </div>
    <div class="item-row">
      <strong>9.</strong> Wages: $&nbsp;
      ${row(fieldBox('', offeredWage, 0.6), fieldBox('per (Specify hour, week, month, or year)', 'Year', 1))}
    </div>
    <div class="item-row">
      <strong>10.</strong> Other Compensation (Explain)
      ${row(fieldBox('', 'None', 1, '24px'))}
    </div>
    <div class="item-row">
      <strong>11.</strong> Dates of intended employment &nbsp;&nbsp;
      From: <strong>${startDate}</strong> &nbsp;&nbsp;&nbsp; To: <strong>${endDate}</strong>
    </div>

    <div style="margin-top:12px;">
      ${row(
        fieldBox('12. Type of Business', '', 2),
        fieldBox('13. Year Established', '', 0.7),
        fieldBox('14. Current Number of Employees in the United States', '', 1)
      )}
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>15.</strong> Do you currently employ a total of 25 or fewer full-time equivalent employees in the United States, including all affiliates or subsidiaries of this company/organization?</span>
      <span>${yesNo(false)}</span>
    </div>
    ${row(
      fieldBox('16. Gross Annual Income', '', 1),
      fieldBox('17. Net Annual Income', '', 1)
    )}

    ${footer(4)}
  </div>`;

  // ── PAGE 5 ──────────────────────────────────────────────────────────
  const page5 = `
  <div class="page">
    ${partHeader('Part 6. Certification Regarding the Release of Controlled Technology or Technical Data to Foreign Persons in the United States')}

    <p style="font-size:9px;margin:4px 0;font-style:italic;">(This section of the form is required only for H-1B, H-1B1 Chile/Singapore, L-1, and O-1A petitions.)</p>
    <p style="font-size:9px;margin:4px 0;">Select Item Number 1. or Item Number 2. as appropriate. DO NOT select both boxes.</p>
    <p style="font-size:9px;margin:4px 0;">With respect to the technology or technical data the petitioner will release or otherwise provide access to the beneficiary, the petitioner certifies that it has reviewed the Export Administration Regulations (EAR) and the International Traffic in Arms Regulations (ITAR) and has determined that:</p>

    <div class="indent">
      <div class="cb-row">
        <span class="cb">${checked(true)}</span> <strong>1.</strong> A license is not required from either the U.S. Department of Commerce or the U.S. Department of State to release such technology or technical data to the foreign person; or
      </div>
      <div class="cb-row" style="margin-top:6px;">
        <span class="cb">${checked(false)}</span> <strong>2.</strong> A license is required from the U.S. Department of Commerce and/or the U.S. Department of State to release such technology or technical data to the beneficiary and the petitioner will prevent access to the controlled technology or technical data by the beneficiary until and unless the petitioner has received the required license or other authorization to release it to the beneficiary.
      </div>
    </div>

    ${partHeader('Part 7. Declaration, Signature, and Contact Information of Petitioner or Authorized Signatory')}

    <p style="font-size:8.5px;margin:4px 0;">Copies of any documents submitted are exact photocopies of unaltered, original documents, and I understand that, as the petitioner, I may be required to submit original documents to U.S. Citizenship and Immigration Services (USCIS) at a later date.</p>
    <p style="font-size:8.5px;margin:4px 0;">I authorize the release of any information from my records, or from the petitioning organization's records that USCIS needs to determine eligibility for the immigration benefit sought. I recognize the authority of USCIS to conduct audits of this petition using publicly available open source information.</p>
    <p style="font-size:8.5px;margin:4px 0;">I certify, under penalty of perjury, that I have reviewed this petition and that all of the information contained in the petition, including all responses to specific questions, and in the supporting documents, is complete, true, and correct.</p>

    <div class="item-row">
      <strong>1.</strong> Name and Title of Authorized Signatory
      ${row(
        fieldBox('Family Name (Last Name)', '', 1),
        fieldBox('Given Name (First Name)', '', 1),
        fieldBox('Title', 'Authorized Signatory', 1)
      )}
    </div>

    <div class="item-row">
      <strong>2.</strong> Signature and Date<br/>
      <div style="margin-top:4px;font-size:9px;">Signature of Authorized Signatory &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date of Signature (mm/dd/yyyy)</div>
      <div style="display:flex;gap:20px;margin-top:2px;">
        <div style="flex:3;"><span class="arrow">&#9658;</span> <div class="sig-line"></div></div>
        <div style="flex:1;"><div class="sig-line"></div></div>
      </div>
    </div>

    <div class="item-row">
      <strong>3.</strong> Signatory's Contact Information
      ${row(
        fieldBox('Daytime Telephone Number', '', 1),
        fieldBox('Email Address (if any)', `hr@${emailSafe}.com`, 1.5)
      )}
    </div>

    ${partHeader('Part 8. Declaration, Signature, and Contact Information of Person Preparing Form, If Other Than Petitioner')}

    <p style="font-size:9px;margin:4px 0;">Provide the following information concerning the preparer:</p>

    <div class="item-row">
      <strong>1.</strong> Name of Preparer
      ${row(fieldBox('Family Name (Last Name)', '', 1), fieldBox('Given Name (First Name)', '', 1))}
    </div>
    <div class="item-row">
      <strong>2.</strong> Preparer's Business or Organization Name (if any)
      ${row(fieldBox('', ''))}
    </div>
    <div class="item-row">
      <strong>3.</strong> Preparer's Mailing Address
      ${row(fieldBox('Street Number and Name', '', 2))}
      ${aptSteFrNum()}
      ${row(fieldBox('City or Town', '', 1.5), fieldBox('State', '', 0.4), fieldBox('ZIP Code', '', 0.6))}
    </div>
    <div class="item-row">
      <strong>4.</strong> Preparer's Contact Information
      ${row(fieldBox('Daytime Telephone Number', '', 1), fieldBox('Fax Number', '', 1), fieldBox('Email Address (if any)', '', 1.5))}
    </div>

    <div style="background:#E8E8E8;padding:3px 6px;font-size:10px;font-weight:bold;font-style:italic;margin-top:8px;">Preparer's Declaration</div>
    <p style="font-size:8.5px;margin:4px 0;">By my signature, I certify, swear, or affirm, under penalty of perjury, that I prepared this petition on behalf of, at the request of, and with the express consent of the petitioner or authorized signatory. The petitioner has reviewed this completed petition as prepared by me and informed me that all of the information in the form and in the supporting documents, is complete, true, and correct.</p>

    <div class="item-row">
      <strong>5.</strong> Signature and Date
      <div style="display:flex;gap:20px;margin-top:2px;">
        <div style="flex:3;"><div class="sig-line"></div></div>
        <div style="flex:1;"><div class="sig-line"></div></div>
      </div>
    </div>

    ${footer(5)}
  </div>`;

  // ── PAGE 6 ──────────────────────────────────────────────────────────
  const page6 = `
  <div class="page">
    ${partHeader('Part 9. Additional Information About Your Petition For Nonimmigrant Worker')}

    <p style="font-size:9px;margin:4px 0;">If you require more space to provide any additional information within this petition, use the space below.</p>

    <div class="item-row">
      <strong>1.</strong>
      ${row(fieldBox('Page Number', '5', 0.5), fieldBox('Part Number', '5', 0.5), fieldBox('Item Number', '11', 0.5))}
      ${row(fieldBox('Additional Information', `Employer: ${company}. Position: ${position}. Worksite: ${worksite}. LCA Certified: ${startDate}. Validity period: ${startDate} to ${endDate}. Prevailing Wage: ${prevWage}. Offered Wage Range: ${wageRange}. SOC Code: ${socCode}. Public Access File posting period: ${postStart} — ${postEnd}. Document retention: until ${retainUntil}.`, 1, '60px'))}
    </div>
    <div class="item-row">
      <strong>2.</strong>
      ${row(fieldBox('Page Number', '', 0.5), fieldBox('Part Number', '', 0.5), fieldBox('Item Number', '', 0.5))}
      ${row(fieldBox('', '', 1, '40px'))}
    </div>
    <div class="item-row">
      <strong>3.</strong>
      ${row(fieldBox('Page Number', '', 0.5), fieldBox('Part Number', '', 0.5), fieldBox('Item Number', '', 0.5))}
      ${row(fieldBox('', '', 1, '40px'))}
    </div>

    ${footer(6)}
  </div>`;

  // ── H-1B SUPPLEMENT — PAGE 7 ─────────────────────────────────────────
  const suppPage1 = `
  <div class="page">
    <table><tr>
      <td style="width:60px;vertical-align:middle;">${sealBlock}</td>
      <td style="text-align:center;">
        <div class="supplement-header">H Classification Supplement to Form I-129</div>
        <div class="form-sub">Department of Homeland Security</div>
        <div class="form-sub2">U.S. Citizenship and Immigration Services</div>
      </td>
      <td style="width:140px;">${ombBlock}</td>
    </tr></table>
    <hr class="header-rule"/><hr class="header-rule2"/>

    <div class="item-row"><strong>1.</strong> Name of the Petitioner ${row(fieldBox('', company))}</div>
    <div class="item-row"><strong>2.a.</strong> Name of the Beneficiary ${row(fieldBox('', ''))}</div>
    <div class="item-row"><strong>2.b.</strong> Provide the total number of beneficiaries ${row(fieldBox('', '1', 0.2))}</div>

    <div class="item-row">
      <strong>3.</strong> Prior periods of stay in H or L classification (last six years):
      <table style="margin-top:4px;border:1px solid #000;">
        <tr style="background:#E8E8E8;">
          <th style="padding:4px 8px;border:1px solid #000;width:60%;">Subject's Name</th>
          <th style="padding:4px 8px;border:1px solid #000;" colspan="2">Period of Stay (mm/dd/yyyy)</th>
        </tr>
        <tr><th style="border:1px solid #000;"></th><th style="border:1px solid #000;padding:2px 8px;">From</th><th style="border:1px solid #000;padding:2px 8px;">To</th></tr>
        ${[1,2,3,4,5,6].map(() => `<tr><td style="border:1px solid #000;height:20px;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>`).join('')}
      </table>
    </div>

    <div class="item-row">
      <strong>4.</strong> Classification sought (select only one box):
      <div class="indent">
        <div class="cb-row"><span class="cb">&#9745;</span> <strong>a.</strong> H-1B Specialty Occupation</div>
        <div class="cb-row"><span class="cb">&#9744;</span> <strong>b.</strong> H-1B1 Chile and Singapore</div>
        <div class="cb-row"><span class="cb">&#9744;</span> <strong>c.</strong> H-1B2 Exceptional services relating to a cooperative research and development project administered by the U.S. Department of Defense (DOD)</div>
        <div class="cb-row"><span class="cb">&#9744;</span> <strong>d.</strong> H-1B3 Fashion model of distinguished merit and ability</div>
        <div class="cb-row"><span class="cb">&#9744;</span> <strong>e.</strong> H-2A Agricultural worker</div>
        <div class="cb-row"><span class="cb">&#9744;</span> <strong>f.</strong> H-2B Non-agricultural worker</div>
        <div class="cb-row"><span class="cb">&#9744;</span> <strong>g.</strong> H-3 Trainee</div>
        <div class="cb-row"><span class="cb">&#9744;</span> <strong>h.</strong> H-3 Special education exchange visitor program</div>
      </div>
    </div>

    ${sectionHeader('Section 1. Complete This Section If Filing for H-1B Classification')}
    <div class="bordered-row">
      <div class="item-row"><strong>1.</strong> Describe the proposed duties.</div>
      <div style="min-height:40px;border-bottom:1px solid #ccc;margin:4px 0;">${position} — This specialty occupation requires the theoretical and practical application of highly specialized knowledge in the applicable field and the attainment of at least a bachelor's degree or its equivalent in the specific specialty. SOC: ${socCode}.</div>
      <div class="item-row"><strong>2.</strong> Describe the beneficiary's present occupation and summary of prior work experience.</div>
      <div style="min-height:40px;margin:4px 0;"></div>
    </div>

    <div style="margin-top:8px;font-size:9px;font-weight:bold;text-decoration:underline;">Statement for H-1B Specialty Occupations and H-1B1 Chile and Singapore</div>
    <p style="font-size:8.5px;margin:4px 0;">By filing this petition, I agree to, and will abide by, the terms of the LCA and the petition for the duration of the beneficiary's authorized period of stay for H-1B or H-1B1 employment.</p>
    <table style="width:100%;margin-top:8px;">
      <tr>
        <td style="width:33%;"><div style="font-size:9px;font-weight:bold;">Signature of Petitioner</div><div class="sig-line"></div></td>
        <td style="width:34%;padding:0 8px;"><div style="font-size:9px;font-weight:bold;">Name of Petitioner</div><div style="font-size:9px;padding-top:4px;">${company}</div></td>
        <td style="width:33%;"><div style="font-size:9px;font-weight:bold;">Date (mm/dd/yyyy)</div><div style="font-size:9px;padding-top:4px;">${todayStr}</div></td>
      </tr>
    </table>

    ${footer(7)}
  </div>`;

  // ── H-1B DATA COLLECTION SUPPLEMENT — PAGE 8 ────────────────────────
  const suppPage2 = `
  <div class="page">
    <table><tr>
      <td style="width:60px;">${sealBlock}</td>
      <td style="text-align:center;">
        <div class="supplement-header">H-1B and H-1B1 Data Collection and Filing Fee Exemption Supplement</div>
        <div class="form-sub">Department of Homeland Security</div>
        <div class="form-sub2">U.S. Citizenship and Immigration Services</div>
      </td>
      <td style="width:140px;">${ombBlock}</td>
    </tr></table>
    <hr class="header-rule"/><hr class="header-rule2"/>

    <div class="item-row"><strong>1.</strong> Name of the Petitioner ${row(fieldBox('', company))}</div>
    <div class="item-row"><strong>2.</strong> Name of the Beneficiary ${row(fieldBox('', ''))}</div>

    ${sectionHeader('Section 1. General Information')}
    <div class="bordered-row">
      <div class="item-row"><strong>1. Employer Information</strong> - (select all items that apply)</div>
      <div style="margin-left:12px;">
        <div style="display:flex;justify-content:space-between;margin:2px 0;"><span>a. Is the petitioner an H-1B dependent employer?</span><span>${yesNo(false)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:2px 0;"><span>b. Has the petitioner ever been found to be a willful violator?</span><span>${yesNo(false)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:2px 0;"><span>c. Is the beneficiary an H-1B nonimmigrant exempt from the Department of Labor attestation requirements?</span><span>${yesNo(false)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:2px 0;"><span>d. Does the petitioner employ 50 or more individuals in the United States?</span><span>${yesNo(false)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:2px 0;"><span>d.1. If yes, are more than 50 percent of those employees in H-1B, L-1A, or L-1B nonimmigrant status?</span><span>${yesNo(false)}</span></div>
      </div>
    </div>

    <div class="item-row"><strong>2. Beneficiary's Highest Level of Education</strong> (select only one box)
      <div class="indent">
        <span class="cb">&#9744;</span> a. NO DIPLOMA &nbsp;&nbsp;
        <span class="cb">&#9744;</span> b. HIGH SCHOOL &nbsp;&nbsp;
        <span class="cb">&#9744;</span> c. Some college &nbsp;&nbsp;
        <span class="cb">&#9744;</span> d. One or more years &nbsp;&nbsp;
        <span class="cb">&#9744;</span> e. Associate's<br/>
        <span class="cb">&#9745;</span> f. Bachelor's degree &nbsp;&nbsp;
        <span class="cb">&#9744;</span> g. Master's degree &nbsp;&nbsp;
        <span class="cb">&#9744;</span> h. Professional degree &nbsp;&nbsp;
        <span class="cb">&#9744;</span> i. Doctorate degree
      </div>
    </div>

    <div class="item-row"><strong>3.</strong> Major/Primary Field of Study ${row(fieldBox('', ''))}</div>
    ${row(
      fieldBox('4. Rate of Pay Per Year', offeredWage ? `$${offeredWage}` : prevWage, 1),
      fieldBox('5. SOC Code', socCode ? '&#9658; ' + socCode : '', 1),
      fieldBox('6. NAICS Code', '', 1)
    )}
    <div class="item-row"><strong>7.</strong> What level of education is required for the position? ${row(fieldBox('', "Bachelor's Degree or Higher in a specialized field"))}</div>
    <div class="item-row"><strong>8.</strong> What field(s) of study would qualify someone for this position? ${row(fieldBox('', ''))}</div>
    <div class="item-row"><strong>9.</strong> How many years of experience are required? ${row(fieldBox('', '', 0.3))}</div>
    <div class="item-row"><strong>10.</strong> What special skills are required? ${row(fieldBox('', ''))}</div>
    <div class="item-row"><strong>11.</strong> How many people will the beneficiary supervise and what are their position titles? ${row(fieldBox('', ''))}</div>

    ${footer(8)}
  </div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Form I-129 — ${company}</title>
<style>${css}</style>
</head>
<body>
${page1}
${page2}
${page3}
${page4}
${page5}
${page6}
${suppPage1}
${suppPage2}
</body>
</html>`;
}

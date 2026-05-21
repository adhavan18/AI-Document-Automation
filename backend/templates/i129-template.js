export function buildI129HTML(matter) {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const yyyy = today.getFullYear();
  const todayStr = `${mm}/${dd}/${yyyy}`;

  const syn = {
    '001': { ein: '47-1234567', naics: '541511', countryBirth: 'India', dob: '05/15/1988', i94: '12345678901', passportNo: 'P1234567', passportCountry: 'India', passportIssued: '01/10/2020', passportExpiry: '01/09/2030', currentStatus: 'H-1B', statusExpiry: '09/30/2024', grossIncome: '$45,000,000', netIncome: '$8,200,000', lca: 'I-200-24-154-12345', bizType: 'Technology / Software Development', yearEst: '2005', employees: '250' },
    '002': { ein: '83-7654321', naics: '541330', countryBirth: 'United Kingdom', dob: '03/22/1979', i94: '98765432109', passportNo: 'P9876543', passportCountry: 'United Kingdom', passportIssued: '06/15/2018', passportExpiry: '06/14/2028', currentStatus: 'L-1A', statusExpiry: '12/31/2024', grossIncome: '$120,000,000', netIncome: '$22,500,000', lca: 'N/A', bizType: 'Engineering Services / Consulting', yearEst: '1998', employees: '1,200' },
    '003': { ein: '61-9876543', naics: '541715', countryBirth: 'Canada', dob: '11/08/1985', i94: '11223344556', passportNo: 'P5556667', passportCountry: 'Canada', passportIssued: '03/01/2022', passportExpiry: '02/28/2032', currentStatus: 'O-1A', statusExpiry: '08/31/2024', grossIncome: '$28,000,000', netIncome: '$5,100,000', lca: 'N/A', bizType: 'Research and Development', yearEst: '2012', employees: '85' },
  };
  const s = syn[matter.id] || syn['001'];

  const isH1B = matter.id === '001';
  const isL1A = matter.id === '002';
  const isO1  = matter.id === '003';

  const cls = isH1B ? 'H-1B' : isL1A ? 'L-1A' : 'O-1A';

  const nameParts = matter.beneficiary.split(' ');
  const lastName  = nameParts.slice(-1)[0];
  const firstName = nameParts[0];
  const midName   = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

  const addressParts = (matter.company_address || '100 Market Street, San Francisco, CA 94105').split(',');
  const street = addressParts[0]?.trim() || '100 Market Street';
  const city   = addressParts[1]?.trim() || 'San Francisco';
  const stateZip = addressParts[2]?.trim() || 'CA 94105';
  const stateCode = stateZip.split(' ')[0] || 'CA';
  const zipCode   = stateZip.split(' ')[1] || '94105';

  const workCity  = matter.worksite.split(',')[0]?.trim() || 'San Francisco';
  const workState = matter.worksite.split(',')[1]?.trim().substring(0, 2) || 'CA';

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
    .field-value-normal { font-size: 10px; padding-top: 1px; }
    .item-row { margin-top: 8px; }
    .item-num { font-weight: bold; }
    .item-text { margin-left: 4px; }
    .indent { margin-left: 20px; }
    .cb-row { margin: 4px 0; }
    .cb { font-size: 12px; }
    .sig-line { border-bottom: 1px solid #000; min-height: 22px; margin: 2px 0; }
    .arrow { font-size: 12px; }
    .note { font-size: 8px; font-style: italic; }
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
        <td style="text-align:right;">Page ${page} of 38</td>
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
          Class: ________________<br/>
          No. of Workers: ________________<br/>
          Job Code: ________________<br/>
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
      ${row(fieldBox('', matter.company))}
    </div>

    <div class="item-row">
      <strong>3. Mailing Address of Individual, Company or Organization</strong>
      ${row(fieldBox('In Care Of Name', ''))}
      ${row(fieldBox('Street Number and Name', street, 3))}
      ${aptSteFrNum()}
      ${row(fieldBox('City or Town', city, 2), fieldBox('State', stateCode, 0.5), fieldBox('ZIP Code', zipCode, 0.8))}
      ${row(fieldBox('Province', '', 1), fieldBox('Postal Code', '', 1), fieldBox('Country', 'United States', 1))}
    </div>

    <div class="item-row">
      <strong>4. Contact Information</strong>
      ${row(fieldBox('Daytime Telephone Number', '(415) 555-0100', 1), fieldBox('Mobile Telephone Number', '', 1), fieldBox('Email Address (if any)', 'hr@' + matter.company.toLowerCase().replace(/[^a-z]/g,'') + '.com', 1.5))}
    </div>

    <div class="item-row"><strong>Other Information</strong></div>
    <div class="item-row">
      <strong>5.</strong> Federal Employer Identification Number (FEIN)
      <br/>&#9658; ${row(fieldBox('', s.ein, 1, '24px'))}
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
      ${row(fieldBox('', cls, 0.3))}
    </div>

    <div class="item-row">
      <strong>2.</strong> Basis for Classification (select only one box):
      <div class="indent">
        <div class="cb-row"><span class="cb">${checked(false)}</span> a. New employment.</div>
        <div class="cb-row"><span class="cb">${checked(false)}</span> b. New concurrent employment.</div>
        <div class="cb-row"><span class="cb">${checked(false)}</span> c. Change of employer.</div>
        <div class="cb-row"><span class="cb">${checked(false)}</span> d. Amended petition.</div>
        <div class="cb-row"><span class="cb">${checked(false)}</span> e. Change in previously approved employment.</div>
        <div class="cb-row"><span class="cb">${checked(true)}</span> f. Continuation of previously approved employment without change with the same employer.</div>
      </div>
    </div>

    <div class="item-row">
      <strong>3.</strong> Provide the most recent petition/application receipt number for the beneficiary. If none exists, indicate "None."
      ${row(fieldBox('', 'None', 1, '24px'))}
    </div>

    <div class="item-row">
      <strong>4.</strong> Requested Action (select only one box):
      <div class="indent">
        <div class="cb-row"><span class="cb">${checked(false)}</span> a. Notify the office in Part 4. so each beneficiary can obtain a visa or be admitted.</div>
        <div class="cb-row"><span class="cb">${checked(false)}</span> b. Change the status and extend the stay of each beneficiary because the beneficiary(ies) is/are now in the United States in another status.</div>
        <div class="cb-row"><span class="cb">${checked(true)}</span> c. Extend the stay of each beneficiary because the beneficiary(ies) now hold(s) this status.</div>
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
      ${row(fieldBox('Family Name (Last Name)', lastName), fieldBox('Given Name (First Name)', firstName), fieldBox('Middle Name', midName))}
    </div>

    <div class="item-row">
      <strong>4.</strong> Provide all other names the beneficiary has used. Include nicknames, aliases, maiden name, and names from all previous marriages.
      ${row(fieldBox('', 'None'))}
    </div>

    <div class="item-row">
      <strong>5.</strong> Other Information
      ${row(
        fieldBox('Date of birth (mm/dd/yyyy)', s.dob, 1),
        fieldBox('Sex', 'Male', 0.5),
        fieldBox('U.S. Social Security Number (if any)', 'N/A', 1),
        fieldBox('Alien Registration Number (A-Number)', 'N/A', 1),
        fieldBox('Province of Birth', '', 1)
      )}
    </div>

    <div class="item-row">
      <strong>6.</strong> If the beneficiary is in the United States, complete the following:
      ${row(
        fieldBox('Country of Birth', s.countryBirth, 1),
        fieldBox('I-94 Arrival-Departure Record Number', s.i94, 1),
        fieldBox('Date of Last Arrival (mm/dd/yyyy)', '10/01/2021', 1)
      )}
      ${row(
        fieldBox('Passport or Travel Document Number', s.passportNo, 1),
        fieldBox('Passport or Travel Document Country of Issuance', s.passportCountry, 1),
        fieldBox('Date Passport or Travel Document Issued (mm/dd/yyyy)', s.passportIssued, 1),
        fieldBox('Date Passport or Travel Document Expires (mm/dd/yyyy)', s.passportExpiry, 1)
      )}
      ${row(
        fieldBox('Current Nonimmigrant Status', s.currentStatus, 1),
        fieldBox('Date Status Expires (mm/dd/yyyy) or D/S', s.statusExpiry, 1),
        fieldBox('Country of Citizenship or Nationality', s.countryBirth, 1)
      )}
      ${row(
        fieldBox('Employment Authorization Document (EAD) Number (if any)', 'N/A', 1),
        fieldBox('Student and Exchange Visitor Information System (SEVIS) Number (if any)', 'N/A', 1)
      )}
    </div>

    <div class="item-row">
      <strong>7.</strong> Current Residential U.S. Address (if applicable) (do not list a P.O. Box)
      ${row(fieldBox('Street Number and Name', '1234 Main Street', 2))}
      ${aptSteFrNum()}
      ${row(fieldBox('City or Town', workCity, 1.5), fieldBox('State', workState, 0.4), fieldBox('ZIP Code', zipCode, 0.6))}
    </div>

    ${footer(2)}
  </div>`;

  // ── PAGE 3 ─────────────────────────────────────────
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
    ${row(fieldBox('b. Office Address (City)', 'N/A — Beneficiary in U.S.', 1.5), fieldBox('c. U.S. State or Foreign Country', 'N/A', 1))}

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
      <span>${yesNo(false)}</span>
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>9.</strong> Have you ever previously filed a nonimmigrant petition for this beneficiary?</span>
      <span>${yesNo(true)}</span>
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span>&nbsp;&nbsp;&nbsp;&nbsp;<strong>a.</strong> Has any beneficiary in this petition ever been given the classification you are now requesting within the last seven years?</span>
      <span>${yesNo(true)}</span>
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
      ${row(fieldBox('City or Town', '', 1.5), fieldBox('State', '', 0.5), fieldBox('Province', '', 1), fieldBox('Postal Code', '', 0.8), fieldBox('Country', s.countryBirth, 1))}
    </div>

    ${footer(3)}
  </div>`;

  // ── PAGE 4 ─────────────────────────────────────────
  const page4 = `
  <div class="page">
    ${partHeader('Part 5. Basic Information About the Proposed Employment and Employer')}

    <div class="item-row"><strong>Attach the Form I-129 supplement relevant to the classification of the worker(s) you are requesting.</strong></div>

    <div class="item-row">
      <strong>1.</strong> Job Title
      ${row(fieldBox('', matter.position))}
    </div>

    <div class="item-row">
      <strong>2.</strong> Labor Condition Application (LCA) or Employment and Training Administration (ETA) Case Number
      ${row(fieldBox('', s.lca))}
    </div>

    <div class="item-row">
      <strong>3.</strong> Address(es) where the beneficiary(ies) will work if different from address in Part 1.
      <div style="margin-left:12px;margin-top:4px;">
        <div style="font-size:9px;font-weight:bold;">Address 1</div>
        ${row(fieldBox('Street Number and Name', '', 2))}
        ${aptSteFrNum()}
        ${row(fieldBox('City or Town', workCity, 1.5), fieldBox('State', workState, 0.4), fieldBox('ZIP Code', zipCode, 0.6))}
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
      ${row(fieldBox('', matter.wage_amount.replace('$', ''), 0.6), fieldBox('per (Specify hour, week, month, or year)', 'Year', 1))}
    </div>
    <div class="item-row">
      <strong>10.</strong> Other Compensation (Explain)
      ${row(fieldBox('', 'None', 1, '24px'))}
    </div>
    <div class="item-row">
      <strong>11.</strong> Dates of intended employment &nbsp;&nbsp;
      From: <strong>${matter.start_date}</strong> &nbsp;&nbsp;&nbsp; To: <strong>${matter.end_date}</strong>
    </div>

    <div style="margin-top:12px;">
      ${row(
        fieldBox('12. Type of Business', s.bizType, 2),
        fieldBox('13. Year Established', s.yearEst, 0.7),
        fieldBox('14. Current Number of Employees in the United States', s.employees, 1)
      )}
    </div>
    <div class="item-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span><strong>15.</strong> Do you currently employ a total of 25 or fewer full-time equivalent employees in the United States, including all affiliates or subsidiaries of this company/organization?</span>
      <span>${yesNo(false)}</span>
    </div>
    ${row(
      fieldBox('16. Gross Annual Income', s.grossIncome, 1),
      fieldBox('17. Net Annual Income', s.netIncome, 1)
    )}

    ${footer(4)}
  </div>`;

  // ── PAGE 5 ─────────────────────────────────────────
  const page5 = `
  <div class="page">
    ${partHeader('Part 6. Certification Regarding the Release of Controlled Technology or Technical Data to Foreign Persons in the United States')}

    <p style="font-size:9px;margin:4px 0;font-style:italic;">(This section of the form is required only for H-1B, H-1B1 Chile/Singapore, L-1, and O-1A petitions. It is not required for any other classifications. Please review the Form I-129 General Filing Instructions before completing this section.)</p>
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
        fieldBox('Family Name (Last Name)', matter.company.split(' ')[0], 1),
        fieldBox('Given Name (First Name)', 'HR Director', 1),
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
        fieldBox('Daytime Telephone Number', '(415) 555-0100', 1),
        fieldBox('Email Address (if any)', 'hr@' + matter.company.toLowerCase().replace(/[^a-z]/g,'') + '.com', 1.5)
      )}
    </div>

    <p style="font-size:8.5px;margin:8px 0;"><strong>NOTE:</strong> If you do not fully complete this form or fail to submit the required documents listed in the instructions, a final decision on your petition may be delayed or the petition may be denied.</p>

    ${partHeader('Part 8. Declaration, Signature, and Contact Information of Person Preparing Form, If Other Than Petitioner')}

    <p style="font-size:9px;margin:4px 0;">Provide the following information concerning the preparer:</p>

    <div class="item-row">
      <strong>1.</strong> Name of Preparer
      ${row(fieldBox('Family Name (Last Name)', matter.attorney.split(' ').slice(-1)[0], 1), fieldBox('Given Name (First Name)', matter.attorney.split(' ')[0], 1))}
    </div>
    <div class="item-row">
      <strong>2.</strong> Preparer's Business or Organization Name (if any)
      ${row(fieldBox('', matter.law_firm))}
    </div>
    <div class="item-row">
      <strong>3.</strong> Preparer's Mailing Address
      ${row(fieldBox('Street Number and Name', '1000 Wilshire Blvd', 2))}
      ${aptSteFrNum()}
      ${row(fieldBox('City or Town', 'Los Angeles', 1.5), fieldBox('State', 'CA', 0.4), fieldBox('ZIP Code', '90017', 0.6))}
      ${row(fieldBox('Province', '', 1), fieldBox('Postal Code', '', 1), fieldBox('Country', 'United States', 1))}
    </div>
    <div class="item-row">
      <strong>4.</strong> Preparer's Contact Information
      ${row(fieldBox('Daytime Telephone Number', '(310) 555-0200', 1), fieldBox('Fax Number', '(310) 555-0201', 1), fieldBox('Email Address (if any)', matter.attorney.toLowerCase().replace(/[^a-z]/g,'') + '@' + matter.law_firm.toLowerCase().replace(/[^a-z]/g,'') + '.com', 1.5))}
    </div>

    <div style="background:#E8E8E8;padding:3px 6px;font-size:10px;font-weight:bold;font-style:italic;margin-top:8px;">Preparer's Declaration</div>
    <p style="font-size:8.5px;margin:4px 0;">By my signature, I certify, swear, or affirm, under penalty of perjury, that I prepared this petition on behalf of, at the request of, and with the express consent of the petitioner or authorized signatory. The petitioner has reviewed this completed petition as prepared by me and informed me that all of the information in the form and in the supporting documents, is complete, true, and correct.</p>

    <div class="item-row">
      <strong>5.</strong> Signature and Date
      <div style="font-size:9px;margin-top:2px;">Signature of Preparer &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date of Signature (mm/dd/yyyy)</div>
      <div style="display:flex;gap:20px;margin-top:2px;">
        <div style="flex:3;"><div class="sig-line"></div></div>
        <div style="flex:1;"><div class="sig-line"></div></div>
      </div>
    </div>

    ${footer(5)}
  </div>`;

  // ── PAGE 6 ─────────────────────
  const page6 = `
  <div class="page">
    ${partHeader('Part 9. Additional Information About Your Petition For Nonimmigrant Worker')}

    <p style="font-size:9px;margin:4px 0;">If you require more space to provide any additional information within this petition, use the space below. If you require more space than what is provided to complete this petition, you may make a copy of Part 9. to complete and file with this petition. In order to assist us in reviewing your response, you must identify the Page Number, Part Number and Item Number corresponding to the additional information.</p>

    <div class="item-row">
      <strong>1.</strong> A-Number &#9658; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>2.</strong>
      ${row(fieldBox('Page Number', '', 0.5), fieldBox('Part Number', '', 0.5), fieldBox('Item Number', '', 0.5))}
      ${row(fieldBox('Additional Information', `Matter Reference: ${matter.id} — ${matter.type}. Beneficiary ${matter.beneficiary} is petitioned for the position of ${matter.position} at ${matter.company}, ${matter.worksite}. Employment period: ${matter.start_date} to ${matter.end_date}. Wage: ${matter.wage_amount} ${matter.wage_period} (${matter.wage_level}).`, 1, '60px'))}
    </div>
    <div class="item-row">
      <strong>3.</strong>
      ${row(fieldBox('Page Number', '', 0.5), fieldBox('Part Number', '', 0.5), fieldBox('Item Number', '', 0.5))}
      ${row(fieldBox('', '', 1, '40px'))}
    </div>
    <div class="item-row">
      <strong>4.</strong>
      ${row(fieldBox('Page Number', '', 0.5), fieldBox('Part Number', '', 0.5), fieldBox('Item Number', '', 0.5))}
      ${row(fieldBox('', '', 1, '40px'))}
    </div>

    ${footer(6)}
  </div>`;

  // ── SUPPLEMENTS ──────────────────────────────────────────────────────
  let supplement = '';

  if (isH1B) {
    supplement = `
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

      <div class="item-row"><strong>1.</strong> Name of the Petitioner ${row(fieldBox('', matter.company))}</div>
      <div class="item-row"><strong>2.a.</strong> Name of the Beneficiary ${row(fieldBox('', matter.beneficiary))}</div>
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
        <div style="min-height:40px;border-bottom:1px solid #ccc;margin:4px 0;">${matter.position} — Responsible for design, development, and maintenance of software systems using modern engineering practices. Requires specialized knowledge in ${s.bizType}.</div>
        <div class="item-row"><strong>2.</strong> Describe the beneficiary's present occupation and summary of prior work experience.</div>
        <div style="min-height:40px;margin:4px 0;">Currently employed in ${cls} status performing ${matter.position} duties. Has over 5 years of specialized experience in the field relevant to this position.</div>
      </div>

      <div style="margin-top:8px;font-size:9px;font-weight:bold;text-decoration:underline;">Statement for H-1B Specialty Occupations and H-1B1 Chile and Singapore</div>
      <p style="font-size:8.5px;margin:4px 0;">By filing this petition, I agree to, and will abide by, the terms of the LCA and the petition for the duration of the beneficiary's authorized period of stay for H-1B or H-1B1 employment.</p>
      <table style="width:100%;margin-top:8px;">
        <tr>
          <td style="width:33%;"><div style="font-size:9px;font-weight:bold;">Signature of Petitioner</div><div class="sig-line"></div></td>
          <td style="width:34%;padding:0 8px;"><div style="font-size:9px;font-weight:bold;">Name of Petitioner</div><div style="font-size:9px;padding-top:4px;">${matter.company}</div></td>
          <td style="width:33%;"><div style="font-size:9px;font-weight:bold;">Date (mm/dd/yyyy)</div><div style="font-size:9px;padding-top:4px;">${todayStr}</div></td>
        </tr>
      </table>

      ${footer(13)}
    </div>

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

      <div class="item-row"><strong>1.</strong> Name of the Petitioner ${row(fieldBox('', matter.company))}</div>
      <div class="item-row"><strong>2.</strong> Name of the Beneficiary ${row(fieldBox('', matter.beneficiary))}</div>

      ${sectionHeader('Section 1. General Information')}
      <div class="bordered-row">
        <div class="item-row"><strong>1. Employer Information</strong> - (select all items that apply)</div>
        <div style="margin-left:12px;">
          <div style="display:flex;justify-content:space-between;margin:2px 0;"><span>a. Is the petitioner an H-1B dependent employer?</span><span>${yesNo(false)}</span></div>
          <div style="display:flex;justify-content:space-between;margin:2px 0;"><span>b. Has the petitioner ever been found to be a willful violator?</span><span>${yesNo(false)}</span></div>
          <div style="display:flex;justify-content:space-between;margin:2px 0;"><span>c. Is the beneficiary an H-1B nonimmigrant exempt from the Department of Labor attestation requirements?</span><span>${yesNo(false)}</span></div>
          <div style="display:flex;justify-content:space-between;margin:2px 0;"><span>d. Does the petitioner employ 50 or more individuals in the United States?</span><span>${yesNo(true)}</span></div>
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

      <div class="item-row"><strong>3.</strong> Major/Primary Field of Study ${row(fieldBox('', 'Computer Science / Software Engineering'))}</div>
      ${row(
        fieldBox('4. Rate of Pay Per Year', matter.wage_amount, 1),
        fieldBox('5. SOC Code', '&#9658; ' + matter.soc_code.replace('-', ' - '), 1),
        fieldBox('6. NAICS Code', s.naics, 1)
      )}
      <div class="item-row"><strong>7.</strong> What level of education is required for the position? ${row(fieldBox('', "Bachelor's Degree or Higher in Computer Science or related field"))}</div>
      <div class="item-row"><strong>8.</strong> What field(s) of study would qualify someone for this position? ${row(fieldBox('', 'Computer Science, Software Engineering, Information Technology, or closely related field'))}</div>
      <div class="item-row"><strong>9.</strong> How many years of experience are required? ${row(fieldBox('', '3+ years', 0.3))}</div>
      <div class="item-row"><strong>10.</strong> What special skills are required? ${row(fieldBox('', 'Advanced proficiency in software development, system design, and modern programming languages'))}</div>
      <div class="item-row"><strong>11.</strong> How many people will the beneficiary supervise and what are their position titles? ${row(fieldBox('', '0 — Individual contributor role'))}</div>

      ${footer(21)}
    </div>`;
  }

  if (isL1A) {
    supplement = `
    <div class="page">
      <table><tr>
        <td style="width:60px;vertical-align:middle;">${sealBlock}</td>
        <td style="text-align:center;">
          <div class="supplement-header">L Classification Supplement to Form I-129</div>
          <div class="form-sub">Department of Homeland Security</div>
          <div class="form-sub2">U.S. Citizenship and Immigration Services</div>
        </td>
        <td style="width:140px;">${ombBlock}</td>
      </tr></table>
      <hr class="header-rule"/><hr class="header-rule2"/>

      <div class="item-row"><strong>1.</strong> Name of the Petitioner ${row(fieldBox('', matter.company))}</div>
      <div class="item-row"><strong>2.</strong> Name of the Beneficiary ${row(fieldBox('', matter.beneficiary))}</div>
      <div class="item-row">
        <strong>3.</strong> This petition is (select only one box): &nbsp;
        <span class="cb">&#9745;</span> <strong>a.</strong> An individual petition &nbsp;&nbsp;
        <span class="cb">&#9744;</span> <strong>b.</strong> A blanket petition
      </div>
      <div class="item-row" style="display:flex;justify-content:space-between;">
        <span><strong>4.a.</strong> Does the petitioner employ 50 or more individuals in the U.S.?</span>
        <span>${yesNo(true)}</span>
      </div>
      <div class="item-row" style="display:flex;justify-content:space-between;">
        <span><strong>4.b.</strong> If yes, are more than 50 percent of those employees in H-1B, L-1A, or L-1B nonimmigrant status?</span>
        <span>${yesNo(false)}</span>
      </div>

      ${sectionHeader('Section 1. Complete This Section If Filing For An Individual Petition')}
      <div class="bordered-row">
        <div class="item-row">
          <strong>1.</strong> Classification sought (select only one box): &nbsp;
          <span class="cb">&#9745;</span> <strong>a.</strong> L-1A manager or executive &nbsp;&nbsp;
          <span class="cb">&#9744;</span> <strong>b.</strong> L-1B specialized knowledge
        </div>

        <div class="item-row">
          <strong>2.</strong> List the beneficiary's and any dependent family member's prior periods of stay in an H or L classification in the United States for the last seven years. Be sure to list only those periods in which the beneficiary and/or family members were physically present in the U.S. in an H or L classification.
          <table style="margin-top:4px;border:1px solid #000;">
            <tr style="background:#E8E8E8;">
              <th style="padding:4px 8px;border:1px solid #000;width:50%;">Subject's Name</th>
              <th style="padding:4px 8px;border:1px solid #000;" colspan="2">Period of Stay (mm/dd/yyyy)</th>
            </tr>
            <tr><th style="border:1px solid #000;"></th><th style="border:1px solid #000;padding:2px 8px;">From</th><th style="border:1px solid #000;padding:2px 8px;">To</th></tr>
            <tr><td style="border:1px solid #000;padding:2px 8px;">${matter.beneficiary}</td><td style="border:1px solid #000;padding:2px 8px;">01/15/2022</td><td style="border:1px solid #000;padding:2px 8px;">${s.statusExpiry}</td></tr>
            ${[1,2,3,4,5].map(() => `<tr><td style="border:1px solid #000;height:20px;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>`).join('')}
          </table>
        </div>

        <div class="item-row"><strong>3.</strong> Name of employer abroad ${row(fieldBox('', matter.company + ' (UK Ltd.)'))}</div>
        <div class="item-row">
          <strong>4.</strong> Address of employer abroad
          ${row(fieldBox('Street Number and Name', '50 Cannon Street', 2))}
          ${row(fieldBox('City or Town', 'London', 1.5), fieldBox('Province', 'Greater London', 1), fieldBox('Postal Code', 'EC4N 6JJ', 0.8), fieldBox('Country', 'United Kingdom', 1))}
        </div>
        <div class="item-row">
          <strong>5.</strong> Dates of beneficiary's employment with this employer. Explain any interruptions in employment.
          ${row(fieldBox('Dates of Employment From (mm/dd/yyyy)', '06/15/2015', 1), fieldBox('Dates of Employment To (mm/dd/yyyy)', '01/14/2022', 1))}
          ${row(fieldBox('Explanation of Interruptions', 'No interruptions — continuous employment.', 1, '40px'))}
        </div>
        <div class="item-row">
          <strong>6.</strong> Describe the beneficiary's job duties abroad for the 3 years preceding the filing of the petition.
          ${row(fieldBox('', 'Served as Director of Engineering for the UK affiliate, managing a team of 80+ engineers across 4 product lines. Oversaw budget of £15M annually. Reported directly to Managing Director.', 1, '60px'))}
        </div>
        <div class="item-row">
          <strong>7.</strong> Describe the beneficiary's proposed job duties in the United States.
          ${row(fieldBox('', `As ${matter.position}, beneficiary will direct engineering operations across U.S. business units, manage senior engineering staff, set strategic technical direction, and oversee multi-million dollar product budgets at ${matter.company}.`, 1, '60px'))}
        </div>
        <div class="item-row">
          <strong>8.</strong> Summarize the beneficiary's education and work experience.
          ${row(fieldBox('', "Master's degree in Engineering Management, University of Cambridge (2003). Bachelor's degree in Mechanical Engineering, Imperial College London (2001). 18+ years of progressive engineering management experience.", 1, '50px'))}
        </div>
        <div class="item-row">
          <strong>9.</strong> The U.S. company is to the company abroad: (select only one box)
          <div class="indent">
            <div class="cb-row"><span class="cb">&#9745;</span> <strong>a.</strong> Parent &nbsp;&nbsp; <span class="cb">&#9744;</span> <strong>b.</strong> Branch &nbsp;&nbsp; <span class="cb">&#9744;</span> <strong>c.</strong> Subsidiary &nbsp;&nbsp; <span class="cb">&#9744;</span> <strong>d.</strong> Affiliate &nbsp;&nbsp; <span class="cb">&#9744;</span> <strong>e.</strong> Joint Venture</div>
          </div>
        </div>
        <div class="item-row">
          <strong>10.</strong> Describe the stock ownership and managerial control of each company. Provide the U.S. tax code, if any, governing the relationship between the U.S. and foreign entity.
          ${row(fieldBox('', `${matter.company} holds 100% of the voting stock of ${matter.company} (UK Ltd.). The U.S. parent exercises full managerial control over the foreign affiliate. Qualifying organizational relationship under 8 CFR 214.2(l)(1)(ii)(G).`, 1, '50px'))}
        </div>
        <div class="item-row">
          <strong>11.</strong> Do the U.S. and foreign companies currently have the same qualifying relationship as they did during the one-year period of the alien's employment with the company abroad?
          <div style="margin-top:4px;">${yesNo(true)}</div>
        </div>
        <div class="item-row">
          <strong>12.</strong> Is the beneficiary coming to the United States to open a new office?
          <div style="margin-top:4px;">${yesNo(false)}</div>
        </div>
      </div>

      ${footer(15)}
    </div>

    <div class="page">
      <table><tr>
        <td style="width:60px;">${sealBlock}</td>
        <td style="text-align:center;">
          <div class="supplement-header">L Classification Supplement to Form I-129 (continued)</div>
          <div class="form-sub">Department of Homeland Security</div>
          <div class="form-sub2">U.S. Citizenship and Immigration Services</div>
        </td>
        <td style="width:140px;">${ombBlock}</td>
      </tr></table>
      <hr class="header-rule"/><hr class="header-rule2"/>

      ${sectionHeader('Section 2. Complete This Section If Filing A Blanket Petition')}
      <div class="bordered-row">
        <p style="font-size:9px;margin:4px 0;font-style:italic;">This section is not applicable — individual petition is being filed.</p>
        <div class="item-row" style="display:flex;justify-content:space-between;"><span><strong>1.</strong> List all U.S. and foreign parent, branches, subsidiaries, and affiliates included in this petition.</span></div>
        <div style="min-height:60px;margin:4px 0;color:#999;font-style:italic;">N/A</div>
      </div>

      ${sectionHeader('Section 3. Additional Fees')}
      <div class="bordered-row">
        <p style="font-size:9px;margin:4px 0;">For petitions requesting an extension of L-1 status only, complete the following:</p>
        <div class="item-row" style="display:flex;justify-content:space-between;">
          <span><strong>1.</strong> Will any beneficiary in this petition be employed in the United States primarily at a worksite outside the petitioner's headquarters or place of business?</span>
          <span>${yesNo(false)}</span>
        </div>
        <div class="item-row" style="display:flex;justify-content:space-between;">
          <span><strong>2.</strong> Have you ever filed an L-1 petition for any beneficiary in this petition before?</span>
          <span>${yesNo(true)}</span>
        </div>
      </div>

      <div style="margin-top:12px;font-size:9px;font-weight:bold;text-decoration:underline;">L Classification Certification</div>
      <p style="font-size:8.5px;margin:4px 0;">By filing this petition, I certify that, if a labor dispute involving a strike or lockout exists at any of the worksite(s) where the beneficiary will be employed, I will notify USCIS within three (3) business days of the commencement of the strike or lockout in compliance with 8 CFR 214.2(l)(7)(ii).</p>

      <table style="width:100%;margin-top:8px;">
        <tr>
          <td style="width:33%;"><div style="font-size:9px;font-weight:bold;">Signature of Petitioner</div><div class="sig-line"></div></td>
          <td style="width:34%;padding:0 8px;"><div style="font-size:9px;font-weight:bold;">Name of Petitioner</div><div style="font-size:9px;padding-top:4px;">${matter.company}</div></td>
          <td style="width:33%;"><div style="font-size:9px;font-weight:bold;">Date (mm/dd/yyyy)</div><div style="font-size:9px;padding-top:4px;">${todayStr}</div></td>
        </tr>
      </table>

      ${footer(16)}
    </div>`;
  }

  if (isO1) {
    supplement = `
    <div class="page">
      <table><tr>
        <td style="width:60px;vertical-align:middle;">${sealBlock}</td>
        <td style="text-align:center;">
          <div class="supplement-header">O and P Classifications Supplement to Form I-129</div>
          <div class="form-sub">Department of Homeland Security</div>
          <div class="form-sub2">U.S. Citizenship and Immigration Services</div>
        </td>
        <td style="width:140px;">${ombBlock}</td>
      </tr></table>
      <hr class="header-rule"/><hr class="header-rule2"/>

      <div class="item-row"><strong>1.</strong> Name of the Petitioner ${row(fieldBox('', matter.company))}</div>
      <div class="item-row"><strong>2.</strong> Name of the Beneficiary ${row(fieldBox('', matter.beneficiary))}</div>

      <div class="item-row">
        <strong>3.</strong> Classification sought (select only one box):
        <div class="indent">
          <div class="cb-row"><span class="cb">&#9745;</span> <strong>a.</strong> O-1A Alien of extraordinary ability in sciences, education, business or athletics (not including the arts, motion pictures or television industry)</div>
          <div class="cb-row"><span class="cb">&#9744;</span> <strong>b.</strong> O-1B Alien of extraordinary ability in the arts or extraordinary achievement in motion picture or television industry</div>
          <div class="cb-row"><span class="cb">&#9744;</span> <strong>c.</strong> O-2 Accompanying alien who is coming to the United States to assist in the artistic or athletic performance of an O-1</div>
          <div class="cb-row"><span class="cb">&#9744;</span> <strong>d.</strong> P-1 Major League Sports</div>
          <div class="cb-row"><span class="cb">&#9744;</span> <strong>e.</strong> P-1 Athlete or Athletic/Entertainment Group (includes minor league sports not affiliated with Major League Sports)</div>
          <div class="cb-row"><span class="cb">&#9744;</span> <strong>f.</strong> P-1S Essential Support Personnel for P-1</div>
          <div class="cb-row"><span class="cb">&#9744;</span> <strong>g.</strong> P-2 Artist or entertainer for reciprocal exchange program</div>
          <div class="cb-row"><span class="cb">&#9744;</span> <strong>h.</strong> P-2S Essential Support Personnel for P-2</div>
          <div class="cb-row"><span class="cb">&#9744;</span> <strong>i.</strong> P-3 Artist/entertainer coming to the United States to perform, teach or coach under a program that is culturally unique</div>
          <div class="cb-row"><span class="cb">&#9744;</span> <strong>j.</strong> P-3S Essential Support Personnel for P-3</div>
        </div>
      </div>

      <div class="item-row" style="display:flex;justify-content:space-between;">
        <span><strong>4.</strong> Explain the nature of the event.</span>
      </div>
      ${row(fieldBox('', `${matter.beneficiary} will engage in research and development activities at ${matter.company} as ${matter.position}, leading scientific work in ${s.bizType}.`, 1, '50px'))}

      <div class="item-row" style="display:flex;justify-content:space-between;">
        <span><strong>5.</strong> Describe the duties to be performed.</span>
      </div>
      ${row(fieldBox('', `Lead original scientific research, publish peer-reviewed work, mentor junior researchers, design and execute experiments, present findings at international conferences, and collaborate with academic institutions.`, 1, '50px'))}

      <div class="item-row">
        <strong>6.</strong> If filing for an O-2 or P alien, list the dates of the events or activities (mm/dd/yyyy):
        ${row(fieldBox('From', matter.start_date, 1), fieldBox('To', matter.end_date, 1))}
      </div>

      ${sectionHeader('Section 1. Complete If Filing for O-1A or O-1B Classification')}
      <div class="bordered-row">
        <div class="item-row">
          <strong>1.</strong> Does the beneficiary have a residence abroad which the beneficiary has no intention of abandoning?
          <div style="margin-top:4px;">${yesNo(true)}</div>
        </div>
        <div class="item-row">
          <strong>2.</strong> Provide the field of extraordinary ability or extraordinary achievement.
          ${row(fieldBox('', 'Computational Research / Data Sciences'))}
        </div>
        <div class="item-row">
          <strong>3.</strong> Provide a written advisory opinion from an appropriate consulting entity.
          <div style="margin-top:4px;">${yesNo(true)} - Letter attached as Exhibit A</div>
        </div>
      </div>

      ${sectionHeader('Section 2. Statement by the Petitioner')}
      <div class="bordered-row">
        <p style="font-size:9px;margin:4px 0;">I, the petitioner, certify that:</p>
        <p style="font-size:9px;margin:4px 0;">The beneficiary will be employed for the period and purpose described in the petition; the petitioner is responsible for the return transportation of the beneficiary if dismissed before the end of the authorized period of stay; and any consultations required have been obtained and are submitted with this petition.</p>
        <table style="width:100%;margin-top:8px;">
          <tr>
            <td style="width:33%;"><div style="font-size:9px;font-weight:bold;">Signature of Petitioner</div><div class="sig-line"></div></td>
            <td style="width:34%;padding:0 8px;"><div style="font-size:9px;font-weight:bold;">Name of Petitioner</div><div style="font-size:9px;padding-top:4px;">${matter.company}</div></td>
            <td style="width:33%;"><div style="font-size:9px;font-weight:bold;">Date (mm/dd/yyyy)</div><div style="font-size:9px;padding-top:4px;">${todayStr}</div></td>
          </tr>
        </table>
      </div>

      ${footer(17)}
    </div>

    <div class="page">
      <table><tr>
        <td style="width:60px;">${sealBlock}</td>
        <td style="text-align:center;">
          <div class="supplement-header">O and P Classifications Supplement (continued)</div>
          <div class="form-sub">Department of Homeland Security</div>
          <div class="form-sub2">U.S. Citizenship and Immigration Services</div>
        </td>
        <td style="width:140px;">${ombBlock}</td>
      </tr></table>
      <hr class="header-rule"/><hr class="header-rule2"/>

      ${sectionHeader('Section 3. Evidence of Extraordinary Ability — O-1A')}
      <div class="bordered-row">
        <p style="font-size:9px;margin:4px 0;">The petitioner must establish that the beneficiary has extraordinary ability in the field of science, education, business, or athletics through evidence demonstrating sustained national or international acclaim. Select all categories of evidence submitted with this petition:</p>
        <div class="indent">
          <div class="cb-row"><span class="cb">&#9745;</span> a. Receipt of nationally or internationally recognized prizes or awards for excellence in the field of endeavor</div>
          <div class="cb-row"><span class="cb">&#9745;</span> b. Membership in associations in the field which require outstanding achievements of their members</div>
          <div class="cb-row"><span class="cb">&#9745;</span> c. Published material in professional or major trade publications about the beneficiary</div>
          <div class="cb-row"><span class="cb">&#9745;</span> d. Participation as a judge of the work of others in the field</div>
          <div class="cb-row"><span class="cb">&#9745;</span> e. Original scientific, scholarly, or business-related contributions of major significance</div>
          <div class="cb-row"><span class="cb">&#9745;</span> f. Authorship of scholarly articles in professional journals or other major media</div>
          <div class="cb-row"><span class="cb">&#9744;</span> g. Employment in a critical or essential capacity for organizations with distinguished reputations</div>
          <div class="cb-row"><span class="cb">&#9745;</span> h. High salary or other significantly high remuneration for services in relation to others in the field</div>
        </div>
      </div>

      ${sectionHeader('Section 4. Itinerary')}
      <div class="bordered-row">
        <p style="font-size:9px;margin:4px 0;">If the beneficiary will perform services in more than one location, an itinerary must be submitted as part of the petition.</p>
        <table style="width:100%;border:1px solid #000;margin-top:4px;">
          <tr style="background:#E8E8E8;">
            <th style="border:1px solid #000;padding:4px;">Date(s)</th>
            <th style="border:1px solid #000;padding:4px;">Location</th>
            <th style="border:1px solid #000;padding:4px;">Activity</th>
          </tr>
          <tr>
            <td style="border:1px solid #000;padding:4px;">${matter.start_date} — ${matter.end_date}</td>
            <td style="border:1px solid #000;padding:4px;">${matter.worksite}</td>
            <td style="border:1px solid #000;padding:4px;">Principal Research Scientist duties at ${matter.company}</td>
          </tr>
        </table>
      </div>

      ${sectionHeader('Section 5. Copy of Written Consultation')}
      <div class="bordered-row">
        <p style="font-size:9px;margin:4px 0;">Written advisory opinion from peer group, labor organization, or person designated by the appropriate group is attached as <strong>Exhibit A</strong>.</p>
      </div>

      ${footer(18)}
    </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Form I-129 — ${matter.id}</title>
<style>${css}</style>
</head>
<body>
${page1}
${page2}
${page3}
${page4}
${page5}
${page6}
${supplement}
</body>
</html>`;
}

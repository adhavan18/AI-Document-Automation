// Coordinate placements for the Acme Resources H-1B Public Access File.
// 6 pages · Letter (612 × 792 pt).
// Coordinates calibrated from Ghostscript-rendered PNG at 72 DPI (1 px = 1 pt).
// PDF origin = bottom-left; formula: pdf_y = 792 - image_y_from_top.

function lca(arr, label) {
  return arr?.find((f) => f.label === label)?.value ?? '';
}

function deriveValidityEnd(matter) {
  const r = lca(matter.computed, 'Retain Until');
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

export function buildPafPlacements(matter) {
  const employer    = matter.employer   ?? '';
  const position    = matter.position   ?? '';
  const worksite    = matter.worksite   ?? '';
  const startDate   = matter.lcaCertified ?? '';
  const endDate     = deriveValidityEnd(matter);
  const socCode     = lca(matter.lca, 'Occupation Code (SOC)');
  const wageRange   = lca(matter.lca, 'Wage Range');
  const prevWage    = lca(matter.lca, 'Prevailing Wage');
  const postStart   = lca(matter.lca, 'Posting Start');
  const postEnd     = lca(matter.lca, 'Posting End');

  return [
    // ── PAGE 0 · Cover ─────────────────────────────────────────────────────
    // Erase template demo values (measured: baseline y≈490, ascenders to y≈498)
    { page: 0, whiteout: true, x:  58, y: 482, width: 155, height: 20 }, // "PAF-H1B-___"
    { page: 0, whiteout: true, x: 228, y: 482, width: 170, height: 20 }, // "West Virginia, USA"
    // Labels row at y≈500; value line is below it at y≈470
    // Document Reference value
    { page: 0, x: 116, y: 470, text: matter.id ?? '',  size: 9 },
    // Worksite Jurisdiction value
    { page: 0, x: 305, y: 470, text: worksite,          size: 9 },
    // Prepared Date value
    { page: 0, x: 490, y: 470, text: today(),           size: 9 },

    // ── PAGE 1 · Section 01 — Employer Information ─────────────────────────
    // Erase template demo values ("Acme Resources" baseline y≈638, address y≈602)
    { page: 1, whiteout: true, x:  57, y: 630, width: 250, height: 18 }, // "Acme Resources" incl. ascenders
    { page: 1, whiteout: true, x:  57, y: 595, width: 500, height: 16 }, // long address line
    // Employer Name (cal: y≈638; labels row just above)
    { page: 1, x: 57,  y: 638, text: employer,  size: 9, bold: true },
    // Registered Business Address / worksite used as address approximation (cal: y≈595)
    { page: 1, x: 57,  y: 595, text: worksite,  size: 9 },

    // ── PAGE 1 · Section 02 — Employee Information ─────────────────────────
    // Employee Full Legal Name (cal: y≈395)
    { page: 1, x: 57,  y: 395, text: matter.employeeName ?? '', size: 9 },
    // Job Title (cal: y≈348)
    { page: 1, x: 57,  y: 348, text: position,  size: 9 },
    // SOC Occupation Code (right column, same row, cal: y≈348)
    { page: 1, x: 315, y: 348, text: socCode,   size: 9 },
    // Authorized Work Location (cal: y≈320)
    { page: 1, x: 57,  y: 320, text: worksite,  size: 9 },
    // Employment Start Date (label at y≈300, value below at y=278)
    { page: 1, x: 57,  y: 278, text: startDate, size: 9 },
    // Employment End Date (right column, same row)
    { page: 1, x: 315, y: 278, text: endDate,   size: 9 },

    // ── PAGE 2 · Section 03 — Certified LCA ───────────────────────────────
    // LCA Case Number (cal: y≈640)
    { page: 2, x: 57,  y: 640, text: matter.id ?? '', size: 9 },
    // Validity Start Date (cal: y≈640, mid column)
    { page: 2, x: 215, y: 640, text: startDate,       size: 9 },
    // Validity End Date (cal: y≈640, right column)
    { page: 2, x: 380, y: 640, text: endDate,         size: 9 },

    // ── PAGE 2 · Section 04 — Wage Rate ───────────────────────────────────
    // Offered Salary/Wage after the $ sign (cal: y≈462)
    { page: 2, x: 70,  y: 462, text: wageRange, size: 9 },
    // Prevailing Wage Source (cal: y≈410)
    { page: 2, x: 57,  y: 410, text: 'U.S. Department of Labor / FLC Data Center', size: 7 },
    // Prevailing Wage Amount (right column, same row, cal: y≈410)
    { page: 2, x: 315, y: 410, text: prevWage,  size: 9 },

    // ── PAGE 3 · Section 07 — Notice of Filing & Posting ──────────────────
    // Posting Start Date (cal: y≈358)
    { page: 3, x: 57,  y: 358, text: postStart, size: 9 },
    // Posting End Date (right column, same row, cal: y≈358)
    { page: 3, x: 315, y: 358, text: postEnd,   size: 9 },

    // ── PAGE 5 · Section 10 — Certification Date ──────────────────────────
    // Date line (cal: y≈302)
    { page: 5, x: 408, y: 302, text: today(), size: 9 },
  ];
}

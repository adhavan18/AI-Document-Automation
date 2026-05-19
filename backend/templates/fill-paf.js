// Field map for the H-1B Public Access File (PAF) template PDF.
// Field names must match the AcroForm fields in your PAF template PDF.
// Drop your template at backend/templates/forms/paf.pdf and restart —
// the server log will print every available field name on first generate.

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

export function buildPafFieldMap(matter) {
  const startDate  = matter.lcaCertified ?? '—';
  const endDate    = deriveValidityEnd(matter);
  const retainUntil = lca(matter.computed, 'Retain Until');

  // ── Field names must match the AcroForm fields in paf.pdf.
  // ── The server log prints every available name when the PDF is first loaded.
  return {
    // Employer / position
    'EmployerName':        matter.employer   ?? '—',
    'JobTitle':            matter.position   ?? '—',
    'Worksite':            matter.worksite   ?? '—',

    // LCA fields
    'SOCCode':             lca(matter.lca, 'Occupation Code (SOC)'),
    'WageRange':           lca(matter.lca, 'Wage Range'),
    'PrevailingWage':      lca(matter.lca, 'Prevailing Wage'),
    'LCAValidityStart':    startDate,
    'LCAValidityEnd':      endDate,
    'PostingStart':        lca(matter.lca, 'Posting Start'),
    'PostingEnd':          lca(matter.lca, 'Posting End'),
    'RetainUntil':         retainUntil,
  };
}

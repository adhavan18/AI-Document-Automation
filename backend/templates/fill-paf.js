// Coordinate placements for the saved Public Access File (PAF) PDF.
//
// pdf-lib origin = BOTTOM-LEFT, US Letter = 612 x 792 pt.
// STARTER coordinates — tune by hitting /api/uc2/matters/:id/generate
// with the calibration grid (see uc2.js), open the PDF, read the ruler,
// and adjust x / y / page below.

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

export function buildPafPlacements(matter) {
  const startDate   = matter.lcaCertified ?? '—';
  const endDate     = deriveValidityEnd(matter);
  const retainUntil = lca(matter.computed, 'Retain Until');

  // page = 0-based page index. x from left, y from bottom.
  return [
    { page: 0, x: 180, y: 640, text: matter.employer ?? '—', bold: true },
    { page: 0, x: 180, y: 612, text: matter.position ?? '—' },
    { page: 0, x: 180, y: 584, text: matter.worksite ?? '—' },

    { page: 1, x: 200, y: 660, text: lca(matter.lca, 'Occupation Code (SOC)') },
    { page: 1, x: 200, y: 632, text: lca(matter.lca, 'Wage Range') },
    { page: 1, x: 200, y: 604, text: lca(matter.lca, 'Prevailing Wage') },
    { page: 1, x: 200, y: 576, text: startDate },
    { page: 1, x: 200, y: 548, text: endDate },
    { page: 1, x: 200, y: 520, text: lca(matter.lca, 'Posting Start') },
    { page: 1, x: 200, y: 492, text: lca(matter.lca, 'Posting End') },
    { page: 1, x: 200, y: 464, text: retainUntil },
  ];
}

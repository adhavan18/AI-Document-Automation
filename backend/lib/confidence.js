// Confidence utilities — convert AI 0-100 scores to 0-1 unit scores,
// derive flagged/severity/note for display in the frontend.

export function toUnit(score) {
  return Math.round(Math.min(1, Math.max(0, Number(score) / 100)) * 100) / 100;
}

export function isFlagged(unit) {
  return unit < 0.75;
}

const BLOCKING_FIELDS = new Set([
  'Full Legal Name',
  'Date of Birth',
  'Passport Expiry',
  'Most Recent Entry Date',
]);

function normalize(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function severityFor(match, unit, field) {
  if (match) return undefined;
  if (BLOCKING_FIELDS.has(field)) return 'blocking';
  if (unit >= 0.9) return 'blocking';
  return 'minor';
}

export function noteFor({ field, extracted, questionnaire, severity }) {
  const normDoc = normalize(extracted);
  const normQ   = normalize(questionnaire);

  if (normDoc === normQ) {
    return 'Whitespace mismatch · likely same value';
  }
  if (normDoc.startsWith(normQ) || normQ.startsWith(normDoc)) {
    return `Abbreviation only · "${extracted}" vs "${questionnaire}"`;
  }
  if (severity === 'blocking') {
    return `Document shows "${extracted}" — questionnaire states "${questionnaire}". Resolve before save.`;
  }
  return `Value mismatch · "${extracted}" vs "${questionnaire}"`;
}

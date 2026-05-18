export const ConfidenceBadge = ({ score }) => {
  const pct = Math.round(score * 100);
  const tier = score >= 0.9 ? 'high' : score >= 0.75 ? 'med' : 'low';
  const styles = {
    high: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    med:  'bg-amber-50 text-amber-700 ring-amber-200',
    low:  'bg-rose-50 text-rose-700 ring-rose-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-medium tabular-nums ring-1 ring-inset ${styles[tier]}`}>
      <span className="w-1 h-1 rounded-full bg-current opacity-70" />
      {pct}%
    </span>
  );
};

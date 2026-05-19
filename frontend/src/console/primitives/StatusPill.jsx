export const StatusPill = ({ status }) => {
  const map = {
    'New':                'bg-slate-100 text-slate-700 ring-slate-200',
    'Pre-filled':         'bg-sky-50 text-sky-700 ring-sky-200',
    'Needs review':       'bg-amber-50 text-amber-800 ring-amber-200',
    'Verified':           'bg-emerald-50 text-emerald-700 ring-emerald-200',
    'Generated':          'bg-violet-50 text-violet-700 ring-violet-200',
    'Approved':           'bg-emerald-50 text-emerald-700 ring-emerald-200',
    'Ready to generate':  'bg-sky-50 text-sky-700 ring-sky-200',
    'Mismatches':         'bg-rose-50 text-rose-700 ring-rose-200',
    'Review':            'bg-emerald-50 text-emerald-700 ring-emerald-200',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${map[status] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
};

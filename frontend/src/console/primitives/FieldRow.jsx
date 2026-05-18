import { Flag } from 'lucide-react';
import { ConfidenceBadge } from './ConfidenceBadge.jsx';

export const FieldRow = ({ label, value, confidence, flagged, source }) => (
  <div className={`grid grid-cols-12 gap-3 py-2.5 px-2 -mx-2 rounded-md ${flagged ? 'bg-amber-50/60 ring-1 ring-amber-100' : 'hover:bg-slate-50'}`}>
    <div className="col-span-4 text-xs text-slate-500 font-medium pt-0.5">
      {label}
      {source && <div className="text-[10px] text-slate-400 mt-0.5 font-normal">src: {source}</div>}
    </div>
    <div className="col-span-6 text-sm text-slate-800 font-medium font-mono tracking-tight">
      {value}
    </div>
    <div className="col-span-2 flex items-center justify-end gap-1.5">
      {flagged && <Flag className="w-3 h-3 text-amber-600" />}
      {confidence !== undefined && <ConfidenceBadge score={confidence} />}
    </div>
  </div>
);

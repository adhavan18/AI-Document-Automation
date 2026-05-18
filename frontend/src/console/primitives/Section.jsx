export const Section = ({ title, subtitle, right, children }) => (
  <div className="bg-white border border-slate-200/80 rounded-lg overflow-hidden">
    <div className="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/40">
      <div>
        <div className="text-[11px] font-semibold text-slate-500 tracking-[0.08em] uppercase">
          {title}
        </div>
        {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
      </div>
      {right}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

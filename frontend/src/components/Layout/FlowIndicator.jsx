import useAppStore from '../../store/useAppStore.js';

const STEPS = [
  { key: 'generate', label: 'Generate' },
  { key: 'edit', label: 'Edit' },
  { key: 'captions', label: 'Captions' },
  { key: 'social', label: 'Social' },
  { key: 'publish', label: 'Publish' },
];

export default function FlowIndicator() {
  const activeTab = useAppStore(s => s.activeTab);
  const completedSteps = useAppStore(s => s.completedSteps);
  const setActiveTab = useAppStore(s => s.setActiveTab);

  return (
    <div className="flex items-center justify-center py-3 px-6 bg-white border-b border-gray-100">
      {STEPS.map((step, i) => {
        const isActive = step.key === activeTab;
        const isDone = completedSteps.includes(step.key);

        return (
          <div key={step.key} className="flex items-center">
            <button
              onClick={() => setActiveTab(step.key)}
              className="flex flex-col items-center gap-1 group"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all
                  ${isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/30'
                    : isDone
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                  }`}
              >
                {isDone && !isActive ? '✓' : i + 1}
              </div>
              <span
                className={`text-xs font-medium transition-colors
                  ${isActive ? 'text-primary' : isDone ? 'text-emerald-600' : 'text-gray-400'}`}
              >
                {step.label}
              </span>
            </button>

            {i < STEPS.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-2 mb-4 transition-colors
                  ${completedSteps.includes(step.key) ? 'bg-emerald-400' : 'bg-gray-200'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

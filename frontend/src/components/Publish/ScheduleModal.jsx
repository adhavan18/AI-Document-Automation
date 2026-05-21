import { useState } from 'react';
import { X, Calendar, Loader2 } from 'lucide-react';

export default function ScheduleModal({ onSchedule, onClose, loading }) {
  const [scheduledAt, setScheduledAt] = useState('');

  // Default to 1 hour from now
  const minDateTime = new Date(Date.now() + 60 * 1000).toISOString().slice(0, 16);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!scheduledAt) return;
    onSchedule(new Date(scheduledAt).toISOString());
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md fade-in-up">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Calendar size={18} className="text-primary" />
            Schedule Post
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Schedule for</label>
            <input
              type="datetime-local"
              required
              min={minDateTime}
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl py-2.5 text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !scheduledAt}
              className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition"
            >
              {loading ? <><Loader2 size={14} className="spin-slow" /> Scheduling…</> : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

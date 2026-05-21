import { useState } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { editorApi } from '../../api/editor.js';
import useAppStore from '../../store/useAppStore.js';

export default function PromptEditBar({ onImageUpdated }) {
  const selectedImage = useAppStore(s => s.getSelectedImage());
  const [editPrompt, setEditPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleApply = async () => {
    if (!editPrompt.trim() || !selectedImage) return;
    setError('');
    setLoading(true);
    try {
      const data = await editorApi.promptEdit(selectedImage.id, editPrompt.trim());
      onImageUpdated?.(data.image);
      setEditPrompt('');
    } catch (err) {
      setError(err.response?.data?.error || 'Edit failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Edit with AI prompt</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={editPrompt}
          onChange={e => setEditPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleApply()}
          placeholder='e.g. "Add a sunset sky background" or "Make it look more cinematic"'
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
        />
        <button
          onClick={handleApply}
          disabled={loading || !editPrompt.trim()}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-4 py-2.5 rounded-lg text-sm transition"
        >
          {loading ? <Loader2 size={14} className="spin-slow" /> : <Wand2 size={14} />}
          Apply
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5">
          {error}
        </p>
      )}
    </div>
  );
}

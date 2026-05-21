import { useState } from 'react';
import { Sparkles, Loader2, X, ImageOff } from 'lucide-react';
import { captionsApi } from '../../api/captions.js';
import useAppStore from '../../store/useAppStore.js';

const CHAR_LIMITS = { instagram: 2200, linkedin: 3000, default: 2200 };

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'default', label: 'General' },
];

const TONES = [
  { value: 'casual', label: 'Casual' },
  { value: 'professional', label: 'Professional' },
  { value: 'playful', label: 'Playful' },
  { value: 'inspirational', label: 'Inspirational' },
];

export default function CaptionsPanel() {
  const selectedImage = useAppStore(s => s.getSelectedImage());
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const caption = useAppStore(s => s.caption);
  const hashtags = useAppStore(s => s.hashtags);
  const captionPlatform = useAppStore(s => s.captionPlatform);
  const captionTone = useAppStore(s => s.captionTone);
  const setCaption = useAppStore(s => s.setCaption);
  const setHashtags = useAppStore(s => s.setHashtags);
  const setCaptionPlatform = useAppStore(s => s.setCaptionPlatform);
  const setCaptionTone = useAppStore(s => s.setCaptionTone);
  const markStepComplete = useAppStore(s => s.markStepComplete);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [newTag, setNewTag] = useState('');

  const charLimit = CHAR_LIMITS[captionPlatform] || CHAR_LIMITS.default;

  const handleGenerate = async () => {
    if (!selectedImage) return;
    setError('');
    setLoading(true);
    try {
      const data = await captionsApi.generateCaption(selectedImage.id, captionPlatform, captionTone);
      setCaption(data.caption);
      setHashtags(data.hashtags);
      markStepComplete('captions');
    } catch (err) {
      setError(err.response?.data?.error || 'Caption generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedImage) return;
    setSaving(true);
    setSaveMsg('');
    try {
      await captionsApi.updateCaption(selectedImage.id, caption, hashtags);
      setSaveMsg('Saved!');
      markStepComplete('captions');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (err) {
      setSaveMsg('Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const tag = newTag.trim().replace(/^#/, '');
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
    }
    setNewTag('');
  };

  const removeTag = (tag) => setHashtags(hashtags.filter(h => h !== tag));

  if (!selectedImage) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Captions & Hashtags</h2>
          <p className="text-gray-500 text-sm mt-1">Select an image first to generate captions.</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-16 flex flex-col items-center gap-4 text-gray-400">
          <ImageOff size={48} strokeWidth={1.2} />
          <p className="text-sm">No image selected</p>
          <button onClick={() => setActiveTab('generate')} className="text-sm text-primary hover:underline font-medium">
            Go to Generate →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Captions & Hashtags</h2>
        <p className="text-gray-500 text-sm mt-1">Generate and customise your post copy.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Controls */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Platform</label>
              <div className="flex gap-2 flex-wrap">
                {PLATFORMS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setCaptionPlatform(p.value)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition
                      ${captionPlatform === p.value
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary/50'
                      }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tone</label>
              <div className="flex gap-2 flex-wrap">
                {TONES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setCaptionTone(t.value)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition
                      ${captionTone === t.value
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary/50'
                      }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition"
            >
              {loading ? <><Loader2 size={14} className="spin-slow" /> Generating…</> : <><Sparkles size={14} /> Generate Captions</>}
            </button>
          </div>

          {/* Image preview */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <img
              src={`data:${selectedImage.mimeType || 'image/png'};base64,${selectedImage.base64}`}
              alt="Selected"
              className="w-full rounded-lg"
            />
          </div>
        </div>

        {/* Right: Output */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm font-medium text-gray-700">Caption</label>
              <span className={`text-xs ${caption.length > charLimit ? 'text-red-500' : 'text-gray-400'}`}>
                {caption.length} / {charLimit}
              </span>
            </div>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={5}
              placeholder="Generated caption will appear here…"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Hashtags</label>
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-8">
              {hashtags.map(tag => (
                <span key={tag} className="flex items-center gap-1 bg-violet-50 text-primary text-xs rounded-full px-2.5 py-1 border border-violet-200">
                  #{tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="Add hashtag…"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button onClick={addTag} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition">
                Add
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || (!caption && hashtags.length === 0)}
              className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm transition"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {saveMsg && <span className="text-xs text-emerald-600">{saveMsg}</span>}
          </div>

          <button
            onClick={() => { markStepComplete('captions'); setActiveTab('social'); }}
            className="w-full border border-gray-300 hover:border-primary text-gray-600 hover:text-primary font-medium py-2.5 rounded-xl text-sm transition"
          >
            Continue to Social →
          </button>
        </div>
      </div>
    </div>
  );
}

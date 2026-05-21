import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import ImageGrid from './ImageGrid.jsx';
import { generateApi } from '../../api/generate.js';
import useAppStore from '../../store/useAppStore.js';

export default function GeneratePanel() {
  const generatedImages = useAppStore(s => s.generatedImages);
  const isGenerating = useAppStore(s => s.isGenerating);
  const setGeneratedImages = useAppStore(s => s.setGeneratedImages);
  const addGeneratedImages = useAppStore(s => s.addGeneratedImages);
  const setIsGenerating = useAppStore(s => s.setIsGenerating);

  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(2);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('new'); // 'new' | 'add'

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setError('');
    setIsGenerating(true);
    try {
      const data = await generateApi.generateImages(prompt.trim(), count);
      if (mode === 'new') {
        setGeneratedImages(data.images);
      } else {
        addGeneratedImages(data.images);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Generation failed. Check your Gemini API key.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Generate Images</h2>
        <p className="text-gray-500 text-sm mt-1">
          Describe your product or concept — Gemini will generate ad images for you.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Prompt</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. A sleek red sports car on a mountain highway at golden hour, photorealistic ad style"
              rows={5}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition resize-none"
            />
          </div>

          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Number of images
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition border
                      ${count === n
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary/50'
                      }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {generatedImages.length > 0 && (
              <div className="pt-6">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mode</label>
                <select
                  value={mode}
                  onChange={e => setMode(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="new">Replace all</option>
                  <option value="add">Add to grid</option>
                </select>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="spin-slow" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate
              </>
            )}
          </button>

          {generatedImages.length > 0 && (
            <p className="text-xs text-gray-400 text-center">
              Click an image to select it, then proceed to Edit or Captions.
            </p>
          )}
        </div>

        {/* Right: Image grid */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Results {generatedImages.length > 0 && `(${generatedImages.length})`}
          </label>
          <div className="bg-white rounded-xl border border-gray-200 p-4 min-h-64">
            <ImageGrid images={generatedImages} />
          </div>
        </div>
      </div>
    </div>
  );
}

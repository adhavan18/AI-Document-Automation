import { useState } from 'react';
import { RefreshCw, CheckCircle } from 'lucide-react';
import { generateApi } from '../../api/generate.js';
import useAppStore from '../../store/useAppStore.js';

export default function ImageGrid({ images }) {
  const selectedImageId = useAppStore(s => s.selectedImageId);
  const setSelectedImageId = useAppStore(s => s.setSelectedImageId);
  const replaceImage = useAppStore(s => s.replaceImage);
  const markStepComplete = useAppStore(s => s.markStepComplete);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const [regenerating, setRegenerating] = useState(null);

  const handleSelect = (id) => {
    setSelectedImageId(id);
    markStepComplete('generate');
  };

  const handleRegenerate = async (img) => {
    setRegenerating(img.id);
    try {
      const data = await generateApi.regenerateImage(img.id, img.prompt);
      replaceImage(img.id, data.image);
    } catch (err) {
      console.error('Regenerate failed:', err);
    } finally {
      setRegenerating(null);
    }
  };

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-sm gap-2">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-3xl">🖼</div>
        <p>Your generated images will appear here</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {images.map(img => (
        <div
          key={img.id}
          className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer
            ${selectedImageId === img.id
              ? 'border-primary shadow-lg shadow-primary/20'
              : 'border-gray-200 hover:border-gray-300'
            }`}
          onClick={() => handleSelect(img.id)}
        >
          <img
            src={`data:${img.mimeType || 'image/png'};base64,${img.base64}`}
            alt={img.prompt}
            className="w-full aspect-square object-cover"
          />

          {selectedImageId === img.id && (
            <div className="absolute top-2 right-2">
              <CheckCircle className="text-primary bg-white rounded-full" size={22} />
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 flex justify-between items-end">
            <button
              onClick={(e) => { e.stopPropagation(); handleSelect(img.id); setActiveTab('edit'); }}
              className="text-xs text-white bg-white/20 hover:bg-white/30 backdrop-blur rounded-md px-2 py-1 transition"
            >
              Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleRegenerate(img); }}
              disabled={regenerating === img.id}
              className="text-xs text-white bg-white/20 hover:bg-white/30 backdrop-blur rounded-md px-2 py-1 transition flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw size={11} className={regenerating === img.id ? 'spin-slow' : ''} />
              Regen
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

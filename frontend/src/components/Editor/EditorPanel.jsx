import { ImageOff } from 'lucide-react';
import FabricCanvas from './FabricCanvas.jsx';
import PromptEditBar from './PromptEditBar.jsx';
import useAppStore from '../../store/useAppStore.js';

export default function EditorPanel() {
  const selectedImage = useAppStore(s => s.getSelectedImage());
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const replaceImage = useAppStore(s => s.replaceImage);
  const markStepComplete = useAppStore(s => s.markStepComplete);

  const handleImageUpdated = (newImage) => {
    replaceImage(newImage.id, newImage);
    markStepComplete('edit');
  };

  if (!selectedImage) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Edit Image</h2>
          <p className="text-gray-500 text-sm mt-1">Select an image first, then come back to edit it.</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-16 flex flex-col items-center gap-4 text-gray-400">
          <ImageOff size={48} strokeWidth={1.2} />
          <p className="text-sm">No image selected</p>
          <button
            onClick={() => setActiveTab('generate')}
            className="text-sm text-primary hover:underline font-medium"
          >
            Go to Generate →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Edit Image</h2>
        <p className="text-gray-500 text-sm mt-1">
          Use the canvas editor below, or describe changes in the AI prompt bar.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Canvas */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <FabricCanvas onImageUpdated={handleImageUpdated} />
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">AI Prompt Edit</h3>
            <PromptEditBar onImageUpdated={handleImageUpdated} />
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Current image</h3>
            <img
              src={`data:${selectedImage.mimeType || 'image/png'};base64,${selectedImage.base64}`}
              alt="Selected"
              className="w-full rounded-lg border border-gray-100"
            />
            <p className="text-xs text-gray-400 mt-2 truncate">{selectedImage.prompt}</p>
          </div>

          <button
            onClick={() => { markStepComplete('edit'); setActiveTab('captions'); }}
            className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-xl text-sm transition"
          >
            Continue to Captions →
          </button>
        </div>
      </div>
    </div>
  );
}

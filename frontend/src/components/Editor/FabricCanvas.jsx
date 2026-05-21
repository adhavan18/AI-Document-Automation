import { useEffect, useRef, useCallback, useState } from 'react';
import { Canvas, FabricImage, FabricText, filters as FabricFilters } from 'fabric';
import { Type, Brush, Trash2, Save, Loader2 } from 'lucide-react';
import { editorApi } from '../../api/editor.js';
import useAppStore from '../../store/useAppStore.js';

const CANVAS_SIZE = 600;

const FILTER_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'grayscale', label: 'Grayscale' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'brightness', label: 'Brighten' },
  { value: 'contrast', label: 'Contrast' },
  { value: 'blur', label: 'Blur' },
];

export default function FabricCanvas({ onImageUpdated }) {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const selectedImage = useAppStore(s => s.getSelectedImage());
  const [saving, setSaving] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Initialize / reinitialize canvas when selected image changes
  useEffect(() => {
    if (!canvasRef.current || !selectedImage) return;

    const canvas = new Canvas(canvasRef.current, {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      backgroundColor: '#f3f4f6',
    });
    fabricRef.current = canvas;

    FabricImage.fromURL(`data:${selectedImage.mimeType || 'image/png'};base64,${selectedImage.base64}`)
      .then(img => {
        const scale = Math.min(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
        img.set({ scaleX: scale, scaleY: scale, selectable: false, evented: false, left: 0, top: 0 });
        canvas.add(img);
        canvas.sendObjectToBack(img);
        canvas.renderAll();
      })
      .catch(err => console.error('[FabricCanvas] Failed to load image:', err));

    // Delete selected object on Backspace/Delete
    const handleKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement === document.body) {
        const obj = canvas.getActiveObject();
        if (obj && obj.selectable) {
          canvas.remove(obj);
          canvas.renderAll();
        }
      }
    };
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('keydown', handleKey);
      canvas.dispose();
    };
  }, [selectedImage?.id]);

  const addText = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const text = new FabricText('Your text here', {
      left: 50,
      top: 50,
      fontSize: 28,
      fill: '#ffffff',
      fontFamily: 'sans-serif',
      shadow: '2px 2px 6px rgba(0,0,0,0.8)',
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  }, []);

  const toggleDrawMode = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const next = !drawMode;
    canvas.isDrawingMode = next;
    if (next) {
      canvas.freeDrawingBrush.width = 4;
      canvas.freeDrawingBrush.color = '#ffffff';
    }
    setDrawMode(next);
  }, [drawMode]);

  const applyFilter = useCallback((filterName) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const img = canvas.getObjects('image')[0];
    if (!img) return;

    const filterMap = {
      grayscale: new FabricFilters.Grayscale(),
      sepia: new FabricFilters.Sepia(),
      brightness: new FabricFilters.Brightness({ brightness: 0.2 }),
      contrast: new FabricFilters.Contrast({ contrast: 0.2 }),
      blur: new FabricFilters.Blur({ blur: 0.1 }),
    };

    img.filters = filterName === 'none' ? [] : [filterMap[filterName]];
    img.applyFilters();
    canvas.renderAll();
  }, []);

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj && obj.selectable) {
      canvas.remove(obj);
      canvas.renderAll();
    }
  }, []);

  const handleSave = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas || !selectedImage) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const canvasData = canvas.toJSON();
      const dataURL = canvas.toDataURL({ format: 'png', multiplier: 1 });
      const base64 = dataURL.replace(/^data:image\/\w+;base64,/, '');
      const data = await editorApi.saveCanvas(selectedImage.id, canvasData, base64, 'image/png');
      onImageUpdated?.(data.image);
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (err) {
      setSaveMsg('Save failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  }, [selectedImage, onImageUpdated]);

  if (!selectedImage) return null;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={addText}
          className="flex items-center gap-1.5 text-xs bg-white border border-gray-300 hover:border-primary text-gray-700 rounded-lg px-3 py-2 transition"
        >
          <Type size={13} /> Add Text
        </button>

        <button
          onClick={toggleDrawMode}
          className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition
            ${drawMode
              ? 'bg-primary text-white border-primary'
              : 'bg-white border-gray-300 hover:border-primary text-gray-700'
            }`}
        >
          <Brush size={13} /> {drawMode ? 'Drawing (on)' : 'Draw'}
        </button>

        <select
          onChange={e => applyFilter(e.target.value)}
          defaultValue="none"
          className="text-xs bg-white border border-gray-300 hover:border-primary rounded-lg px-3 py-2 transition focus:outline-none"
        >
          {FILTER_OPTIONS.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <button
          onClick={deleteSelected}
          className="flex items-center gap-1.5 text-xs bg-white border border-gray-300 hover:border-red-400 text-gray-700 rounded-lg px-3 py-2 transition"
        >
          <Trash2 size={13} /> Delete
        </button>

        <div className="ml-auto flex items-center gap-2">
          {saveMsg && (
            <span className={`text-xs ${saveMsg.startsWith('Save failed') ? 'text-red-500' : 'text-emerald-600'}`}>
              {saveMsg}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-lg px-4 py-2 transition font-medium"
          >
            {saving ? <Loader2 size={13} className="spin-slow" /> : <Save size={13} />}
            Save Edit
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ width: CANVAS_SIZE, maxWidth: '100%' }}>
        <canvas ref={canvasRef} />
      </div>
      <p className="text-xs text-gray-400">Click objects to select. Press Delete/Backspace to remove.</p>
    </div>
  );
}

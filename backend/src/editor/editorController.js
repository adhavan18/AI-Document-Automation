import { editorService } from './editorService.js';
import { asyncWrap } from '../middleware/errorHandler.js';

export const promptEdit = asyncWrap(async (req, res) => {
  const { imageId, editPrompt } = req.body;
  if (!imageId || !editPrompt?.trim()) {
    return res.status(400).json({ error: 'imageId and editPrompt are required' });
  }
  const image = await editorService.promptEdit({
    userId: req.user.id,
    imageId,
    editPrompt: editPrompt.trim(),
  });
  res.json({ image });
});

export const saveCanvas = asyncWrap(async (req, res) => {
  const { imageId, canvasData, compositeBase64, mimeType } = req.body;
  if (!imageId || !compositeBase64) {
    return res.status(400).json({ error: 'imageId and compositeBase64 are required' });
  }
  const image = editorService.saveCanvasEdit({
    userId: req.user.id,
    imageId,
    canvasData,
    compositeBase64,
    mimeType,
  });
  res.json({ image });
});

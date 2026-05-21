import { generationService } from './generationService.js';
import { asyncWrap } from '../middleware/errorHandler.js';

export const generateImages = asyncWrap(async (req, res) => {
  const { prompt, count } = req.body;
  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  const images = await generationService.generateImages({
    userId: req.user.id,
    prompt: prompt.trim(),
    count,
  });
  res.status(201).json({ images });
});

export const regenerateImage = asyncWrap(async (req, res) => {
  const { imageId, prompt } = req.body;
  if (!imageId || !prompt?.trim()) {
    return res.status(400).json({ error: 'imageId and prompt are required' });
  }
  const image = await generationService.regenerateImage({
    userId: req.user.id,
    imageId,
    prompt: prompt.trim(),
  });
  res.json({ image });
});

export const getHistory = asyncWrap(async (req, res) => {
  const history = generationService.getHistory(req.user.id);
  res.json({ history });
});

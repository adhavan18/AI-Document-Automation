import { captionsService } from './captionsService.js';
import { asyncWrap } from '../middleware/errorHandler.js';

export const generateCaption = asyncWrap(async (req, res) => {
  const { imageId, platform, tone } = req.body;
  if (!imageId) {
    return res.status(400).json({ error: 'imageId is required' });
  }
  const result = await captionsService.generateCaption({
    userId: req.user.id,
    imageId,
    platform,
    tone,
  });
  res.json(result);
});

export const updateCaption = asyncWrap(async (req, res) => {
  const { imageId } = req.params;
  const { caption, hashtags } = req.body;
  if (!caption || !Array.isArray(hashtags)) {
    return res.status(400).json({ error: 'caption and hashtags array are required' });
  }
  const result = captionsService.updateCaption({
    userId: req.user.id,
    imageId,
    caption,
    hashtags,
  });
  res.json(result);
});

import { publishingService } from './publishingService.js';
import { asyncWrap } from '../middleware/errorHandler.js';

export const publishNow = asyncWrap(async (req, res) => {
  const { contentId, platforms, caption, hashtags } = req.body;
  if (!contentId || !Array.isArray(platforms) || platforms.length === 0) {
    return res.status(400).json({ error: 'contentId and platforms[] are required' });
  }
  const record = await publishingService.publishNow({
    userId: req.user.id,
    contentId,
    platforms,
    caption: caption || '',
    hashtags: hashtags || [],
  });
  res.json({ record });
});

export const schedulePost = asyncWrap(async (req, res) => {
  const { contentId, platforms, caption, hashtags, scheduledAt } = req.body;
  if (!contentId || !Array.isArray(platforms) || platforms.length === 0 || !scheduledAt) {
    return res.status(400).json({ error: 'contentId, platforms[], and scheduledAt are required' });
  }
  if (new Date(scheduledAt) <= new Date()) {
    return res.status(400).json({ error: 'scheduledAt must be in the future' });
  }
  const record = publishingService.schedulePost({
    userId: req.user.id,
    contentId,
    platforms,
    caption: caption || '',
    hashtags: hashtags || [],
    scheduledAt,
  });
  res.status(201).json({ record });
});

export const getScheduled = asyncWrap(async (req, res) => {
  const posts = publishingService.getScheduled(req.user.id);
  res.json({ posts });
});

export const cancelScheduled = asyncWrap(async (req, res) => {
  const { id } = req.params;
  const record = publishingService.cancelScheduled(req.user.id, id);
  res.json({ record });
});

export const getHistory = asyncWrap(async (req, res) => {
  const history = publishingService.getHistory(req.user.id);
  res.json({ history });
});

import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/index.js';
import { contentRepository } from '../repositories/contentRepository.js';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
const textModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const PLATFORM_GUIDANCE = {
  instagram: 'Instagram — casual, visual, personal tone; use 5–30 relevant hashtags; emojis encouraged.',
  linkedin: 'LinkedIn — professional, thought-leadership tone; 3–5 niche hashtags only; minimal emojis.',
  default: 'General social media; balanced professional-casual tone; 10–20 hashtags.',
};

const TONE_MODIFIERS = {
  casual: 'Write in a fun, relaxed, conversational tone.',
  professional: 'Write in a polished, authoritative, business-appropriate tone.',
  playful: 'Write in a witty, energetic, bold tone with creative wordplay.',
  inspirational: 'Write in an uplifting, motivational tone that inspires action.',
};

export const captionsService = {
  async generateCaption({ userId, imageId, platform = 'default', tone = 'casual' }) {
    const record = contentRepository.findById(imageId);
    if (!record || record.userId !== userId) {
      const err = new Error('Image not found');
      err.status = 404;
      throw err;
    }

    const platformGuide = PLATFORM_GUIDANCE[platform] || PLATFORM_GUIDANCE.default;
    const toneGuide = TONE_MODIFIERS[tone] || TONE_MODIFIERS.casual;

    const prompt = `You are a social media copywriter. Generate a post caption and hashtags for a marketing/advertisement image.

The image was created with this prompt: "${record.prompt}"

Platform guidelines: ${platformGuide}
Tone: ${toneGuide}

Respond ONLY with valid JSON, no markdown fences, no explanation:
{"caption":"<the post caption, 1-3 sentences>","hashtags":["<hashtag1>","<hashtag2>"],"characterCount":<number>}`;

    const result = await textModel.generateContent(prompt);
    const raw = result.response.text().trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    contentRepository.update(imageId, {
      caption: parsed.caption,
      hashtags: parsed.hashtags,
      captionPlatform: platform,
      captionTone: tone,
    });

    return { caption: parsed.caption, hashtags: parsed.hashtags, platform, tone };
  },

  updateCaption({ userId, imageId, caption, hashtags }) {
    const record = contentRepository.findById(imageId);
    if (!record || record.userId !== userId) {
      const err = new Error('Image not found');
      err.status = 404;
      throw err;
    }
    const updated = contentRepository.update(imageId, { caption, hashtags });
    return { caption: updated.caption, hashtags: updated.hashtags };
  },
};

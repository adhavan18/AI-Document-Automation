import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import { contentRepository } from '../repositories/contentRepository.js';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

function getImageModel() {
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash-preview-image-generation' });
}

export const generationService = {
  async generateImages({ userId, prompt, count = 4 }) {
    const safeCount = Math.min(Math.max(1, parseInt(count) || 1), 4);
    const model = getImageModel();

    const promises = Array.from({ length: safeCount }, () =>
      model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
      })
    );

    const responses = await Promise.allSettled(promises);
    const results = [];

    for (const res of responses) {
      if (res.status === 'rejected') {
        console.error('[generation] Image generation failed for one slot:', res.reason?.message);
        continue;
      }
      const candidate = res.value.response.candidates?.[0];
      if (!candidate) continue;
      const imagePart = candidate.content.parts.find(p => p.inlineData);
      if (!imagePart) continue;

      const record = contentRepository.create({
        id: uuidv4(),
        userId,
        prompt,
        base64: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || 'image/png',
      });
      results.push({
        id: record.id,
        base64: record.base64,
        mimeType: record.mimeType,
        prompt,
      });
    }

    if (results.length === 0) {
      const err = new Error('Image generation failed: no images returned from Gemini');
      err.status = 502;
      throw err;
    }
    return results;
  },

  async regenerateImage({ userId, imageId, prompt }) {
    const existing = contentRepository.findById(imageId);
    if (!existing || existing.userId !== userId) {
      const err = new Error('Image not found');
      err.status = 404;
      throw err;
    }
    const model = getImageModel();
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    });
    const imagePart = response.response.candidates?.[0]?.content.parts.find(p => p.inlineData);
    if (!imagePart) {
      const err = new Error('Regeneration failed: no image returned');
      err.status = 502;
      throw err;
    }
    const updated = contentRepository.update(imageId, {
      base64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
      prompt,
    });
    return { id: updated.id, base64: updated.base64, mimeType: updated.mimeType, prompt };
  },

  getHistory(userId) {
    return contentRepository.findByUserId(userId).map(r => ({
      id: r.id,
      prompt: r.prompt,
      mimeType: r.mimeType,
      caption: r.caption,
      hashtags: r.hashtags,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },
};

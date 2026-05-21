import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/index.js';
import { contentRepository } from '../repositories/contentRepository.js';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

export const editorService = {
  async promptEdit({ userId, imageId, editPrompt }) {
    const record = contentRepository.findById(imageId);
    if (!record || record.userId !== userId) {
      const err = new Error('Image not found');
      err.status = 404;
      throw err;
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-preview-image-generation' });

    const response = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: record.mimeType, data: record.base64 } },
          { text: editPrompt },
        ],
      }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    });

    const imagePart = response.response.candidates?.[0]?.content.parts.find(p => p.inlineData);
    if (!imagePart) {
      const err = new Error('Prompt edit failed: no image returned');
      err.status = 502;
      throw err;
    }

    const editHistoryEntry = {
      prompt: editPrompt,
      base64: record.base64,
      editedAt: new Date().toISOString(),
    };

    const updated = contentRepository.update(imageId, {
      base64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
      editHistory: [...(record.editHistory || []), editHistoryEntry],
    });

    return { id: updated.id, base64: updated.base64, mimeType: updated.mimeType };
  },

  saveCanvasEdit({ userId, imageId, canvasData, compositeBase64, mimeType }) {
    const record = contentRepository.findById(imageId);
    if (!record || record.userId !== userId) {
      const err = new Error('Image not found');
      err.status = 404;
      throw err;
    }

    const editHistoryEntry = {
      prompt: '[canvas edit]',
      base64: record.base64,
      editedAt: new Date().toISOString(),
    };

    const updated = contentRepository.update(imageId, {
      base64: compositeBase64,
      mimeType: mimeType || 'image/png',
      canvasData,
      editHistory: [...(record.editHistory || []), editHistoryEntry],
    });

    return { id: updated.id, base64: updated.base64, mimeType: updated.mimeType };
  },
};

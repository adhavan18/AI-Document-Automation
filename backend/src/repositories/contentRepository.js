import { v4 as uuidv4 } from 'uuid';

// In-memory store for generated/edited content records.
// Shape: { id, userId, prompt, base64, mimeType, editHistory[], caption,
//          hashtags, captionPlatform, captionTone, canvasData?, createdAt, updatedAt }
const items = new Map();

export const contentRepository = {
  findById(id) {
    return items.get(id) ?? null;
  },

  findByUserId(userId) {
    return [...items.values()].filter(i => i.userId === userId);
  },

  create(data) {
    const record = {
      ...data,
      id: data.id ?? uuidv4(),
      editHistory: data.editHistory ?? [],
      caption: data.caption ?? null,
      hashtags: data.hashtags ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    items.set(record.id, record);
    return record;
  },

  update(id, patch) {
    const existing = items.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    items.set(id, updated);
    return updated;
  },

  delete(id) {
    return items.delete(id);
  },

  findAll() {
    return [...items.values()];
  },
};

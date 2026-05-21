import { v4 as uuidv4 } from 'uuid';

// Two sub-stores in one file: social connections and publish records.
//
// Connection shape: { id, userId, platform, accountId, accountName,
//                     accessToken, refreshToken?, expiresAt, connectedAt }
//
// Publish record shape: { id, userId, contentId, platforms[], caption, hashtags,
//                         scheduledAt, status, result, createdAt, publishedAt? }
const connections = new Map();
const publishRecords = new Map();

export const publishRepository = {
  // --- Social connections ---

  findConnectionsByUserId(userId) {
    return [...connections.values()].filter(c => c.userId === userId);
  },

  findConnectionByUserAndPlatform(userId, platform) {
    return [...connections.values()].find(c => c.userId === userId && c.platform === platform) ?? null;
  },

  upsertConnection(data) {
    const existing = this.findConnectionByUserAndPlatform(data.userId, data.platform);
    const id = existing?.id ?? uuidv4();
    const record = {
      ...data,
      id,
      connectedAt: existing?.connectedAt ?? new Date().toISOString(),
    };
    connections.set(id, record);
    return record;
  },

  deleteConnection(userId, platform) {
    const conn = this.findConnectionByUserAndPlatform(userId, platform);
    if (!conn) return false;
    connections.delete(conn.id);
    return true;
  },

  // --- Publish records ---

  createPublishRecord(data) {
    const record = { ...data, id: uuidv4(), createdAt: new Date().toISOString() };
    publishRecords.set(record.id, record);
    return record;
  },

  findPublishRecordById(id) {
    return publishRecords.get(id) ?? null;
  },

  findScheduledByUserId(userId) {
    return [...publishRecords.values()].filter(
      r => r.userId === userId && r.status === 'pending' && r.scheduledAt
    );
  },

  findHistoryByUserId(userId) {
    return [...publishRecords.values()].filter(
      r => r.userId === userId && r.status !== 'pending'
    );
  },

  updatePublishRecord(id, patch) {
    const existing = publishRecords.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    publishRecords.set(id, updated);
    return updated;
  },

  findAllPublishRecords() {
    return [...publishRecords.values()];
  },
};

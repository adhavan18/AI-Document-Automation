import { publishRepository } from '../repositories/publishRepository.js';
import { contentRepository } from '../repositories/contentRepository.js';
import { instagram } from '../social/providers/instagram.js';
import { linkedin } from '../social/providers/linkedin.js';
import { schedulePost, cancelScheduledPost } from './scheduler.js';

async function executePublish(publishRecord) {
  const content = contentRepository.findById(publishRecord.contentId);
  if (!content) {
    publishRepository.updatePublishRecord(publishRecord.id, {
      status: 'failed',
      result: { error: 'Content not found' },
      publishedAt: new Date().toISOString(),
    });
    return;
  }

  const result = {};
  for (const platform of publishRecord.platforms) {
    const connection = publishRepository.findConnectionByUserAndPlatform(
      publishRecord.userId,
      platform
    );
    if (!connection) {
      result[platform] = { success: false, error: 'Account not connected' };
      continue;
    }

    try {
      if (platform === 'instagram') {
        const r = await instagram.publishPhoto({
          accessToken: connection.accessToken,
          userId: connection.accountId,
          caption: `${publishRecord.caption}\n${publishRecord.hashtags.map(h => `#${h}`).join(' ')}`,
        });
        result[platform] = { success: r.success, postId: r.postId, note: r.note };
      } else if (platform === 'linkedin') {
        const r = await linkedin.publishPost({
          accessToken: connection.accessToken,
          linkedinUserId: connection.accountId,
          caption: publishRecord.caption,
          hashtags: publishRecord.hashtags,
        });
        result[platform] = { success: r.success, postId: r.postId, note: r.note };
      } else {
        result[platform] = { success: false, error: `Platform ${platform} not supported` };
      }
    } catch (err) {
      result[platform] = { success: false, error: err.message };
    }
  }

  const allFailed = publishRecord.platforms.every(p => !result[p]?.success);
  publishRepository.updatePublishRecord(publishRecord.id, {
    status: allFailed ? 'failed' : 'published',
    result,
    publishedAt: new Date().toISOString(),
  });
}

export const publishingService = {
  async publishNow({ userId, contentId, platforms, caption, hashtags }) {
    const record = publishRepository.createPublishRecord({
      userId,
      contentId,
      platforms,
      caption,
      hashtags,
      scheduledAt: null,
      status: 'pending',
      result: {},
    });
    await executePublish(record);
    return publishRepository.findPublishRecordById(record.id);
  },

  schedulePost({ userId, contentId, platforms, caption, hashtags, scheduledAt }) {
    const record = publishRepository.createPublishRecord({
      userId,
      contentId,
      platforms,
      caption,
      hashtags,
      scheduledAt,
      status: 'pending',
      result: {},
    });
    schedulePost(record, executePublish);
    return record;
  },

  getScheduled(userId) {
    return publishRepository.findScheduledByUserId(userId);
  },

  cancelScheduled(userId, id) {
    const record = publishRepository.findPublishRecordById(id);
    if (!record || record.userId !== userId) {
      const err = new Error('Scheduled post not found');
      err.status = 404;
      throw err;
    }
    cancelScheduledPost(id);
    return publishRepository.updatePublishRecord(id, { status: 'cancelled' });
  },

  getHistory(userId) {
    return publishRepository.findHistoryByUserId(userId);
  },
};

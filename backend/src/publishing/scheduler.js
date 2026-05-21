// In-memory scheduler using setTimeout for precise one-shot post delivery.
// Limitation: all scheduled posts are lost on process restart.
// For production: replace with BullMQ + Redis — only this file needs to change.
const scheduledTimers = new Map(); // Map<publishRecordId, TimeoutHandle>

export function initScheduler() {
  console.log('[scheduler] In-memory scheduler started. Note: scheduled posts reset on restart.');
}

export function schedulePost(publishRecord, executeFn) {
  const scheduledAt = new Date(publishRecord.scheduledAt);
  const delay = scheduledAt.getTime() - Date.now();

  if (delay <= 0) {
    executeFn(publishRecord);
    return;
  }

  const timer = setTimeout(async () => {
    scheduledTimers.delete(publishRecord.id);
    await executeFn(publishRecord);
  }, delay);

  scheduledTimers.set(publishRecord.id, timer);
}

export function cancelScheduledPost(publishRecordId) {
  const timer = scheduledTimers.get(publishRecordId);
  if (!timer) return false;
  clearTimeout(timer);
  scheduledTimers.delete(publishRecordId);
  return true;
}

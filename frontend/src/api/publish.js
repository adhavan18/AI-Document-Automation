import client from './client.js';

export const publishApi = {
  publishNow: (data) => client.post('/publish/now', data).then(r => r.data),
  schedulePost: (data) => client.post('/publish/schedule', data).then(r => r.data),
  getScheduled: () => client.get('/publish/scheduled').then(r => r.data),
  cancelScheduled: (id) => client.delete(`/publish/scheduled/${id}`).then(r => r.data),
  getHistory: () => client.get('/publish/history').then(r => r.data),
};

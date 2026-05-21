import client from './client.js';

export const captionsApi = {
  generateCaption: (imageId, platform, tone) =>
    client.post('/captions/generate', { imageId, platform, tone }).then(r => r.data),
  updateCaption: (imageId, caption, hashtags) =>
    client.put(`/captions/${imageId}`, { caption, hashtags }).then(r => r.data),
};

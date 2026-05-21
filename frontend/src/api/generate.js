import client from './client.js';

export const generateApi = {
  generateImages: (prompt, count) =>
    client.post('/generate/images', { prompt, count }).then(r => r.data),
  regenerateImage: (imageId, prompt) =>
    client.post('/generate/regenerate', { imageId, prompt }).then(r => r.data),
  getHistory: () => client.get('/generate/history').then(r => r.data),
};

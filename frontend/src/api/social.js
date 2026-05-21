import client from './client.js';

export const socialApi = {
  getConnections: () => client.get('/social/connections').then(r => r.data),
  connectInstagram: () => { window.location.href = '/api/v1/social/instagram/auth'; },
  connectLinkedin: () => { window.location.href = '/api/v1/social/linkedin/auth'; },
  disconnectInstagram: () => client.delete('/social/instagram').then(r => r.data),
  disconnectLinkedin: () => client.delete('/social/linkedin').then(r => r.data),
};

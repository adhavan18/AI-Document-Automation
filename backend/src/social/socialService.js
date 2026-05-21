import { v4 as uuidv4 } from 'uuid';
import { instagram } from './providers/instagram.js';
import { linkedin } from './providers/linkedin.js';
import { publishRepository } from '../repositories/publishRepository.js';
import config from '../config/index.js';

// In-memory OAuth state store: state UUID → { userId, platform, createdAt }
const oauthStates = new Map();

function createState(userId, platform) {
  const state = uuidv4();
  oauthStates.set(state, { userId, platform, createdAt: Date.now() });
  return state;
}

function consumeState(state) {
  const entry = oauthStates.get(state);
  if (!entry) return null;
  oauthStates.delete(state);
  if (Date.now() - entry.createdAt > 10 * 60 * 1000) return null; // 10 min expiry
  return entry;
}

export const socialService = {
  getConnections(userId) {
    return publishRepository.findConnectionsByUserId(userId).map(c => ({
      platform: c.platform,
      accountId: c.accountId,
      accountName: c.accountName,
      connectedAt: c.connectedAt,
    }));
  },

  getInstagramAuthUrl(userId) {
    if (!config.instagram.appId) {
      const err = new Error('Instagram OAuth not configured. Set INSTAGRAM_APP_ID in .env');
      err.status = 503;
      throw err;
    }
    const state = createState(userId, 'instagram');
    return instagram.getAuthorizationUrl(state);
  },

  async handleInstagramCallback({ code, state }) {
    const stateData = consumeState(state);
    if (!stateData) {
      const err = new Error('Invalid or expired OAuth state');
      err.status = 400;
      throw err;
    }
    const tokenData = await instagram.exchangeCode(code);
    const longLived = await instagram.getLongLivedToken(tokenData.access_token);
    const accountInfo = await instagram.getAccountInfo(longLived.access_token, tokenData.user_id);

    publishRepository.upsertConnection({
      userId: stateData.userId,
      platform: 'instagram',
      accountId: String(tokenData.user_id),
      accountName: accountInfo.username || accountInfo.name || 'Instagram Account',
      accessToken: longLived.access_token,
      expiresAt: new Date(Date.now() + (longLived.expires_in || 5184000) * 1000).toISOString(),
    });

    return stateData.userId;
  },

  getLinkedinAuthUrl(userId) {
    if (!config.linkedin.clientId) {
      const err = new Error('LinkedIn OAuth not configured. Set LINKEDIN_CLIENT_ID in .env');
      err.status = 503;
      throw err;
    }
    const state = createState(userId, 'linkedin');
    return linkedin.getAuthorizationUrl(state);
  },

  async handleLinkedinCallback({ code, state }) {
    const stateData = consumeState(state);
    if (!stateData) {
      const err = new Error('Invalid or expired OAuth state');
      err.status = 400;
      throw err;
    }
    const tokenData = await linkedin.exchangeCode(code);
    const profile = await linkedin.getProfile(tokenData.access_token);

    publishRepository.upsertConnection({
      userId: stateData.userId,
      platform: 'linkedin',
      accountId: profile.sub,
      accountName: profile.name || profile.email || 'LinkedIn Account',
      accessToken: tokenData.access_token,
      expiresAt: new Date(Date.now() + (tokenData.expires_in || 5184000) * 1000).toISOString(),
    });

    return stateData.userId;
  },

  disconnectInstagram(userId) {
    return publishRepository.deleteConnection(userId, 'instagram');
  },

  disconnectLinkedin(userId) {
    return publishRepository.deleteConnection(userId, 'linkedin');
  },
};

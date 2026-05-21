import config from '../../config/index.js';

const INSTAGRAM_AUTH_URL = 'https://api.instagram.com/oauth/authorize';
const INSTAGRAM_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const GRAPH_BASE = 'https://graph.instagram.com';

export const instagram = {
  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: config.instagram.appId,
      redirect_uri: config.instagram.redirectUri,
      scope: 'instagram_basic,instagram_content_publish',
      response_type: 'code',
      state,
    });
    return `${INSTAGRAM_AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code) {
    const body = new URLSearchParams({
      client_id: config.instagram.appId,
      client_secret: config.instagram.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: config.instagram.redirectUri,
      code,
    });
    const res = await fetch(INSTAGRAM_TOKEN_URL, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Instagram token exchange failed: ${detail}`);
    }
    return await res.json();
  },

  async getLongLivedToken(shortLivedToken) {
    const params = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: config.instagram.appSecret,
      access_token: shortLivedToken,
    });
    const res = await fetch(`${GRAPH_BASE}/access_token?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to get long-lived Instagram token');
    return await res.json();
  },

  async getAccountInfo(accessToken, userId) {
    const params = new URLSearchParams({ fields: 'id,name,username', access_token: accessToken });
    const res = await fetch(`${GRAPH_BASE}/${userId}?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to get Instagram account info');
    return await res.json();
  },

  async publishPhoto({ accessToken, userId, caption }) {
    // Instagram Content Publishing API requires a publicly accessible image URL.
    // Base64 cannot be passed directly. For production: upload image to cloud storage
    // (S3/GCS), get a public URL, then use the 2-step container + publish flow.
    return {
      success: true,
      postId: `ig_stub_${Date.now()}`,
      note: 'Stub: wire up cloud storage to get a public image URL for production publishing.',
    };
  },
};

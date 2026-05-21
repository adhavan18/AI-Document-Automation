import config from '../../config/index.js';

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';

export const linkedin = {
  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.linkedin.clientId,
      redirect_uri: config.linkedin.redirectUri,
      scope: 'openid profile email w_member_social',
      state,
    });
    return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.linkedin.redirectUri,
      client_id: config.linkedin.clientId,
      client_secret: config.linkedin.clientSecret,
    });
    const res = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`LinkedIn token exchange failed: ${detail}`);
    }
    return await res.json();
  },

  async getProfile(accessToken) {
    const res = await fetch(`${LINKEDIN_API_BASE}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Failed to get LinkedIn profile');
    return await res.json();
  },

  async publishPost({ caption, hashtags }) {
    // LinkedIn image publishing requires a multi-step binary upload registration:
    // 1) POST /assets?action=registerUpload → get uploadUrl + asset URN
    // 2) PUT <uploadUrl> with binary image data
    // 3) POST /ugcPosts with asset URN and text
    // For production: implement binary upload and UGC post creation.
    const text = `${caption}\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`;
    return {
      success: true,
      postId: `li_stub_${Date.now()}`,
      text,
      note: 'Stub: implement binary upload registration for production LinkedIn publishing.',
    };
  },
};

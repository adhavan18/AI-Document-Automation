import 'dotenv/config';

export default {
  port: parseInt(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  auth: {
    mode: process.env.AUTH_MODE || 'local',
    jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_in_production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    mosaicApiUrl: process.env.MOSAIC_API_URL || '',
  },

  gemini: {
    apiKey: process.env.GOOGLE_GEMINI_API_KEY || '',
  },

  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim()),
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  instagram: {
    appId: process.env.INSTAGRAM_APP_ID || '',
    appSecret: process.env.INSTAGRAM_APP_SECRET || '',
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI || '',
  },

  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID || '',
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
    redirectUri: process.env.LINKEDIN_REDIRECT_URI || '',
  },
};

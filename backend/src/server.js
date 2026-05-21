import app from './app.js';
import config from './config/index.js';
import { initScheduler } from './publishing/scheduler.js';

const server = app.listen(config.port, () => {
  console.log(`[mosaic-manage] Backend running on http://localhost:${config.port}`);
  console.log(`[mosaic-manage] Auth mode: ${config.auth.mode}`);
  console.log(`[mosaic-manage] Gemini API key: ${config.gemini.apiKey ? 'set' : 'MISSING — set GOOGLE_GEMINI_API_KEY'}`);
  initScheduler();
});

export default server;

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const NEW_UI_DIR = path.resolve(__dirname, '../New_UI');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const API_BASE    = env.NOTICE_API_BASE || env.API_BASE || 'http://20.245.101.64:8000';
  const CLIENT_CODE = env.CLIENT_CODE || 'GCMNOTICEAI';
  const AGENT_KEY   = env.AGENT_KEY   || '';

  // API_BASE is '' so all /api calls go through Vite proxy (no CORS)
  const envConfigJs = `window.GIP_CONFIG = ${JSON.stringify({ API_BASE: '', CLIENT_CODE, AGENT_KEY })};`;

  return {
    plugins: [
      react(),
      {
        name: 'serve-new-ui',
        configureServer(server) {
          // Serve env-config.js with injected GIP_CONFIG
          server.middlewares.use('/env-config.js', (_req, res) => {
            res.setHeader('Content-Type', 'application/javascript');
            res.end(envConfigJs);
          });
          // Serve New_UI static files at the root so gip-login.html etc work at localhost:3003
          server.middlewares.use((req, res, next) => {
            const url = req.url.split('?')[0];
            // Only handle .html, .js (non-module), .png, .css from New_UI
            const candidates = [
              path.join(NEW_UI_DIR, url),
              path.join(NEW_UI_DIR, url.replace(/^\//, '')),
            ];
            for (const filePath of candidates) {
              if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const ext = path.extname(filePath).toLowerCase();
                const mime = {
                  '.html': 'text/html',
                  '.js':   'application/javascript',
                  '.css':  'text/css',
                  '.png':  'image/png',
                  '.jpg':  'image/jpeg',
                  '.svg':  'image/svg+xml',
                }[ext] || 'application/octet-stream';
                res.setHeader('Content-Type', mime);
                res.end(fs.readFileSync(filePath));
                return;
              }
            }
            next();
          });
        },
      },
    ],
    server: {
      port: 3003,
      proxy: {
        '/api': {
          target: API_BASE,
          changeOrigin: true,
        },
        '/legal': {
          target: 'http://localhost:8001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/legal/, ''),
          timeout: 300000,
          proxyTimeout: 300000,
        },
      },
    },
  };
});

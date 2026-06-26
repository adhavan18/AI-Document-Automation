import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const API_BASE    = env.NOTICE_API_BASE || env.API_BASE || 'http://20.245.101.64:8000';
  const CLIENT_CODE = env.CLIENT_CODE || 'GCMNOTICEAI';
  const AGENT_KEY   = env.AGENT_KEY   || '';

  const envConfigJs = `window.GIP_CONFIG = ${JSON.stringify({ API_BASE: '', CLIENT_CODE, AGENT_KEY })};`;

  return {
    plugins: [
      react(),
      {
        name: 'serve-env-config',
        configureServer(server) {
          server.middlewares.use('/env-config.js', (_req, res) => {
            res.setHeader('Content-Type', 'application/javascript');
            res.end(envConfigJs);
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

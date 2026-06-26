import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3003,
    proxy: {
      // Forward all /api calls to the V5 Notice AI server (avoids CORS preflight)
      '/api': {
        target: 'http://20.245.101.64:8000',
        changeOrigin: true,
      },
      // legal_processing FastAPI backend (Notice Processing)
      '/legal': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/legal/, ''),
        timeout: 300000,
        proxyTimeout: 300000,
      },
    },
  },
});

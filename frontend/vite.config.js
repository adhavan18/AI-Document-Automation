import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3003,
    proxy: {
      // legal_processing FastAPI backend (Notice Processing)
      '/legal': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/legal/, ''),
        timeout: 300000,
        proxyTimeout: 300000,
      },
      // existing Node backend
      '/api': 'http://localhost:3002',
    },
  },
});

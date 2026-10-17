import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// The dev server proxies /api to the local API (EF_API_PROXY overrides it, e.g. for end-to-end tests).
const apiTarget = process.env.EF_API_PROXY || 'http://localhost:7341';
const port = Number(process.env.EF_APP_PORT || 7342);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: true, port, strictPort: true, proxy: { '/api': { target: apiTarget, changeOrigin: true } } },
  preview: { host: true, port, strictPort: true, proxy: { '/api': { target: apiTarget, changeOrigin: true } } },
  build: { chunkSizeWarningLimit: 900 },
});

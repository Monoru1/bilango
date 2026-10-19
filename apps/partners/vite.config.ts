/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En développement, l'API (Fastify, port 8787) est jointe via un proxy : même origine, cookies httpOnly.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/v1': 'http://127.0.0.1:8787' } },
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'jsdom', css: false },
});

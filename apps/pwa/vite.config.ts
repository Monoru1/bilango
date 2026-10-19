/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, strictPort: true, proxy: { '/v1': 'http://127.0.0.1:8787' } },
  plugins: [react()],
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'jsdom', globals: false, css: false },
});

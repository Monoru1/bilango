import { spawn } from 'node:child_process';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', 'apps/pwa', '--config', 'apps/pwa/vite.config.ts', '--port', '5183', '--strictPort'], { stdio: 'inherit' });
const stopped = new Promise(resolve => server.once('exit', resolve));
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch('http://localhost:5183')).ok) { ready = true; break; } } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Built PWA preview failed to start');
  const test = spawn(process.execPath, ['e2e/install-smoke.mjs'], { stdio: 'inherit', env: process.env });
  const code = await new Promise((resolve, reject) => { test.once('error', reject); test.once('exit', resolve); });
  if (code !== 0) throw new Error(`Installation E2E failed (${code})`);
} finally { server.kill('SIGTERM'); await stopped; }

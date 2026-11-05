// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function worker() {
  const listeners = new Map<string, (e: Record<string, unknown>) => void>();
  const put = vi.fn().mockResolvedValue(undefined);
  const remove = vi.fn().mockResolvedValue(true);
  const fetch = vi.fn().mockResolvedValue(new Response('<html>SPA</html>', { headers: { 'content-type': 'text/html' } }));
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self: { addEventListener: (type: string, fn: (e: Record<string, unknown>) => void) => listeners.set(type, fn), location: { origin: 'https://app.test' }, clients: { claim: async () => undefined } },
    caches: { keys: async () => ['gobilan-shell-v1', 'another-app-cache', 'gobilan-shell-v2'], delete: remove, match: async () => undefined, open: async () => ({ put }) },
    fetch, URL, Response,
  });
  return { listeners, put, remove, fetch };
}
describe('service worker deployment safety', () => {
  it('never intercepts API or mutation requests', () => {
    const w = worker(); const respondWith = vi.fn();
    w.listeners.get('fetch')?.({ request: { url: 'https://app.test/v1/me', method: 'GET' }, respondWith });
    w.listeners.get('fetch')?.({ request: { url: 'https://app.test/report', method: 'POST' }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  });
  it('does not poison the asset cache with an HTML SPA fallback after deployment', async () => {
    const w = worker(); let response: Promise<Response> | undefined;
    w.listeners.get('fetch')?.({ request: { url: 'https://app.test/assets/removed.js', method: 'GET' }, respondWith: (p: Promise<Response>) => { response = p; } });
    await response;
    expect(w.fetch).toHaveBeenCalledOnce(); expect(w.put).not.toHaveBeenCalled();
  });
  it('removes only obsolete GoBilan caches', async () => {
    const w = worker(); let done: Promise<unknown> | undefined;
    w.listeners.get('activate')?.({ waitUntil: (p: Promise<unknown>) => { done = p; } });
    await done;
    expect(w.remove).toHaveBeenCalledExactlyOnceWith('gobilan-shell-v1');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from './http';

afterEach(() => vi.unstubAllGlobals());
describe('HTTP protocol failures', () => {
  it.each(['', 'null', '<!doctype html><html>SPA</html>', '[]', '"unexpected"'])('rejects invalid successful payload %j without leaking raw content', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    await expect(createClient()('/v1/me')).rejects.toMatchObject({ code: 'invalid_response', status: 502 });
  });
  it('preserves empty 204 mutation responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(createClient()('/v1/auth/logout', { method: 'POST' })).resolves.toBeNull();
  });
  it('preserves server authentication and retry metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { code: 'locked', message: 'Attendez', retryAfterSeconds: 300 } }, { status: 423 })));
    await expect(createClient()('/v1/auth/pin/login')).rejects.toMatchObject({ code: 'locked', status: 423, retryAfterSeconds: 300 });
  });
});

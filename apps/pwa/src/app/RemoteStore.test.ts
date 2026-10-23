import { describe, expect, it, vi } from 'vitest';
import { ApiError, type createClient } from '@gobilan/ui';
import { RemoteStore } from './RemoteStore';
import { emptyContent } from '@gobilan/domain';

const user = { id: 'u1', name: 'Awa', phone: '+2290197000001', country: 'BJ' as const };
const device = () => ({ deviceId: 'installation-test', label: 'Test' });
function setup() {
  const api = vi.fn<ReturnType<typeof createClient>>().mockImplementation(async (path) => {
    if (path === '/v1/me') return { user };
    if (path === '/v1/businesses') return { businesses: [] };
    if (path === '/v1/me/invitations') return { invitations: [] };
    return {};
  });
  return { api, store: new RemoteStore(api as ReturnType<typeof createClient>, device) };
}
describe('HTTP PWA store', () => {
  it('starts empty and restores only server state, never demo personas', async () => {
    const { store } = setup();
    expect(store.state.businesses).toEqual([]); expect(store.user).toBeNull();
    await store.initialize(); expect(store.user).toEqual(user); expect(store.state.users).toEqual([user]);
  });
  it('keeps PIN proof in memory and sends same installation across OTP and PIN', async () => {
    const { store, api } = setup();
    api.mockImplementation(async (path) => path.endsWith('/verify') ? { kind: 'pin_required', proof: 'one-time-proof' } : path === '/v1/me' ? { user } : path === '/v1/businesses' ? { businesses: [] } : { invitations: [] });
    expect((await store.startOtp('BJ', '0197000001')).ok).toBe(true);
    expect((await store.verifyOtp('4321')).ok).toBe(true);
    expect((await store.createPin('9876')).ok).toBe(true);
    expect(api).toHaveBeenCalledWith('/v1/auth/pin/create', { method: 'POST', body: { pin: '9876', otpProof: 'one-time-proof', device: device() } });
    expect((await store.createPin('9876')).ok).toBe(false);
  });
  it('retains a submission id across lost responses, avoiding duplicate reports', async () => {
    const { store, api } = setup();
    let tries = 0;
    api.mockImplementation(async (path) => {
      if (path.endsWith('/reports')) { if (++tries === 1) throw new ApiError('network', 'Réseau coupé', 0); return { id: 'r1' }; }
      if (path === '/v1/me') return { user };
      if (path === '/v1/businesses') return { businesses: [] };
      return { invitations: [] };
    });
    expect((await store.submitReport('b1', emptyContent(), 100)).ok).toBe(false);
    expect((await store.submitReport('b1', emptyContent(), 100)).ok).toBe(true);
    const posts = api.mock.calls.filter(([p]) => p.endsWith('/reports'));
    expect(posts[0]?.[1]?.body).toEqual(posts[1]?.[1]?.body);
  });
  it('purges financial data when session expires', async () => {
    const { store, api } = setup(); await store.initialize();
    api.mockRejectedValue(new ApiError('unauthenticated', 'Session expirée', 401));
    await store.refresh(); expect(store.user).toBeNull(); expect(store.state.reports).toEqual([]);
  });
  it('reports offline failure without local fake data and supports retry', async () => {
    const { store, api } = setup();
    api.mockRejectedValueOnce(new ApiError('network', 'Connexion impossible', 0));
    await store.initialize(); expect(store.error).toBe('Connexion impossible'); expect(store.user).toBeNull();
    await store.refresh(); expect(store.user?.id).toBe(user.id); expect(store.error).toBeNull();
  });
  it('preserves lock delay supplied by server and does not trigger an OTP', async () => {
    const { store, api } = setup(); api.mockRejectedValue(new ApiError('locked', 'Attendez', 423, 300));
    expect(await store.loginPin(user.phone, '1234')).toMatchObject({ ok: false, locked: true, retryAfterMs: 300000 });
    expect(api).toHaveBeenCalledTimes(1);
  });
});

describe('Web Push (PWA, §9.3)', () => {
  const sub = { endpoint: 'https://push.example/abc', keys: { p256dh: 'p'.repeat(20), auth: 'a'.repeat(10) } };
  function pushSetup(over: Partial<Record<string, unknown>> = {}) {
    const state = { perm: 'default' as 'default' | 'granted' | 'denied' | 'unsupported', ...over };
    const bp = {
      permission: vi.fn(() => state.perm),
      request: vi.fn(async () => { state.perm = (over.answer as 'granted' | 'denied') ?? 'granted'; return state.perm; }),
      subscribe: vi.fn(async () => sub),
      unsubscribe: vi.fn(async () => sub.endpoint as string | null),
    };
    const api = vi.fn().mockImplementation(async (path: string) => {
      if (path === '/v1/push/config') return { enabled: over.enabled ?? true, publicKey: (over.enabled ?? true) ? 'BPUBLIC' : null };
      if (path === '/v1/me') return { user };
      if (path === '/v1/businesses') return { businesses: [] };
      if (path === '/v1/me/invitations') return { invitations: [] };
      return {};
    });
    return { bp, api, store: new RemoteStore(api as unknown as ReturnType<typeof createClient>, device, bp) };
  }
  it('asks permission, subscribes with the server VAPID key and registers the subscription', async () => {
    const { store, bp, api } = pushSetup();
    expect(await store.enablePush()).toBe('enabled');
    expect(bp.request).toHaveBeenCalledOnce();
    expect(bp.subscribe).toHaveBeenCalledWith('BPUBLIC');
    expect(api).toHaveBeenCalledWith('/v1/push/subscriptions', { method: 'POST', body: sub });
  });
  it('never asks permission nor subscribes when the server has no VAPID key (nothing is promised)', async () => {
    const { store, bp, api } = pushSetup({ enabled: false });
    expect(await store.enablePush()).toBe('unconfigured');
    expect(bp.request).not.toHaveBeenCalled(); expect(bp.subscribe).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalledWith('/v1/push/subscriptions', expect.anything());
  });
  it('respects a refusal and an unsupported browser without any server call', async () => {
    const denied = pushSetup({ perm: 'denied' });
    expect(await denied.store.enablePush()).toBe('denied'); expect(denied.api).not.toHaveBeenCalled();
    const unsupported = pushSetup({ perm: 'unsupported' });
    expect(await unsupported.store.enablePush()).toBe('unsupported'); expect(unsupported.api).not.toHaveBeenCalled();
  });
  it('reports a user refusal at the prompt without subscribing', async () => {
    const { store, bp } = pushSetup({ answer: 'denied' });
    expect(await store.enablePush()).toBe('denied'); expect(bp.subscribe).not.toHaveBeenCalled();
  });
  it('turns any failure into "failed" instead of throwing', async () => {
    const { store, bp } = pushSetup({ perm: 'granted' });
    bp.subscribe.mockRejectedValueOnce(new Error('boom'));
    expect(await store.enablePush()).toBe('failed');
  });
  it('resyncs silently only when permission is already granted and a session exists; never prompts', async () => {
    const asked = pushSetup(); await asked.store.resyncPush();
    expect(asked.bp.request).not.toHaveBeenCalled(); expect(asked.api).not.toHaveBeenCalled();
    const granted = pushSetup({ perm: 'granted' });
    await granted.store.resyncPush(); expect(granted.bp.subscribe).not.toHaveBeenCalled(); // pas de session
    await granted.store.initialize(); await granted.store.resyncPush();
    expect(granted.bp.subscribe).toHaveBeenCalledOnce(); expect(granted.bp.request).not.toHaveBeenCalled();
  });
  it('unsubscribes the browser then tells the server which endpoint to revoke', async () => {
    const { store, api } = pushSetup({ perm: 'granted' });
    await store.disablePush();
    expect(api).toHaveBeenCalledWith('/v1/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } });
  });
});

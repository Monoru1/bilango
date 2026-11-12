import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { demoEnabled, store } from './app/useStore';

vi.mock('./lib/env', () => ({ currentEnv: () => ({ standalone: false, platform: 'android', iosSafari: false, inAppBrowser: null }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); sessionStorage.clear(); });
describe('public browser installation gate', () => {
  it.each(['/?demo=1', '/b/private-business/bilan?demo=1', '/invitations', '/legal'])('never initializes an API session on %s', async path => {
    window.history.replaceState({}, '', path);
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<App />);
    if (path === '/legal') await screen.findByRole('heading', { name: /Mentions légales/i, level: 1 });
    else await screen.findByRole('button', { name: 'Installer l’application' });
    expect(fetch).not.toHaveBeenCalled();
    expect(store.mode).toBe('api');
    expect(screen.queryByText('Faire le bilan du jour')).toBeNull();
  });
  it('ignores both the demo query and a persisted demo flag in a public build', () => {
    vi.stubEnv('VITE_ALLOW_DEMO_BYPASS', '');
    window.history.replaceState({}, '', '/?demo=1');
    sessionStorage.setItem('gb-demo', '1');
    expect(demoEnabled()).toBe(false);
  });
});

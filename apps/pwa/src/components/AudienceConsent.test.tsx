import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AudienceConsent } from './AudienceConsent';

const android = { standalone: false, platform: 'android', iosSafari: false, inAppBrowser: null } as const;

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('mesure le signal Android et la première ouverture installée après accord', async () => {
  vi.stubEnv('VITE_AUDIENCE_ENABLED', 'true');
  const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', send);
  const kinds = () => send.mock.calls.map(([, request]) => JSON.parse(request?.body as string).kind);
  const view = render(<AudienceConsent env={android} />);
  fireEvent(window, new Event('appinstalled'));
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Autoriser la mesure' }));
  fireEvent(window, new Event('appinstalled'));
  await waitFor(() => expect(kinds()).toEqual(['visit', 'android_install']));
  view.rerender(<AudienceConsent env={{ ...android, standalone: true }} />);
  await waitFor(() => expect(kinds()).toEqual(['visit', 'android_install', 'first_open']));
});

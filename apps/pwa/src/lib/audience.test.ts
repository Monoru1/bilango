import { afterEach, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { audienceRegistration, setAudienceConsent, trackAudience } from './audience';

const env = { standalone: false, platform: 'android', iosSafari: false, inAppBrowser: null } as const;

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  history.replaceState(null, '', '/');
});

it('attend le consentement, filtre les paramètres de campagne et permet le retrait', async () => {
  vi.stubEnv('VITE_AUDIENCE_ENABLED', 'true');
  const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', send);
  history.replaceState(null, '', '/?utm_source=whatsapp&ref=ABCD1234&email=private');
  trackAudience('visit', env);
  expect(audienceRegistration()).toBeUndefined();
  expect(send).not.toHaveBeenCalled();

  setAudienceConsent(true);
  trackAudience('visit', env);
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  const request = send.mock.calls[0]![1]!;
  const body = JSON.parse(request.body as string);
  expect(body).toMatchObject({ kind: 'visit', source: 'whatsapp', referral: 'ABCD1234' });
  expect(request.credentials).toBe('omit');
  expect(request.body).not.toContain('private');
  expect(audienceRegistration()?.visitor).toBe(body.visitor);

  setAudienceConsent(false);
  trackAudience('install_click', env);
  await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  expect(send.mock.calls[1]![1]).toMatchObject({ method: 'DELETE', body: JSON.stringify({ visitor: body.visitor }) });
  expect(audienceRegistration()).toBeUndefined();
});

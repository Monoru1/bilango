import { audienceSource, DAY_MS } from '@gobilan/domain';
import type { AudienceEvent } from '@gobilan/contracts';
import { currentEnv, type Env } from './env';

const CONSENT = 'gb-audience-consent';
const VISITOR = 'gb-audience-visitor';
const SESSION = 'gb-audience-session';
const ERASE = 'gb-audience-erase';
const SESSION_MS = 30 * 60_000;
let delivery = Promise.resolve();

export function audienceAvailable() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return import.meta.env.VITE_AUDIENCE_ENABLED === 'true' &&
    !nav.globalPrivacyControl && nav.doNotTrack !== '1' &&
    !new URLSearchParams(location.search).has('demo');
}

export function audienceConsent() {
  try { return localStorage.getItem(CONSENT); } catch { return null; }
}

function deliver(method: 'POST' | 'DELETE', body: object) {
  delivery = delivery.then(async () => {
    const response = await fetch('/v1/audience/events', {
      method, body: JSON.stringify(body), credentials: 'omit', keepalive: true,
      headers: { 'content-type': 'application/json', 'x-gobilan-csrf': '1' },
    });
    if (method === 'DELETE' && response.ok) localStorage.removeItem(ERASE);
  }).catch(() => undefined);
}

export function retryAudienceDeletion() {
  try {
    const pending = localStorage.getItem(ERASE);
    if (pending) deliver('DELETE', { visitor: pending });
  } catch { /* Storage is unavailable. */ }
}

export function setAudienceConsent(enabled: boolean) {
  try {
    localStorage.setItem(CONSENT, enabled ? 'yes' : 'no');
    if (enabled) return;
    const visitor = JSON.parse(localStorage.getItem(VISITOR) ?? 'null')?.id as string | undefined;
    if (visitor) localStorage.setItem(ERASE, visitor);
    localStorage.removeItem(VISITOR);
    sessionStorage.removeItem(SESSION);
    retryAudienceDeletion();
  } catch { /* No identifier is created when storage is unavailable. */ }
}

function context(platform: Env['platform']) {
  if (!audienceAvailable() || audienceConsent() !== 'yes') return undefined;
  try {
    const now = Date.now();
    let visitor = JSON.parse(localStorage.getItem(VISITOR) ?? 'null') as { id: string; started: number } | null;
    if (!visitor || now - visitor.started >= 90 * DAY_MS) {
      visitor = { id: crypto.randomUUID(), started: now };
      localStorage.setItem(VISITOR, JSON.stringify(visitor));
    }
    return { id: crypto.randomUUID(), visitor: visitor.id, platform };
  } catch { return undefined; }
}

export function audienceRegistration() {
  return audienceAvailable() ? context(currentEnv().platform) : undefined;
}

export function trackAudience(kind: Exclude<AudienceEvent['kind'], 'registration'>, env: Env) {
  const identifiers = context(env.platform);
  if (!identifiers) return;
  if (kind !== 'visit') {
    deliver('POST', { ...identifiers, kind });
    return;
  }

  try {
    const now = Date.now();
    const previous = JSON.parse(sessionStorage.getItem(SESSION) ?? 'null') as { id: string; at: number } | null;
    const session = previous && now - previous.at < SESSION_MS ? previous.id : crypto.randomUUID();
    sessionStorage.setItem(SESSION, JSON.stringify({ id: session, at: now }));
    const params = new URLSearchParams(location.search);
    const referral = params.get('ref')?.toUpperCase();
    const source = audienceSource(params.get('utm_source')?.toLowerCase() ?? null, document.referrer, env.inAppBrowser);
    deliver('POST', { ...identifiers, kind, session, source, ...(/^[A-Z0-9]{4,20}$/.test(referral ?? '') ? { referral } : {}) });
  } catch { /* No collection if browser storage is unavailable. */ }
}

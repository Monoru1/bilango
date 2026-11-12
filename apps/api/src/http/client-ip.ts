import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

const PROOF = /^v1;(\d{10});([\da-fA-F:.]{1,45});([\da-f]{64})$/;
const MAX_AGE_SECONDS = 60;
const MAX_CLOCK_SKEW_SECONDS = 5;

export function normalizeClientIp(value: string): string | null {
  const version = isIP(value);
  if (version === 4) return value;
  if (version !== 6 || value.includes('%')) return null;
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([\da-f]{1,4}):([\da-f]{1,4})$/.exec(canonical);
  if (!mapped) return canonical;
  const high = Number.parseInt(mapped[1]!, 16);
  const low = Number.parseInt(mapped[2]!, 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join('.');
}

export function verifiedClientIp(
  proof: string | string[] | undefined, secret: string, method: string, url: string, now: number,
): string | null {
  if (typeof proof !== 'string') return null;
  const match = PROOF.exec(proof);
  if (!match) return null;
  const [, issuedAt, rawIp, signature] = match;
  const age = Math.floor(now / 1000) - Number(issuedAt);
  if (age > MAX_AGE_SECONDS || age < -MAX_CLOCK_SKEW_SECONDS) return null;
  const payload = ['v1', issuedAt, method, url, rawIp].join('\n');
  const expected = createHmac('sha256', secret).update(payload).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature!, 'hex'))) return null;
  return normalizeClientIp(rawIp!);
}

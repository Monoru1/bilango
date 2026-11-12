import { describe, expect, it } from 'vitest';
import { signFedapayWebhook, verifyFedapaySignature } from '../src/crypto';

const raw = '{"id":"fixture"}';
const secret = 'test-only-signing-secret';
const timestamp = 1700000000;
const valid = signFedapayWebhook(raw, secret, timestamp);
const verify = (header: string) => verifyFedapaySignature(raw, header, secret, timestamp * 1000);

describe('strict FedaPay signature grammar', () => {
  it('accepts a valid signature, optional whitespace and key rotation', () => {
    expect(verify(valid)).toBe(true);
    expect(verify(valid.replace(',s=', ', s='))).toBe(true);
    expect(verify(`${valid},s=${'0'.repeat(64)}`)).toBe(true);
  });

  it('rejects ambiguous or partially parsed timestamps and signatures', () => {
    for (const header of [
      valid.replace(`t=${timestamp}`, `t=${timestamp}junk`),
      valid.replace(`t=${timestamp}`, `t=${timestamp}.5`),
      valid.replace(`t=${timestamp}`, `t=${timestamp}=extra`),
      `${valid},t=${timestamp}`,
      `${valid}junk`,
      `${valid}=extra`,
      valid.slice(0, -1),
    ]) expect(verify(header), header).toBe(false);
  });

  it('rejects modified bodies and timestamps outside the replay window', () => {
    expect(verifyFedapaySignature(raw + ' ', valid, secret, timestamp * 1000)).toBe(false);
    expect(verifyFedapaySignature(raw, valid, secret, (timestamp + 301) * 1000)).toBe(false);
    expect(verifyFedapaySignature(raw, valid, secret, (timestamp - 301) * 1000)).toBe(false);
  });
});

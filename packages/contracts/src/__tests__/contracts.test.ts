import { describe, expect, it } from 'vitest';
import { createPinSchema, loginPinSchema, requestOtpSchema, submitReportSchema, payoutBlockSchema, createBusinessSchema } from '../index';

const device = { deviceId: 'device-12345678' };

describe('contrats : validation stricte des entrées', () => {
  it('refuse un PIN qui n\'est pas à 4 chiffres', () => {
    for (const pin of ['123', '12345', 'abcd', '12a4']) {
      expect(loginPinSchema.safeParse({ phone: '+2290197000001', pin, device }).success).toBe(false);
    }
    expect(loginPinSchema.safeParse({ phone: '+2290197000001', pin: '0420', device }).success).toBe(true);
  });
  it('exige le CAPTCHA pour demander un OTP', () => {
    const base = { country: 'BJ', phone: '0197000001', purpose: 'signup', device };
    expect(requestOtpSchema.safeParse(base).success).toBe(false);
    expect(requestOtpSchema.safeParse({ ...base, captchaToken: 'tok' }).success).toBe(true);
  });
  it('refuse un pays hors Bénin, Côte d\'Ivoire, Togo', () => {
    expect(createBusinessSchema.safeParse({ name: 'X', country: 'FR', sector: 'other' }).success).toBe(false);
  });
  it('refuse les montants non entiers ou négatifs dans un bilan', () => {
    const ok = { total: 100, lines: [] };
    const base = { content: { revenue: ok, expenses: ok, cashIn: ok, stockSales: [], note: '' }, clientRequestId: 'req-12345678' };
    expect(submitReportSchema.safeParse(base).success).toBe(true);
    expect(submitReportSchema.safeParse({ ...base, content: { ...base.content, revenue: { total: 10.5, lines: [] } } }).success).toBe(false);
    expect(submitReportSchema.safeParse({ ...base, content: { ...base.content, expenses: { total: -1, lines: [] } } }).success).toBe(false);
  });
  it('ne laisse pas le client choisir la date du bilan', () => {
    const ok = { total: 0, lines: [] };
    const parsed = submitReportSchema.parse({
      content: { revenue: ok, expenses: ok, cashIn: ok }, clientRequestId: 'req-12345678', day: '2020-01-01', submittedAt: '2020-01-01T00:00:00Z',
    });
    expect('day' in parsed).toBe(false);
    expect('submittedAt' in parsed).toBe(false);
  });
  it('limite le bloc Paiement à un numéro, un réseau et un nom', () => {
    expect(payoutBlockSchema.safeParse({ phone: '+2290197000001', network: 'MTN', displayName: 'Koffi A.' }).success).toBe(true);
    expect(payoutBlockSchema.safeParse({ phone: '+2290197000001', network: 'PayPal', displayName: 'Koffi A.' }).success).toBe(false);
  });
  it('exige une preuve OTP pour créer un PIN', () => {
    expect(createPinSchema.safeParse({ pin: '0420', device }).success).toBe(false);
  });
});

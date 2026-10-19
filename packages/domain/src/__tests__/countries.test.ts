import { describe, expect, it } from 'vitest';
import { countryOfPhone, normalizePhone } from '../countries';
import { formatPhone, maskPhone } from '../money';

describe('numéros par pays (§4.1)', () => {
  it('normalise le Bénin (10 chiffres en 01)', () => {
    expect(normalizePhone('BJ', '01 97 00 00 01')).toBe('+2290197000001');
    expect(normalizePhone('BJ', '+229 01 97 00 00 01')).toBe('+2290197000001');
    expect(normalizePhone('BJ', '00229 0197000001')).toBe('+2290197000001');
    expect(normalizePhone('BJ', '0197')).toBeNull();
    expect(normalizePhone('BJ', '0297000001')).toBeNull();
  });
  it("normalise la Côte d'Ivoire (10 chiffres) et le Togo (8 chiffres)", () => {
    expect(normalizePhone('CI', '07 00 00 00 01')).toBe('+2250700000001');
    expect(normalizePhone('TG', '90 00 00 01')).toBe('+22890000001');
    expect(normalizePhone('TG', '900000011')).toBeNull();
  });
  it('refuse les lettres et les caractères parasites', () => {
    expect(normalizePhone('BJ', '01 97 00 00 0a')).toBeNull();
    expect(normalizePhone('CI', '')).toBeNull();
  });
  it('retrouve le pays depuis un E.164', () => {
    expect(countryOfPhone('+22890000001')).toBe('TG');
    expect(countryOfPhone('+33123456789')).toBeNull();
  });
  it('formate et masque', () => {
    expect(formatPhone('+2290197000001')).toBe('+229 01 97 00 00 01');
    expect(maskPhone('+2290197000001')).toBe('+229 ••• 01');
  });
});

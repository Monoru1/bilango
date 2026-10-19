import { describe, expect, it } from 'vitest';
import {
  addMonthsUtc,
  agentPromoCode,
  AGREEMENT_VERSION,
  computeCommissions,
  isSelfReferralSuspect,
  RATE_CARDS,
  referralDaysLeft,
  referralStatus,
  reversalOf,
  type CommissionContext,
  type ConfirmedPayment,
  type Referral,
} from '../commissions';
import { DAY_MS } from '../dates';

const REG = '2026-10-01T10:00:00.000Z';
const regMs = Date.parse(REG);
const at = (days: number) => new Date(regMs + days * DAY_MS).toISOString();

function referral(over: Partial<Referral> = {}): Referral {
  return {
    id: 'ref1',
    businessId: 'biz1',
    partnerId: 'agent1',
    partnerRole: 'agent',
    managerId: 'mgr1',
    registeredAt: REG,
    rates: RATE_CARDS,
    agreementVersion: AGREEMENT_VERSION,
    excludedReason: null,
    ...over,
  };
}
const pay = (id: string, days: number): ConfirmedPayment => ({ id, businessId: 'biz1', confirmedAt: at(days), amount: 2000 });
const first: CommissionContext = { priorCommissionedPayments: 0, firstPaymentAt: null, renewedWhileEntitled: true };
const renewal = (n: number, firstAt: string): CommissionContext => ({ priorCommissionedPayments: n, firstPaymentAt: firstAt, renewedWhileEntitled: true });

describe('barème fixé par l\'accord (§10.8)', () => {
  it('reprend exactement les montants du cahier', () => {
    expect(RATE_CARDS).toEqual({
      agent: { first: 1000, renewal: 500 },
      manager: { first: 800, renewal: 500 },
      influencer: { first: 1800, renewal: 1000 },
    });
  });
});

describe('premier paiement', () => {
  it('agent avec manager : 1 000 F à l\'agent et 800 F au manager', () => {
    const r = computeCommissions(referral(), pay('p1', 8), first);
    expect(r.skipped).toBeNull();
    expect(r.lines.map((l) => [l.role, l.partnerId, l.amount, l.paymentIndex])).toEqual([
      ['agent', 'agent1', 1000, 1],
      ['manager', 'mgr1', 800, 1],
    ]);
  });

  it('agent sans manager : une seule ligne', () => {
    const r = computeCommissions(referral({ managerId: null }), pay('p1', 8), first);
    expect(r.lines).toHaveLength(1);
  });

  it('influenceur : 1 800 F et rien pour un manager', () => {
    const r = computeCommissions(referral({ partnerRole: 'influencer', partnerId: 'inf1', managerId: null }), pay('p1', 8), first);
    expect(r.lines.map((l) => [l.role, l.amount])).toEqual([['influencer', 1800]]);
  });

  it('refuse un paiement au-delà des 30 jours suivant l\'inscription', () => {
    expect(computeCommissions(referral(), pay('p1', 30), first).skipped).toBeNull();
    const late = computeCommissions(referral(), pay('p1', 31), first);
    expect(late.skipped).toBe('window_expired');
    expect(late.lines).toEqual([]);
  });

  it('ne verse rien pour un parrainage exclu (auto-parrainage, famille…)', () => {
    expect(computeCommissions(referral({ excludedReason: 'auto-parrainage' }), pay('p1', 8), first).skipped).toBe('excluded');
  });

  it('produit une clé d\'idempotence stable par paiement et rôle', () => {
    const a = computeCommissions(referral(), pay('p1', 8), first).lines.map((l) => l.key);
    const b = computeCommissions(referral(), pay('p1', 8), first).lines.map((l) => l.key);
    expect(a).toEqual(['p1:agent', 'p1:manager']);
    expect(b).toEqual(a);
  });
});

describe('renouvellements', () => {
  const firstAt = at(8);
  it('500 F agent et 500 F manager', () => {
    const r = computeCommissions(referral(), pay('p2', 38), renewal(1, firstAt));
    expect(r.lines.map((l) => [l.role, l.amount, l.paymentIndex])).toEqual([
      ['agent', 500, 2],
      ['manager', 500, 2],
    ]);
  });
  it('influenceur : 1 000 F par renouvellement', () => {
    const inf = referral({ partnerRole: 'influencer', partnerId: 'inf1', managerId: null });
    expect(computeCommissions(inf, pay('p2', 38), renewal(1, firstAt)).lines[0]?.amount).toBe(1000);
  });
  it('plafonne à 12 paiements commissionnés', () => {
    expect(computeCommissions(referral(), pay('p12', 330), renewal(11, firstAt)).skipped).toBeNull();
    expect(computeCommissions(referral(), pay('p13', 360), renewal(12, firstAt)).skipped).toBe('cap_reached');
  });
  it('plafonne à 12 mois à partir du premier paiement', () => {
    expect(computeCommissions(referral(), pay('px', 8 + 400), renewal(5, firstAt)).skipped).toBe('cap_reached');
  });
  it('rompt la chaîne si le client revient après blocage (D-004)', () => {
    const ctx: CommissionContext = { ...renewal(2, firstAt), renewedWhileEntitled: false };
    expect(computeCommissions(referral(), pay('p3', 90), ctx).skipped).toBe('chain_broken');
  });
  it('utilise les montants figés au parrainage, pas ceux d\'un nouvel accord', () => {
    const frozen = referral({
      rates: { ...RATE_CARDS, agent: { first: 700, renewal: 300 } },
      managerId: null,
    });
    expect(computeCommissions(frozen, pay('p1', 8), first).lines[0]?.amount).toBe(700);
    expect(computeCommissions(frozen, pay('p2', 38), renewal(1, firstAt)).lines[0]?.amount).toBe(300);
  });
});

describe('annulation (§13.4)', () => {
  it('crée une ligne négative sans toucher à l\'originale', () => {
    const [line] = computeCommissions(referral(), pay('p1', 8), first).lines;
    const entry = {
      key: line!.key, partnerId: line!.partnerId, role: line!.role, referralId: line!.referralId,
      amount: line!.amount, payoutDate: '2026-10-15', confirmedAt: line!.confirmedAt, reverses: null,
    };
    const rev = reversalOf(entry, 'refund', at(10), '2026-11-01');
    expect(rev.amount).toBe(-1000);
    expect(rev.reverses).toBe(entry.key);
    expect(rev.key).not.toBe(entry.key);
    expect(entry.amount).toBe(1000);
  });
});

describe('statut du parrainage (§10.6)', () => {
  it('Payé, En essai, Expiré et jours restants', () => {
    const r = referral();
    expect(referralStatus(r, true, regMs + 90 * DAY_MS)).toBe('paid');
    expect(referralStatus(r, false, regMs + 5 * DAY_MS)).toBe('trial');
    expect(referralStatus(r, false, regMs + 31 * DAY_MS)).toBe('expired');
    expect(referralDaysLeft(r, false, regMs + 5 * DAY_MS)).toBe(25);
    expect(referralDaysLeft(r, false, regMs + 40 * DAY_MS)).toBe(0);
  });
});

describe('outils', () => {
  it('ajoute des mois calendaires sans déborder', () => {
    expect(new Date(addMonthsUtc('2026-01-31T00:00:00.000Z', 1)).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(new Date(addMonthsUtc('2026-10-08T10:00:00.000Z', 12)).toISOString()).toBe('2027-10-08T10:00:00.000Z');
  });
  it('compose le code promo agent [PRÉNOM][CODE PAYS]', () => {
    expect(agentPromoCode('Koffi', '+225')).toBe('KOFFI225');
    expect(agentPromoCode('Aïssatou', '+229')).toBe('AISSATOU229');
  });
  it('signale un indice d\'auto-parrainage sans exclure automatiquement', () => {
    expect(isSelfReferralSuspect('+2290197000001', '+2290197000001')).toBe(true);
    expect(isSelfReferralSuspect(null, '+2290197000001')).toBe(false);
  });
});

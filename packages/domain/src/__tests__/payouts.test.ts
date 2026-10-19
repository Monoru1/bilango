import { describe, expect, it } from 'vitest';
import type { LedgerEntry } from '../commissions';
import { computePayoutBalances, netOfFees, nextPayoutDate, payoutDateFor, PAYOUT_THRESHOLD_FCFA } from '../payouts';

describe('calendrier de versement (§10.9)', () => {
  it('du 1er au 14 -> le 15 du même mois', () => {
    expect(payoutDateFor('2026-10-01T10:00:00.000Z')).toBe('2026-10-15');
    expect(payoutDateFor('2026-10-14T10:00:00.000Z')).toBe('2026-10-15');
  });
  it('du 15 au dernier jour -> le 1er du mois suivant', () => {
    expect(payoutDateFor('2026-10-15T10:00:00.000Z')).toBe('2026-11-01');
    expect(payoutDateFor('2026-10-31T10:00:00.000Z')).toBe('2026-11-01');
  });
  it("passe l'année en décembre", () => {
    expect(payoutDateFor('2026-12-20T10:00:00.000Z')).toBe('2027-01-01');
  });
  it('lit le jour dans le fuseau de Cotonou : 23h30 UTC le 14 est déjà le 15', () => {
    expect(payoutDateFor('2026-10-14T23:30:00.000Z')).toBe('2026-11-01');
    expect(payoutDateFor('2026-10-14T22:30:00.000Z')).toBe('2026-10-15');
  });
  it('trouve la prochaine date de versement', () => {
    expect(nextPayoutDate('2026-10-02')).toBe('2026-10-15');
    expect(nextPayoutDate('2026-10-15')).toBe('2026-10-15');
    expect(nextPayoutDate('2026-10-16')).toBe('2026-11-01');
  });
});

const entry = (key: string, partnerId: string, amount: number, payoutDate: string): LedgerEntry => ({
  key, partnerId, role: 'agent', referralId: 'r', amount, payoutDate, confirmedAt: '2026-10-01T00:00:00.000Z', reverses: null,
});

describe('soldes et seuil (§10.9)', () => {
  it('exige 2 000 F cumulés', () => {
    expect(PAYOUT_THRESHOLD_FCFA).toBe(2000);
    const b = computePayoutBalances([entry('a', 'p1', 1000, '2026-10-15'), entry('b', 'p1', 500, '2026-10-15')], new Set(), '2026-10-15');
    expect(b[0]).toMatchObject({ gross: 1500, payable: false, carriedOver: 1500 });
  });
  it('reporte le solde au cycle suivant puis le verse une fois le seuil atteint', () => {
    const entries = [entry('a', 'p1', 1500, '2026-10-15'), entry('b', 'p1', 500, '2026-11-01')];
    expect(computePayoutBalances(entries, new Set(), '2026-10-15')[0]?.payable).toBe(false);
    const nov = computePayoutBalances(entries, new Set(), '2026-11-01')[0];
    expect(nov).toMatchObject({ gross: 2000, payable: true, carriedOver: 0 });
    expect(nov?.entryKeys.sort()).toEqual(['a', 'b']);
  });
  it('ignore les lignes futures et celles déjà versées', () => {
    const entries = [entry('a', 'p1', 2000, '2026-10-15'), entry('b', 'p1', 2000, '2026-11-01')];
    expect(computePayoutBalances(entries, new Set(['a']), '2026-10-15')).toEqual([]);
  });
  it('déduit une annulation postérieure au versement des versements suivants', () => {
    const entries = [entry('c', 'p1', 2500, '2026-11-01'), entry('rev', 'p1', -1000, '2026-11-01')];
    expect(computePayoutBalances(entries, new Set(), '2026-11-01')[0]).toMatchObject({ gross: 1500, payable: false });
  });
  it("ne verse jamais un solde négatif", () => {
    const b = computePayoutBalances([entry('rev', 'p1', -1000, '2026-11-01')], new Set(), '2026-11-01')[0];
    expect(b).toMatchObject({ gross: -1000, payable: false, carriedOver: -1000 });
  });
  it('sépare les partenaires', () => {
    const b = computePayoutBalances([entry('a', 'p1', 2000, '2026-10-15'), entry('b', 'p2', 600, '2026-10-15')], new Set(), '2026-10-15');
    expect(b.map((x) => [x.partnerId, x.payable])).toEqual([['p1', true], ['p2', false]]);
  });
});

describe('frais de transaction (§10.10)', () => {
  it('net = brut − frais', () => {
    expect(netOfFees(5000, 150)).toEqual({ gross: 5000, fees: 150, net: 4850 });
  });
  it('refuse les montants incohérents', () => {
    expect(() => netOfFees(1000, 1500)).toThrow(RangeError);
    expect(() => netOfFees(1000.5, 0)).toThrow(RangeError);
    expect(() => netOfFees(-1, 0)).toThrow(RangeError);
  });
});

import { describe, expect, it } from 'vitest';
import { calculateAdminMetrics, metricsUtcBounds } from '../metrics';

const from = '2026-11-09', to = '2026-11-10';
const { start, end } = metricsUtcBounds(from, to);
const now = Date.parse('2026-11-19T12:00:00Z');
const empty = { from, to, now, accounts: [], businesses: [], subscriptionDates: [], revenue: [], commissions: [] };
const account = (createdAt: number, referred = false, firstPaymentAt: Date | null = null) =>
  ({ createdAt: new Date(createdAt), referred, firstPaymentAt });

describe('métriques admin', () => {
  it('inclut les bornes UTC du début et du dernier jour, exclut minuit suivant', () => {
    const data = calculateAdminMetrics({ ...empty, accounts: [
      account(start - 1), account(start, true, new Date(start + 24 * 3600_000)), account(end - 1), account(end),
    ] });
    expect(data.acquisition).toEqual({ accounts: 2, referredAccounts: 1 });
    expect(data.conversion.averageDaysToFirstPayment).toBe(1);
    expect(new Date(end).toISOString()).toBe('2026-11-11T00:00:00.000Z');
  });

  it('compte les 48 heures incluses et groupe un essai impayé par semaine du compte', () => {
    const business = {
      createdAt: new Date(start), ownerCreatedAt: new Date('2026-11-08T23:30:00Z'),
      trialEndsAt: new Date('2026-11-16T00:00:00Z'), firstInviteAt: new Date(start),
      firstReportAt: new Date(start + 48 * 3600_000), firstPaymentAt: null,
    };
    const data = calculateAdminMetrics({ ...empty, businesses: [business, {
      ...business, firstReportAt: new Date(start + 48 * 3600_000 + 1), firstPaymentAt: new Date(start + 3600_000),
    }] });
    expect(data.activation).toEqual({ businesses: 2, firstInvite: 2, firstReportWithin48h: 1, ratePercent: 50 });
    expect(data.conversion).toMatchObject({ trialsStarted: 2, trialsConverted: 1,
      expiredUnpaidBySignupWeek: [{ week: '2026-11-02', count: 1 }] });
  });

  it('garde les taux indéfinis pour une période vide et regroupe les jours restants sans détail individuel', () => {
    const data = calculateAdminMetrics({ ...empty, subscriptionDates: [
      { paidUntil: null, trialEndsAt: '2026-11-21T00:00:00Z' },
      { paidUntil: '2026-11-18T00:00:00Z', trialEndsAt: null },
    ] });
    expect(data.activation.ratePercent).toBeNull();
    expect(data.conversion.averageDaysToFirstPayment).toBeNull();
    expect(data.subscriptions).toEqual({ active: 0, grace: 1, blocked: 0, trial: 1, trialByDaysRemaining: [{ days: 2, count: 1 }] });
  });
});

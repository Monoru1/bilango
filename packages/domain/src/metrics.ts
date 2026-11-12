import { DAY_MS, HOUR_MS, toDayKey } from './dates';
import { daysRemaining, subscriptionStatus } from './subscription';
import type { CountryCode } from './countries';
import type { PartnerRole } from './commissions';
import type { Subscription } from './types';

export function metricsUtcBounds(from: string, to: string) {
  return { start: Date.parse(from + 'T00:00:00Z'), end: Date.parse(to + 'T00:00:00Z') + DAY_MS };
}

interface AccountMetric {
  createdAt: Date;
  referred: boolean;
  firstPaymentAt: Date | null;
}

interface BusinessMetric {
  createdAt: Date;
  ownerCreatedAt: Date;
  trialEndsAt: Date | null;
  firstInviteAt: Date | null;
  firstReportAt: Date | null;
  firstPaymentAt: Date | null;
}

type SubscriptionDates = Pick<Subscription, 'trialEndsAt' | 'paidUntil'>;
type CommissionMetric = { role: PartnerRole; due: number; paid: number };

export function calculateAdminMetrics(input: {
  from: string; to: string; now: number;
  accounts: AccountMetric[];
  businesses: BusinessMetric[];
  subscriptionDates: SubscriptionDates[];
  revenue: { country: CountryCode; amount: number }[];
  commissions: CommissionMetric[];
}) {
  const { start, end } = metricsUtcBounds(input.from, input.to);
  const endOfPeriod = Math.min(end, input.now + 1);
  const inPeriod = (date: Date) => date.getTime() >= start && date.getTime() < endOfPeriod;
  const accounts = input.accounts.filter(account => inPeriod(account.createdAt));
  const businesses = input.businesses.filter(business => inPeriod(business.createdAt));
  const trialsByWeek = new Map<string, number>();
  let firstInvite = 0, activated = 0, trialsStarted = 0, trialsConverted = 0;
  for (const business of businesses) {
    const createdAt = business.createdAt.getTime();
    if (business.firstInviteAt && business.firstInviteAt.getTime() >= createdAt && business.firstInviteAt.getTime() <= input.now) firstInvite++;
    if (business.firstReportAt) {
      const elapsed = business.firstReportAt.getTime() - createdAt;
      if (elapsed >= 0 && elapsed <= 48 * HOUR_MS && business.firstReportAt.getTime() <= input.now) activated++;
    }
    if (!business.trialEndsAt) continue;
    trialsStarted++;
    if (business.firstPaymentAt && business.firstPaymentAt.getTime() >= createdAt && business.firstPaymentAt.getTime() <= input.now) {
      trialsConverted++;
    } else if (business.trialEndsAt.getTime() <= input.now) {
      const ownerCreatedAt = business.ownerCreatedAt.getTime();
      const weekday = new Date(ownerCreatedAt).getUTCDay();
      const week = toDayKey(ownerCreatedAt - ((weekday + 6) % 7) * DAY_MS, 0);
      trialsByWeek.set(week, (trialsByWeek.get(week) ?? 0) + 1);
    }
  }

  const daysToPay = accounts.flatMap(account => {
    const paidAt = account.firstPaymentAt?.getTime();
    return paidAt !== undefined && paidAt >= account.createdAt.getTime() && paidAt <= input.now
      ? [(paidAt - account.createdAt.getTime()) / DAY_MS] : [];
  });
  const states = { trial: 0, active: 0, grace: 0, blocked: 0 };
  const trialDays = new Map<number, number>();
  for (const sub of input.subscriptionDates) {
    const status = subscriptionStatus(sub, input.now);
    states[status]++;
    if (status === 'trial') {
      const days = daysRemaining(sub, input.now);
      trialDays.set(days, (trialDays.get(days) ?? 0) + 1);
    }
  }
  const revenueByCountry: Record<CountryCode, number> = { BJ: 0, CI: 0, TG: 0 };
  for (const row of input.revenue) revenueByCountry[row.country] += row.amount;
  const commissions: Record<PartnerRole, { due: number; paid: number }> = {
    agent: { due: 0, paid: 0 }, manager: { due: 0, paid: 0 }, influencer: { due: 0, paid: 0 },
  };
  for (const row of input.commissions) {
    commissions[row.role].due += row.due;
    commissions[row.role].paid += row.paid;
  }

  return {
    period: { from: input.from, to: input.to },
    asOf: new Date(input.now).toISOString(),
    acquisition: { accounts: accounts.length, referredAccounts: accounts.filter(account => account.referred).length },
    activation: { businesses: businesses.length, firstInvite, firstReportWithin48h: activated,
      ratePercent: businesses.length ? Math.round(10000 * activated / businesses.length) / 100 : null },
    conversion: {
      trialsStarted, trialsConverted,
      expiredUnpaidBySignupWeek: [...trialsByWeek].sort(([a], [b]) => a.localeCompare(b)).map(([week, count]) => ({ week, count })),
      averageDaysToFirstPayment: daysToPay.length ? Math.round(daysToPay.reduce((sum, days) => sum + days, 0) * 100 / daysToPay.length) / 100 : null,
    },
    subscriptions: { ...states, trialByDaysRemaining: [...trialDays].sort(([a], [b]) => a - b).map(([days, count]) => ({ days, count })) },
    revenueByCountry,
    commissions,
  };
}

export type AdminMetrics = ReturnType<typeof calculateAdminMetrics>;

export function adminMetricsRows(metrics: AdminMetrics): [string, string, string | number][] {
  const { acquisition, activation, conversion, subscriptions } = metrics;
  return [
    ['Période UTC', 'Début', metrics.period.from], ['Période UTC', 'Fin incluse', metrics.period.to],
    ['Période UTC', 'Calculé le', metrics.asOf],
    ['Acquisition', 'Comptes créés', acquisition.accounts],
    ['Acquisition', 'Comptes parrainés', acquisition.referredAccounts],
    ['Activation', 'Business créés', activation.businesses],
    ['Activation', 'Première invitation employé', activation.firstInvite],
    ['Activation', 'Premier bilan dans les 48 h', activation.firstReportWithin48h],
    ['Activation', 'Taux (%)', activation.ratePercent ?? '—'],
    ['Conversion', 'Essais démarrés', conversion.trialsStarted],
    ['Conversion', 'Essais convertis', conversion.trialsConverted],
    ['Conversion', 'Délai moyen au premier paiement (jours)', conversion.averageDaysToFirstPayment ?? '—'],
    ...conversion.expiredUnpaidBySignupWeek.map(({ week, count }): [string, string, number] => ['Essais terminés sans paiement', week, count]),
    ['Abonnements actuels', 'Essais en cours', subscriptions.trial],
    ['Abonnements actuels', 'Actifs', subscriptions.active],
    ['Abonnements actuels', 'En grâce', subscriptions.grace],
    ['Abonnements actuels', 'Bloqués', subscriptions.blocked],
    ...subscriptions.trialByDaysRemaining.map(({ days, count }): [string, string, number] => ['Essais en cours par jours restants', String(days), count]),
    ...Object.entries(metrics.revenueByCountry).map(([country, amount]): [string, string, number] => ['Revenus confirmés (FCFA)', country, amount]),
    ...Object.entries(metrics.commissions).flatMap(([role, { due, paid }]): [string, string, number][] => [
      ['Commissions dues à date (FCFA)', role, due], ['Commissions versées sur la période (FCFA)', role, paid],
    ]),
  ];
}

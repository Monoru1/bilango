import { DAY_MS } from './dates';
import type { Subscription, SubscriptionStatus } from './types';

export const SUBSCRIPTION_PRICE_FCFA = 2000;
export const SUBSCRIPTION_DAYS = 30;

/** Statut dérivé de l'état et de l'heure courante (cahier §6.4). Lecture seule dans l'app. */
export function subscriptionStatus(sub: Subscription, now: number): SubscriptionStatus {
  if (sub.paidUntil && Date.parse(sub.paidUntil) > now) return 'active';
  if (sub.trialEndsAt && Date.parse(sub.trialEndsAt) > now) return 'trial';
  return 'expired';
}

/** Date de fin à considérer : fin du paiement, sinon fin d'essai. */
export function subscriptionEnd(sub: Subscription): string | null {
  const ends = [sub.paidUntil, sub.trialEndsAt].filter((v): v is string => v !== null);
  if (ends.length === 0) return null;
  return ends.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
}

/** Jours restants (arrondi au supérieur), 0 si expiré. */
export function daysRemaining(sub: Subscription, now: number): number {
  const end = subscriptionEnd(sub);
  if (!end) return 0;
  return Math.max(0, Math.ceil((Date.parse(end) - now) / DAY_MS));
}

/**
 * Règle de prolongation côté serveur (documentée ici pour référence, jamais déclenchée
 * par l'app — cahier §2 et §9.5) : paiement avant expiration -> +30 jours à la date
 * d'expiration existante ; après expiration -> 30 jours à partir du paiement.
 */
export function extendedPaidUntil(sub: Pick<Subscription, 'paidUntil'>, paidAt: number): string {
  const current = sub.paidUntil ? Date.parse(sub.paidUntil) : 0;
  const base = current > paidAt ? current : paidAt;
  return new Date(base + SUBSCRIPTION_DAYS * DAY_MS).toISOString();
}

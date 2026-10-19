import { DAY_MS } from './dates';
import type { Subscription, SubscriptionStatus } from './types';

/** Cahier §8.1 : 2 000 FCFA par business et par période de 30 jours, essai de 7 jours. */
export const SUBSCRIPTION_PRICE_FCFA = 2000;
export const SUBSCRIPTION_DAYS = 30;
export const TRIAL_DAYS = 7;
/** Jours de grâce après expiration, accès complet (§8.3). Blocage dès le 4e jour. */
export const GRACE_DAYS = 3;
/** Pop-up d'expiration proche : chaque jour à partir de J-3 (§8.3). */
export const REMINDER_DAYS_BEFORE = 3;

/** Date de fin à considérer : la plus tardive entre fin de paiement et fin d'essai. */
export function subscriptionEnd(sub: Pick<Subscription, 'paidUntil' | 'trialEndsAt'>): string | null {
  const ends = [sub.paidUntil, sub.trialEndsAt].filter((v): v is string => v !== null);
  if (ends.length === 0) return null;
  return ends.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
}

export function trialEndsAtFrom(createdAt: number): string {
  return new Date(createdAt + TRIAL_DAYS * DAY_MS).toISOString();
}

/**
 * Statut dérivé de l'état et de l'heure courante (§8.3). Calcul fait côté serveur ; la PWA
 * ne fait que l'afficher. Un abonnement sans aucune date est considéré comme bloqué.
 */
export function subscriptionStatus(sub: Pick<Subscription, 'paidUntil' | 'trialEndsAt'>, now: number): SubscriptionStatus {
  const end = subscriptionEnd(sub);
  if (end === null) return 'blocked';
  const endMs = Date.parse(end);
  if (now < endMs) {
    return sub.paidUntil && Date.parse(sub.paidUntil) > now ? 'active' : 'trial';
  }
  return now - endMs < GRACE_DAYS * DAY_MS ? 'grace' : 'blocked';
}

/** Jours restants (arrondi au supérieur), 0 si expiré. */
export function daysRemaining(sub: Pick<Subscription, 'paidUntil' | 'trialEndsAt'>, now: number): number {
  const end = subscriptionEnd(sub);
  if (!end) return 0;
  return Math.max(0, Math.ceil((Date.parse(end) - now) / DAY_MS));
}

/** Rang du jour de grâce (1 à 3) ou 0 hors période de grâce. */
export function graceDay(sub: Pick<Subscription, 'paidUntil' | 'trialEndsAt'>, now: number): 0 | 1 | 2 | 3 {
  if (subscriptionStatus(sub, now) !== 'grace') return 0;
  const end = Date.parse(subscriptionEnd(sub) as string);
  return (Math.floor((now - end) / DAY_MS) + 1) as 1 | 2 | 3;
}

/**
 * Prolongation côté serveur, jamais déclenchée par une redirection navigateur (§8.1, §8.2) :
 * paiement avant expiration -> +30 jours ajoutés aux jours restants (essai compris) ;
 * paiement après expiration -> 30 jours à partir de la date du paiement.
 */
export function extendedPaidUntil(sub: Pick<Subscription, 'paidUntil' | 'trialEndsAt'>, paidAt: number): string {
  const end = subscriptionEnd(sub);
  const endMs = end ? Date.parse(end) : 0;
  const base = endMs > paidAt ? endMs : paidAt;
  return new Date(base + SUBSCRIPTION_DAYS * DAY_MS).toISOString();
}

/** La saisie (et la modification) des bilans est coupée dès le 4e jour (§8.3 bis, §8.4). */
export function canSubmitReports(status: SubscriptionStatus): boolean {
  return status !== 'blocked';
}

/** Le tableau de bord du propriétaire n'est plus visible dès le 4e jour (§8.3). */
export function canViewOwnerDashboard(status: SubscriptionStatus): boolean {
  return status !== 'blocked';
}

export type SubscriptionPopup =
  | { kind: 'none' }
  | { kind: 'expiring'; daysLeft: number; dismissible: true; message: string }
  | { kind: 'grace'; day: 1 | 2 | 3; dismissible: true; message: string }
  | { kind: 'blocked'; dismissible: false; message: string };

const plural = (n: number) => (n > 1 ? 'jours' : 'jour');

/**
 * Pop-up affiché au propriétaire à CHAQUE ouverture (§8.3). Les textes reprennent le cahier.
 * Au 4e jour le bouton OK disparaît : seul « Renouveler » reste.
 */
export function subscriptionPopup(sub: Pick<Subscription, 'paidUntil' | 'trialEndsAt'>, now: number): SubscriptionPopup {
  const status = subscriptionStatus(sub, now);
  if (status === 'blocked') {
    return { kind: 'blocked', dismissible: false, message: 'Votre abonnement a expiré. Renouvelez pour retrouver votre tableau de bord.' };
  }
  if (status === 'grace') {
    const day = graceDay(sub, now) as 1 | 2 | 3;
    const message =
      day === 1
        ? 'Votre abonnement a expiré.'
        : day === 2
          ? 'Votre abonnement a expiré il y a 2 jours.'
          : 'Votre abonnement a expiré il y a 3 jours. Veuillez renouveler.';
    return { kind: 'grace', day, dismissible: true, message };
  }
  const left = daysRemaining(sub, now);
  if (left >= 1 && left <= REMINDER_DAYS_BEFORE) {
    return {
      kind: 'expiring',
      daysLeft: left,
      dismissible: true,
      message: `Votre abonnement se termine dans ${left} ${plural(left)}.`,
    };
  }
  return { kind: 'none' };
}

/** Message neutre montré à l'employé en cas de blocage : jamais d'impayé ni de paiement (§8.3 bis). */
export function employeeBlockedMessage(businessName: string): string {
  return `Saisie momentanément indisponible. L'accès à la saisie des bilans de ${businessName} est en pause. Vos bilans précédents sont conservés. Merci de contacter le responsable du business pour rétablir l'accès.`;
}

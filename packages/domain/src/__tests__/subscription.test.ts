import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../dates';
import {
  canSubmitReports,
  canViewOwnerDashboard,
  daysRemaining,
  employeeBlockedMessage,
  extendedPaidUntil,
  graceDay,
  subscriptionPopup,
  subscriptionStatus,
  trialEndsAtFrom,
} from '../subscription';

const T0 = Date.parse('2026-10-09T10:00:00.000Z');
const msg = (p: { kind: string }) => ('message' in p ? String(p.message) : '');
const iso = (ms: number) => new Date(ms).toISOString();
const paid = (end: number) => ({ paidUntil: iso(end), trialEndsAt: null });

describe('statut d\'abonnement (§8.3)', () => {
  it('essai de 7 jours à partir de la création', () => {
    expect(trialEndsAtFrom(T0)).toBe(iso(T0 + 7 * DAY_MS));
  });

  it('distingue essai, actif, grâce (3 jours) puis blocage dès le 4e jour', () => {
    const end = T0;
    const trial = { paidUntil: null, trialEndsAt: iso(end) };
    expect(subscriptionStatus(trial, end - 1)).toBe('trial');
    expect(subscriptionStatus(trial, end)).toBe('grace');
    expect(subscriptionStatus(trial, end + 3 * DAY_MS - 1)).toBe('grace');
    expect(subscriptionStatus(trial, end + 3 * DAY_MS)).toBe('blocked');
    expect(subscriptionStatus(paid(end), end - 1)).toBe('active');
  });

  it('numérote les jours de grâce 1, 2, 3', () => {
    const sub = paid(T0);
    expect(graceDay(sub, T0)).toBe(1);
    expect(graceDay(sub, T0 + DAY_MS)).toBe(2);
    expect(graceDay(sub, T0 + 2 * DAY_MS + 5)).toBe(3);
    expect(graceDay(sub, T0 + 3 * DAY_MS)).toBe(0);
    expect(graceDay(sub, T0 - 1)).toBe(0);
  });

  it('un abonnement sans date est bloqué (jamais un accès par défaut)', () => {
    expect(subscriptionStatus({ paidUntil: null, trialEndsAt: null }, T0)).toBe('blocked');
  });

  it('coupe la saisie et le tableau de bord dès le blocage seulement', () => {
    expect(canSubmitReports('grace')).toBe(true);
    expect(canSubmitReports('blocked')).toBe(false);
    expect(canViewOwnerDashboard('grace')).toBe(true);
    expect(canViewOwnerDashboard('blocked')).toBe(false);
  });

  it('compte les jours restants', () => {
    expect(daysRemaining(paid(T0 + 11 * DAY_MS), T0)).toBe(11);
    expect(daysRemaining(paid(T0 - 1), T0)).toBe(0);
  });
});

describe('prolongation (§8.1)', () => {
  it('cumule 30 jours aux jours restants avant expiration', () => {
    expect(extendedPaidUntil(paid(T0 + 10 * DAY_MS), T0)).toBe(iso(T0 + 40 * DAY_MS));
  });
  it("repart de la date du paiement après expiration, y compris pendant la grâce", () => {
    expect(extendedPaidUntil(paid(T0 - DAY_MS), T0)).toBe(iso(T0 + 30 * DAY_MS));
  });
  it("compte les jours d'essai restants comme des jours restants (D-003)", () => {
    expect(extendedPaidUntil({ paidUntil: null, trialEndsAt: iso(T0 + 4 * DAY_MS) }, T0)).toBe(iso(T0 + 34 * DAY_MS));
  });
});

describe('pop-ups d\'abonnement (§8.3)', () => {
  const sub = paid(T0);
  it("n'affiche rien avant J-3", () => {
    expect(subscriptionPopup(sub, T0 - 4 * DAY_MS).kind).toBe('none');
  });
  it('affiche chaque jour à partir de J-3 avec le bon texte', () => {
    const p3 = subscriptionPopup(sub, T0 - 3 * DAY_MS);
    expect(p3).toMatchObject({ kind: 'expiring', daysLeft: 3, message: 'Votre abonnement se termine dans 3 jours.' });
    expect(subscriptionPopup(sub, T0 - 2 * DAY_MS)).toMatchObject({ daysLeft: 2 });
    const p1 = subscriptionPopup(sub, T0 - 5 * 3600_000);
    expect(p1).toMatchObject({ daysLeft: 1, message: 'Votre abonnement se termine dans 1 jour.' });
  });
  it('reprend les trois messages de grâce du cahier', () => {
    expect(msg(subscriptionPopup(sub, T0))).toBe('Votre abonnement a expiré.');
    expect(msg(subscriptionPopup(sub, T0 + DAY_MS))).toBe('Votre abonnement a expiré il y a 2 jours.');
    expect(msg(subscriptionPopup(sub, T0 + 2 * DAY_MS))).toBe('Votre abonnement a expiré il y a 3 jours. Veuillez renouveler.');
    expect(subscriptionPopup(sub, T0 + DAY_MS)).toMatchObject({ kind: 'grace', dismissible: true });
  });
  it('supprime le bouton OK à partir du 4e jour', () => {
    expect(subscriptionPopup(sub, T0 + 3 * DAY_MS)).toMatchObject({ kind: 'blocked', dismissible: false });
  });
});

describe('écran employé bloqué (§8.3 bis)', () => {
  it("reste neutre : ni abonnement, ni impayé, ni paiement", () => {
    const msg = employeeBlockedMessage('Boutique Étoile');
    expect(msg).toContain('Boutique Étoile');
    expect(msg).toContain('Vos bilans précédents sont conservés');
    expect(msg.toLowerCase()).not.toMatch(/abonnement|impay|paiement|renouvel/);
  });
});

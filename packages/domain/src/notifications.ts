/**
 * Modifications v1.2 du 01/11/2026, §2 et §4.
 *
 * §2 — Heure de fermeture par business : choisie à la création dans une liste (18h00, 20h00, 21h30) ou
 * librement, modifiable ensuite dans les paramètres. Elle sert de repère aux rappels des employés. Le calcul
 * se fait dans le fuseau du PAYS du business (voir `COUNTRIES[...].timeZone`) et non en « UTC+1 » pour les
 * trois pays comme l'écrit le document : la Côte d'Ivoire et le Togo sont en UTC+0 (docs/decisions/contradictions-cdc.md).
 *
 * §4 — Notifications internes (PWA uniquement, jamais WhatsApp) au propriétaire à la validation d'un bilan :
 * un seul employé → « Le bilan de [Business] est disponible » ; plusieurs → « [Prénom] a envoyé son bilan ».
 */

/** Heures proposées dans la liste (v1.2 §2). Une heure libre reste possible. */
export const CLOSING_TIME_PRESETS = ['18:00', '20:00', '21:30'] as const;
/** Valeur par défaut historique de la colonne `reminder_time` (migration 001). */
export const DEFAULT_CLOSING_TIME = '20:00';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isClockTime(value: string): boolean {
  return HHMM.test(value);
}

export type OwnerReportNotice = 'available' | 'individual';

/**
 * Forme de la notification au propriétaire selon le nombre d'employés du business, c'est-à-dire les membres
 * actifs non propriétaires autorisés à saisir un bilan. Zéro ou un employé : « disponible » ; deux ou plus :
 * une notification individuelle par bilan validé.
 */
export function ownerReportNotice(employeeCount: number): OwnerReportNotice {
  return employeeCount > 1 ? 'individual' : 'available';
}

/** Prénom affiché : premier mot du nom saisi, sans dépasser 40 caractères. */
export function firstNameOf(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return first.slice(0, 40);
}

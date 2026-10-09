/** Les montants sont des entiers en FCFA (pas de décimales). */

const NNBSP = ' ';

export function groupThousands(value: number): string {
  const sign = value < 0 ? '-' : '';
  const digits = String(Math.abs(Math.trunc(value)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
}

export function formatFcfa(value: number): string {
  return `${groupThousands(value)}${' '}FCFA`;
}

/** Montant signé pour les variations : "+1 200 FCFA" / "-500 FCFA". */
export function formatSignedFcfa(value: number): string {
  return `${value > 0 ? '+' : ''}${formatFcfa(value)}`;
}

/**
 * Convertit la saisie utilisateur en entier. Accepte les espaces de groupement,
 * refuse négatifs, décimales et texte. Chaîne vide -> `null`.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[\s  ]/g, '');
  if (cleaned === '') return null;
  if (!/^\d{1,12}$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

/** Variation en pourcentage, `null` si la base est nulle. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function formatPhone(e164: string): string {
  const m = /^\+229(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  if (m) return `+229 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  const local = /^\+229(\d{10})$/.exec(e164);
  if (local) return `+229 ${local[1].replace(/(\d{2})(?=\d)/g, '$1 ')}`;
  return e164;
}

/**
 * Normalise un numéro béninois saisi (avec ou sans +229, espaces tolérés) en E.164.
 * Format actuel à 10 chiffres commençant par 01 (réforme 2024). Retourne `null` si invalide.
 */
export function normalizeBeninPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  const local = digits.startsWith('+229')
    ? digits.slice(4)
    : digits.startsWith('00229')
      ? digits.slice(5)
      : digits.startsWith('229') && digits.length === 13
        ? digits.slice(3)
        : digits;
  if (!/^01\d{8}$/.test(local)) return null;
  return `+229${local}`;
}

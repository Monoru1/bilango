/** Les montants sont des entiers en FCFA (pas de décimales). */
import { COUNTRIES, type CountryCode } from './countries';

const NNBSP = '\u202f'; // espace fine insécable (milliers)
const NBSP = '\u00a0'; // espace insécable avant l'unité

export function groupThousands(value: number): string {
  const sign = value < 0 ? '-' : '';
  const digits = String(Math.abs(Math.trunc(value)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
}

export function formatFcfa(value: number): string {
  return `${groupThousands(value)}${NBSP}FCFA`;
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
  const cleaned = input.replace(/[\s\u00a0\u202f]/g, '');
  if (cleaned === '') return null;
  if (!/^\d{1,12}$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

/** Variation en pourcentage, `null` si la base est nulle. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Affichage lisible d'un numéro E.164 : "+229 01 97 00 00 01". */
export function formatPhone(e164: string): string {
  for (const cfg of Object.values(COUNTRIES)) {
    if (e164.startsWith(cfg.dialCode)) {
      const national = e164.slice(cfg.dialCode.length);
      return `${cfg.dialCode} ${national.replace(/(\d{2})(?=\d)/g, '$1 ')}`;
    }
  }
  return e164;
}

/** Masque un numéro pour l'affichage (jamais utilisé côté partenaires : ils n'en voient aucun, §10.6). */
export function maskPhone(e164: string): string {
  return e164.length <= 6 ? '•••' : `${e164.slice(0, 4)} ••• ${e164.slice(-2)}`;
}

export type { CountryCode };

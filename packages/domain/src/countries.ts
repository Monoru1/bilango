/**
 * Pays de lancement (cahier §1, §4.1). Devise unique : FCFA (XOF), montants entiers.
 * Les formats de numéros et la correspondance réseau/pays sont des HYPOTHÈSES à valider
 * (docs/DECISIONS.md D-011, D-012) : le cahier ne les détaille pas.
 */
export type CountryCode = 'BJ' | 'CI' | 'TG';

export type MobileMoneyNetwork = 'MTN' | 'Moov' | 'Orange' | 'Wave' | 'TMoney';

export interface CountryConfig {
  code: CountryCode;
  name: string;
  flag: string;
  /** Indicatif pré-rempli et bloqué à l'inscription (§4.1 étape 2). */
  dialCode: '+229' | '+225' | '+228';
  /** Décalage du fuseau du pays par rapport à UTC, en minutes (jour métier du business). */
  utcOffsetMinutes: number;
  /** Numéro national saisi par l'utilisateur, sans indicatif. */
  nationalPattern: RegExp;
  /** Exemple affiché sous le champ. */
  nationalExample: string;
  networks: readonly MobileMoneyNetwork[];
}

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  BJ: {
    code: 'BJ',
    name: 'Bénin',
    flag: '🇧🇯',
    dialCode: '+229',
    utcOffsetMinutes: 60,
    // Réforme 2024 : 10 chiffres commençant par 01.
    nationalPattern: /^01\d{8}$/,
    nationalExample: '01 97 00 00 01',
    networks: ['MTN', 'Moov'],
  },
  CI: {
    code: 'CI',
    name: "Côte d'Ivoire",
    flag: '🇨🇮',
    dialCode: '+225',
    utcOffsetMinutes: 0,
    nationalPattern: /^\d{10}$/,
    nationalExample: '07 00 00 00 01',
    networks: ['MTN', 'Moov', 'Orange', 'Wave'],
  },
  TG: {
    code: 'TG',
    name: 'Togo',
    flag: '🇹🇬',
    dialCode: '+228',
    utcOffsetMinutes: 0,
    nationalPattern: /^\d{8}$/,
    nationalExample: '90 00 00 01',
    networks: ['Moov', 'TMoney'],
  },
};

export const COUNTRY_CODES = Object.keys(COUNTRIES) as CountryCode[];

export function isCountryCode(value: string): value is CountryCode {
  return value in COUNTRIES;
}

/** Fuseau du jour métier utilisé par défaut (siège de Novadis Digital, Cotonou). */
export const DEFAULT_UTC_OFFSET_MINUTES = COUNTRIES.BJ.utcOffsetMinutes;

/**
 * Normalise un numéro saisi (espaces, tirets, indicatif facultatif) en E.164.
 * Retourne `null` si le numéro national ne respecte pas le format du pays.
 */
export function normalizePhone(country: CountryCode, input: string): string | null {
  const cfg = COUNTRIES[country];
  const compact = input.replace(/[\s.\-()]/g, '');
  const dial = cfg.dialCode.slice(1);
  let national: string;
  if (compact.startsWith(`+${dial}`)) national = compact.slice(dial.length + 1);
  else if (compact.startsWith(`00${dial}`)) national = compact.slice(dial.length + 2);
  else if (compact.startsWith(dial) && cfg.nationalPattern.test(compact.slice(dial.length))) national = compact.slice(dial.length);
  else national = compact;
  if (!/^\d+$/.test(national) || !cfg.nationalPattern.test(national)) return null;
  return `${cfg.dialCode}${national}`;
}

/** Pays d'un numéro E.164, `null` si l'indicatif est inconnu. */
export function countryOfPhone(e164: string): CountryCode | null {
  for (const cfg of Object.values(COUNTRIES)) {
    if (e164.startsWith(cfg.dialCode)) return cfg.code;
  }
  return null;
}

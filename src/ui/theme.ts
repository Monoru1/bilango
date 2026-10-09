/**
 * Design tokens BilanGo. Palette officielle du cahier des charges (§7) :
 * vert foncé #0F6E56 (principal), #085041 (accents foncés / textes importants),
 * #5DCAA5 (accents clairs / indicateurs positifs). Pas de jaune/orange (proches de MTN / Orange Money).
 */
export const colors = {
  primary: '#0F6E56',
  primaryDark: '#085041',
  primaryLight: '#5DCAA5',
  primaryTint: '#E6F4EF',

  background: '#F5F8F7',
  surface: '#FFFFFF',
  border: '#DCE5E1',

  text: '#10231D',
  textSecondary: '#52665F',
  textMuted: '#5B6D66',
  textOnPrimary: '#FFFFFF',

  positive: '#0F6E56',
  negative: '#B3261E',
  negativeTint: '#FBEAE8',
  info: '#2F5D8A',
  infoTint: '#E7EFF7',
  neutralTint: '#EDF1EF',

  overlay: 'rgba(8, 36, 29, 0.45)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const typography = {
  display: { fontSize: 40, lineHeight: 46, fontWeight: '800' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
} as const;

export type TextVariant = keyof typeof typography;

/** Retours client mission 05 : limités aux accueils, sans recolorer les autres écrans. */
export const homeColors = {
  background: '#FFFFFF',
  text: '#14181A',
  secondary: '#6B7280',
  decorative: '#9AA09C',
  separator: '#F0F0EE',
  negative: '#A34232', // #B54B3A du PDF renforcé pour WCAG AA sur la pastille.
  negativeTint: '#FBEDEA',
  positiveTint: '#EAF5EF',
  roleTint: '#F3F3F1',
  roleText: '#626973',
  logo: '#25D366',
} as const;

/** Taille minimale d'une cible tactile (accessibilité, utilisateurs peu à l'aise avec le numérique). */
export const MIN_TOUCH = 48;

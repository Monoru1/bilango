import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { colors } from '../theme';

/** Rapport de contraste WCAG 2.x entre deux couleurs #RRGGBB. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5;

// Paires texte / fond réellement utilisées par les composants (voir ui/primitives.tsx).
const TEXT_PAIRS: [string, string, string][] = [
  ['texte sur fond', colors.text, colors.background],
  ['texte sur carte', colors.text, colors.surface],
  ['texte secondaire sur fond', colors.textSecondary, colors.background],
  ['texte secondaire sur carte', colors.textSecondary, colors.surface],
  ['texte secondaire sur teinte neutre', colors.textSecondary, colors.neutralTint],
  ['texte discret sur fond', colors.textMuted, colors.background],
  ['texte discret sur carte', colors.textMuted, colors.surface],
  ['texte discret sur teinte verte', colors.textMuted, colors.primaryTint],
  ['texte sur vert principal', colors.textOnPrimary, colors.primary],
  ['texte vert foncé sur teinte verte', colors.primaryDark, colors.primaryTint],
  ['texte vert foncé sur carte', colors.primaryDark, colors.surface],
  ['bouton secondaire (vert sur teinte)', colors.primary, colors.primaryTint],
  ['bouton fantôme (vert sur fond)', colors.primary, colors.background],
  ['erreur sur carte', colors.negative, colors.surface],
  ['erreur sur fond', colors.negative, colors.background],
  ['erreur sur teinte rouge', colors.negative, colors.negativeTint],
  ['info sur teinte bleue', colors.info, colors.infoTint],
  ['légende sur vert principal', colors.primaryTint, colors.primary],
];

describe('contraste des couleurs (WCAG AA)', () => {
  it.each(TEXT_PAIRS)('%s ≥ 4,5:1', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('les éléments graphiques (focus, bordure active) ont ≥ 3:1 sur le fond', () => {
    expect(contrast(colors.primary, colors.background)).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.negative, colors.surface)).toBeGreaterThanOrEqual(3);
  });
});

describe('assets Android de marque configurés', () => {
  const { expo } = JSON.parse(readFileSync(resolve(__dirname, '../../../app.json'), 'utf8'));
  const splash = expo.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')[1];
  const paths: string[] = [expo.icon, ...Object.values<string>(expo.android.adaptiveIcon).filter((path) => path.endsWith('.png')), splash.image];

  it.each(paths)('%s est un PNG 1024 × 1024 existant', (path) => {
    const png = readFileSync(resolve(__dirname, '../../..', path));
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1024, 1024]);
  });
  it('utilise la palette officielle et le plugin splash', () => {
    expect(paths).toHaveLength(5);
    expect(expo.android.adaptiveIcon.backgroundColor).toBe(colors.primary);
    expect(splash.backgroundColor).toBe(colors.primary);
    expect(splash.resizeMode).toBe('contain');
    expect(readFileSync(resolve(__dirname, '../../../assets/images/brand.svg'), 'utf8')).toContain(colors.primary);
  });
});

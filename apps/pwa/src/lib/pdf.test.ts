import { describe, expect, it } from 'vitest';
import type { Report } from '@gobilan/domain';
import { reportLines } from './pdf';

const rep: Report = {
  id: 'r1', businessId: 'b', day: '2026-10-09', authorId: 'u', authorName: 'Awa Sanni', submittedAt: '2026-10-09T18:42:00.000Z',
  versions: [{ savedAt: '2026-10-09T18:42:00.000Z', content: { revenue: { total: 48_500, lines: [{ id: 'l', label: 'Boissons', amount: 48_500 }] }, expenses: { total: 6_000, lines: [] }, cashIn: { total: 0, lines: [] }, stockSales: [], note: 'RAS' } }],
};

describe('PDF texte du bilan', () => {
  const lines = reportLines({ name: 'Boutique Étoile' }, '2026-10-09', [rep], 60);
  it('contient le business, la date, le contributeur et son heure locale', () => {
    expect(lines[0]).toBe('GoBilan — Boutique Étoile');
    expect(lines[1]).toBe('Bilan du Vendredi 9 octobre');
    expect(lines).toContain('Awa Sanni — 19:42');
  });
  it('détaille les lignes et la note, et totalise', () => {
    expect(lines.some((l) => l.includes('- Boissons : 48 500 FCFA'))).toBe(true);
    expect(lines).toContain('  Note : RAS');
    expect(lines.at(-1)).toContain('CA : 48 500 FCFA');
  });
  it('ne contient aucun espace insécable (rendu PDF)', () => {
    expect(lines.join('\n')).not.toMatch(/[\u202f\u00a0]/);
  });
});

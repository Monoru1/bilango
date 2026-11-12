import { describe, expect, it } from 'vitest';
import { renderRecetteTarget } from '../src/render-recette-target';

describe('cible des migrations Render de recette', () => {
  it('accepte uniquement la base privée dédiée', () => {
    expect(renderRecetteTarget('postgresql://fixture:fixture@dpg-dbopc7brjlhs73bjik8g-a/gobilan_recette').pathname).toBe('/gobilan_recette');
    for (const url of [undefined, 'postgresql://other/gobilan_recette', 'postgresql://dpg-dbopc7brjlhs73bjik8g-a/production', 'https://dpg-dbopc7brjlhs73bjik8g-a/gobilan_recette']) {
      expect(() => renderRecetteTarget(url)).toThrow('dedicated_recette_database_required');
    }
  });

  it('ne révèle pas une URL mal formée dans son erreur', () => {
    expect(() => renderRecetteTarget('secret-fixture not a url')).toThrow(/^dedicated_recette_database_required$/);
  });
});

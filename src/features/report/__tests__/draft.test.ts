import { validateDraft } from '@/domain/reports';
import { draftFromContent, draftToContent, emptyDraft, newLine } from '../draft';

describe('brouillon de bilan', () => {
  it('traite une catégorie vide comme 0', () => {
    const c = draftToContent(emptyDraft());
    expect(c.revenue).toEqual({ total: 0, lines: [] });
    expect(validateDraft(c).ok).toBe(true);
  });

  it('prend la somme des lignes détaillées comme total et ignore les lignes vides', () => {
    const d = emptyDraft();
    d.revenue = {
      total: '999',
      detailOpen: true,
      lines: [
        { ...newLine(), label: 'Chaussures', amount: '28500' },
        { ...newLine(), label: 'Sacs', amount: '20000' },
        newLine(),
      ],
    };
    expect(draftToContent(d).revenue.total).toBe(48500);
    expect(draftToContent(d).revenue.lines).toHaveLength(2);
  });

  it('retient le montant global quand le détail est refermé', () => {
    const d = emptyDraft();
    d.expenses = { total: '6000', detailOpen: false, lines: [{ ...newLine(), label: 'x', amount: '1' }] };
    expect(draftToContent(d).expenses).toEqual({ total: 6000, lines: [] });
  });

  it('signale une ligne détaillée sans nom ou sans montant', () => {
    const d = emptyDraft();
    d.revenue = { total: '', detailOpen: true, lines: [{ ...newLine(), label: '', amount: '500' }] };
    expect(validateDraft(draftToContent(d)).errors.revenue).toBeDefined();
    d.revenue = { total: '', detailOpen: true, lines: [{ ...newLine(), label: 'Eau', amount: '' }] };
    expect(validateDraft(draftToContent(d)).errors.revenue).toBeDefined();
  });

  it('recharge un bilan existant pour le modifier sans perte', () => {
    const d = emptyDraft();
    d.revenue = { total: '', detailOpen: true, lines: [{ ...newLine(), label: 'Boissons', amount: '12000' }] };
    d.cashIn = { total: '50000', detailOpen: false, lines: [] };
    d.quantities = { a: 3, b: 0 };
    d.note = 'RAS';
    const content = draftToContent(d);
    const back = draftToContent(draftFromContent(content));
    expect(back).toEqual(content);
  });
});

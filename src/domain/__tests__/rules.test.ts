import { addDays, beninInstant, formatDayLong, formatTime, toDayKey } from '../dates';
import { formatFcfa, normalizeBeninPhone, parseAmount, percentChange } from '../money';
import {
  can,
  canEditReport,
  canGrantLevel,
  canManageMember,
  canViewReport,
  EDIT_WINDOW_MS,
  grantableLevels,
} from '../permissions';
import {
  buildHeadline,
  cashTimeline,
  finalizeContent,
  normalizeAmount,
  stockLevels,
  theoreticalCash,
  totalsOfDay,
  validateDraft,
} from '../reports';
import { daysRemaining, extendedPaidUntil, subscriptionStatus } from '../subscription';
import type { Access, Report, ReportContent, Role, StockItem } from '../types';

const BIZ = 'biz1';

function amount(total: number) {
  return { total, lines: [] };
}

function content(revenue = 0, expenses = 0, cashIn = 0, stockSales: ReportContent['stockSales'] = []): ReportContent {
  return { revenue: amount(revenue), expenses: amount(expenses), cashIn: amount(cashIn), stockSales, note: '' };
}

function report(day: string, c: ReportContent, extra: Partial<Report> = {}): Report {
  const submittedAt = beninInstant(day, '20:00');
  return {
    id: `${day}-${extra.authorId ?? 'u1'}-${extra.submittedAt ?? ''}`,
    businessId: BIZ,
    day,
    authorId: 'u1',
    authorName: 'Rodrigue',
    submittedAt,
    versions: [{ content: c, savedAt: submittedAt }],
    ...extra,
  };
}

const role = (level: Role['level'], name = level): Role => ({ id: `r-${level}`, businessId: BIZ, name, level });
const owner: Access = { businessId: BIZ, userId: 'o', isOwner: true, role: null };
const full: Access = { businessId: BIZ, userId: 'f', isOwner: false, role: role('full') };
const entry: Access = { businessId: BIZ, userId: 'e', isOwner: false, role: role('entry') };
const readonly: Access = { businessId: BIZ, userId: 'r', isOwner: false, role: role('readonly') };

describe('dates', () => {
  it('calcule le jour métier à Cotonou (UTC+1)', () => {
    expect(toDayKey('2026-10-09T23:30:00.000Z')).toBe('2026-10-10');
    expect(toDayKey('2026-10-09T22:59:00.000Z')).toBe('2026-10-09');
  });

  it('additionne des jours et formate en français', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(formatDayLong('2026-10-09')).toBe('vendredi 9 octobre');
    expect(formatTime('2026-10-09T13:05:00.000Z')).toBe('14h05');
  });
});

describe('montants et téléphone', () => {
  it('formate les FCFA avec séparateur de milliers', () => {
    expect(formatFcfa(125000)).toBe('125 000 FCFA');
  });

  it('parse la saisie utilisateur', () => {
    expect(parseAmount('12 500')).toBe(12500);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('-5')).toBeNaN();
    expect(parseAmount('12,5')).toBeNaN();
  });

  it('calcule une variation en pourcentage', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 0)).toBeNull();
  });

  it('normalise les numéros béninois', () => {
    expect(normalizeBeninPhone('01 97 00 00 01')).toBe('+2290197000001');
    expect(normalizeBeninPhone('+229 01 97 00 00 01')).toBe('+2290197000001');
    expect(normalizeBeninPhone('0197')).toBeNull();
  });
});

describe('permissions par rôle', () => {
  it('limite les capacités selon le niveau', () => {
    expect(can(entry, 'submitReport')).toBe(true);
    expect(can(entry, 'viewAllReports')).toBe(false);
    expect(can(readonly, 'submitReport')).toBe(false);
    expect(can(readonly, 'viewDashboard')).toBe(true);
    expect(can(full, 'manageStock')).toBe(true);
    expect(can(full, 'viewSubscription')).toBe(false);
    expect(can(owner, 'viewSubscription')).toBe(true);
  });

  it("interdit de gérer un rang égal ou supérieur, et de retirer le propriétaire", () => {
    expect(canManageMember(owner, full)).toBe(true);
    expect(canManageMember(full, entry)).toBe(true);
    expect(canManageMember(full, readonly)).toBe(true);
    expect(canManageMember(full, full)).toBe(false);
    expect(canManageMember(full, owner)).toBe(false);
    expect(canManageMember(owner, owner)).toBe(false);
    expect(canManageMember(entry, readonly)).toBe(false);
  });

  it("n'accorde que des niveaux strictement inférieurs, sauf pour le propriétaire", () => {
    expect(canGrantLevel(owner, 'full')).toBe(true);
    expect(canGrantLevel(full, 'full')).toBe(false);
    expect(grantableLevels(full).sort()).toEqual(['entry', 'readonly']);
    expect(grantableLevels(entry)).toEqual([]);
  });

  it("restreint la lecture des bilans d'un profil Saisie seule à ses propres bilans", () => {
    const own = report('2026-10-09', content(1), { authorId: 'e' });
    const other = report('2026-10-09', content(1), { authorId: 'x' });
    expect(canViewReport(entry, own, 'e')).toBe(true);
    expect(canViewReport(entry, other, 'e')).toBe(false);
    expect(canViewReport(readonly, other, 'r')).toBe(true);
  });
});

describe('fenêtre de modification de 24 h', () => {
  const r = report('2026-10-09', content(1), { authorId: 'e' });
  const sent = Date.parse(r.submittedAt);

  it("autorise l'auteur avant 24 h", () => {
    expect(canEditReport(entry, r, 'e', sent + EDIT_WINDOW_MS - 1)).toBe(true);
  });

  it('refuse passé 24 h, à un autre utilisateur, ou en lecture seule', () => {
    expect(canEditReport(entry, r, 'e', sent + EDIT_WINDOW_MS)).toBe(false);
    expect(canEditReport(entry, r, 'someone-else', sent + 1000)).toBe(false);
    expect(canEditReport(readonly, { ...r, authorId: 'r' }, 'r', sent + 1000)).toBe(false);
  });
});

describe('bilan : montants, validation', () => {
  it('fait de la somme des lignes le total de la catégorie', () => {
    const a = normalizeAmount({
      total: 999,
      lines: [
        { id: 'a', label: 'Bière', amount: 1500 },
        { id: 'b', label: 'Soda', amount: 500 },
      ],
    });
    expect(a.total).toBe(2000);
  });

  it('refuse les lignes incomplètes et le stock excédentaire', () => {
    const bad = content(0);
    bad.revenue = { total: 0, lines: [{ id: 'a', label: '', amount: 100 }] };
    bad.stockSales = [{ itemId: 'i1', quantity: 5 }];
    const res = validateDraft(bad, { remainingStock: { i1: 3 } });
    expect(res.ok).toBe(false);
    expect(res.errors.revenue).toBeDefined();
    expect(res.errors.stock).toBeDefined();
  });

  it('exige la caisse de départ au premier bilan', () => {
    expect(validateDraft(content(100), { openingCashRequired: true, openingCash: null }).errors.openingCash).toBeDefined();
    expect(validateDraft(content(100), { openingCashRequired: true, openingCash: 50000 }).ok).toBe(true);
  });

  it('retire les ventes de stock à zéro à la finalisation', () => {
    const c = content(10, 0, 0, [
      { itemId: 'a', quantity: 0 },
      { itemId: 'b', quantity: 2 },
    ]);
    expect(finalizeContent(c).stockSales).toEqual([{ itemId: 'b', quantity: 2 }]);
  });
});

describe('plusieurs contributeurs par jour', () => {
  it('additionne tous les bilans reçus ce jour-là', () => {
    const reports = [
      report('2026-10-09', content(10000), { authorId: 'a', submittedAt: beninInstant('2026-10-09', '14:00') }),
      report('2026-10-09', content(25000, 3000, 0), { authorId: 'b', submittedAt: beninInstant('2026-10-09', '21:00') }),
    ];
    const t = totalsOfDay(reports, BIZ, '2026-10-09');
    expect(t).toMatchObject({ revenue: 35000, expenses: 3000, reportCount: 2 });
  });
});

describe('caisse théorique', () => {
  const business = { id: BIZ, openingCash: { amount: 100000, day: '2026-10-07', declaredById: 'u1' } };

  it('applique veille + CA + ajouts - dépenses jour après jour', () => {
    const reports = [
      report('2026-10-07', content(50000, 10000, 0)),
      report('2026-10-08', content(30000, 5000, 20000)),
    ];
    const t = cashTimeline(business, reports, '2026-10-09');
    expect(t.map((d) => d.closing)).toEqual([140000, 185000, 185000]);
    expect(t[1]).toMatchObject({ opening: 140000, revenue: 30000, cashIn: 20000, expenses: 5000 });
  });

  it('répercute une modification sur tous les jours suivants', () => {
    const base = [report('2026-10-07', content(50000, 10000)), report('2026-10-08', content(30000))];
    const before = theoreticalCash(business, base, '2026-10-09')!.closing;
    const edited: Report = {
      ...base[0],
      versions: [...base[0].versions, { content: content(60000, 10000), savedAt: beninInstant('2026-10-07', '22:00') }],
    };
    const after = theoreticalCash(business, [edited, base[1]], '2026-10-09')!.closing;
    expect(after - before).toBe(10000);
  });

  it("est inconnue tant que la caisse de départ n'est pas déclarée", () => {
    expect(theoreticalCash({ id: BIZ, openingCash: null }, [], '2026-10-09')).toBeNull();
  });
});

describe('chiffre principal du dashboard', () => {
  it("affiche le CA du jour quand il existe, avec la comparaison avec la veille", () => {
    const reports = [report('2026-10-08', content(100)), report('2026-10-09', content(150))];
    expect(buildHeadline(reports, BIZ, '2026-10-09')).toMatchObject({
      kind: 'today',
      revenue: 150,
      awaitingToday: false,
      deltaPercent: 50,
    });
  });

  it('retombe sur le dernier bilan avec sa date et le badge En attente du bilan', () => {
    const h = buildHeadline([report('2026-10-08', content(100))], BIZ, '2026-10-09');
    expect(h).toMatchObject({ kind: 'last', day: '2026-10-08', revenue: 100, awaitingToday: true });
  });

  it("signale l'absence totale de bilan sans afficher de zéro trompeur", () => {
    expect(buildHeadline([], BIZ, '2026-10-09').kind).toBe('none');
  });
});

describe('stock facultatif', () => {
  it('déduit les ventes déclarées du stock de départ', () => {
    const items: StockItem[] = [{ id: 'i1', businessId: BIZ, name: 'Bière', initialQuantity: 100 }];
    const reports = [
      report('2026-10-08', content(0, 0, 0, [{ itemId: 'i1', quantity: 12 }])),
      report('2026-10-09', content(0, 0, 0, [{ itemId: 'i1', quantity: 8 }])),
    ];
    expect(stockLevels(items, reports, BIZ)[0]).toMatchObject({ sold: 20, remaining: 80 });
  });
});

describe('abonnement', () => {
  const now = Date.parse('2026-10-09T10:00:00.000Z');
  it('distingue essai, actif et expiré', () => {
    expect(subscriptionStatus({ businessId: BIZ, trialEndsAt: '2026-10-12T00:00:00.000Z', paidUntil: null, payments: [] }, now)).toBe('trial');
    expect(subscriptionStatus({ businessId: BIZ, trialEndsAt: null, paidUntil: '2026-10-20T00:00:00.000Z', payments: [] }, now)).toBe('active');
    expect(subscriptionStatus({ businessId: BIZ, trialEndsAt: null, paidUntil: '2026-10-01T00:00:00.000Z', payments: [] }, now)).toBe('expired');
  });

  it('compte les jours restants', () => {
    const sub = { businessId: BIZ, trialEndsAt: null, paidUntil: '2026-10-20T10:00:00.000Z', payments: [] };
    expect(daysRemaining(sub, now)).toBe(11);
  });

  it('cumule les 30 jours avant expiration, repart du paiement après', () => {
    const before = extendedPaidUntil({ paidUntil: '2026-10-20T00:00:00.000Z' }, now);
    expect(before).toBe('2026-11-19T00:00:00.000Z');
    const after = extendedPaidUntil({ paidUntil: '2026-10-01T00:00:00.000Z' }, now);
    expect(after).toBe('2026-11-08T10:00:00.000Z');
  });
});

import { EDIT_WINDOW_MS } from '@/domain/permissions';
import { emptyContent } from '@/domain/reports';
import { ServiceError } from '../../types';
import { createMockServices } from '..';
import { DEMO_OTP_CODE } from '../seed';

const NOW = Date.parse('2026-10-09T10:00:00.000Z');

function setup() {
  let clock = NOW;
  const services = createMockServices({ now: () => clock, latencyMs: 0 });
  return { s: services, advance: (ms: number) => (clock += ms) };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
  await promise.catch((e) => expect(e).toBeInstanceOf(ServiceError));
}

function contentWith(revenue: number, extra: Partial<ReturnType<typeof emptyContent>> = {}) {
  const c = emptyContent();
  c.revenue = { total: revenue, lines: [] };
  return { ...c, ...extra };
}

describe('auth OTP', () => {
  it('refuse un mauvais code et accepte le code de démo', async () => {
    const { s } = setup();
    await expectCode(s.auth.verifyOtp('+2290197000001', '000000'), 'INVALID_OTP');
    const { user, token } = await s.auth.verifyOtp('+2290197000001', DEMO_OTP_CODE);
    expect(user.name).toBe('Koffi Adjovi');
    expect((await s.auth.restoreSession(token))?.id).toBe(user.id);
  });

  it('applique le rate limiting par numéro', async () => {
    const { s, advance } = setup();
    await s.auth.requestOtp('+2290197000001');
    await expectCode(s.auth.requestOtp('+2290197000001'), 'RATE_LIMITED');
    advance(31_000);
    await expect(s.auth.requestOtp('+2290197000001')).resolves.toBeDefined();
  });

  it('crée un compte vide pour un nouveau numéro, sans business ni mot de passe', async () => {
    const { s } = setup();
    const { user } = await s.auth.verifyOtp('+2290197000099', DEMO_OTP_CODE);
    expect(user.name).toBe('');
    expect(await s.businesses.listMine(user.id)).toEqual([]);
    expect(await s.team.listMyInvitations(user.id)).toEqual([]);
  });

  it("retrouve les invitations d'un numéro invité avant son inscription", async () => {
    const { s } = setup();
    const { user } = await s.auth.verifyOtp('+2290197000006', DEMO_OTP_CODE);
    const invitations = await s.team.listMyInvitations(user.id);
    expect(invitations).toHaveLength(1);
    expect(invitations[0].businessName).toBe('Chez Maman Bar');
  });
});

describe('multi-business et rôles', () => {
  it('liste les business du compte avec le CA du jour et le rôle par business', async () => {
    const { s } = setup();
    const list = await s.businesses.listMine('u-koffi');
    expect(list.map((o) => o.business.name).sort()).toEqual(['Boutique Étoile', 'Chez Maman Bar', 'E-Shop Cotonou']);
    expect(list.find((o) => o.business.id === 'b-eshop')!.access.isOwner).toBe(false);
    expect(list.find((o) => o.business.id === 'b-etoile')!.todayRevenue).toBe(48500);
    expect(list.find((o) => o.business.id === 'b-maman')!.todayRevenue).toBeNull();
  });

  it("bloque l'accès aux données d'un business non rattaché", async () => {
    const { s } = setup();
    await expectCode(s.reports.list('b-eshop', 'u-fatou'), 'FORBIDDEN');
    await expectCode(s.reports.dashboard('b-maman', 'u-rodrigue', 7), 'FORBIDDEN');
  });

  it("n'expose à une Saisie seule que ses propres bilans", async () => {
    const { s } = setup();
    const mine = await s.reports.list('b-maman', 'u-rodrigue');
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((r) => r.authorId === 'u-rodrigue')).toBe(true);
    const others = (await s.reports.list('b-maman', 'u-koffi')).find((r) => r.authorId !== 'u-rodrigue')!;
    await expectCode(s.reports.get(others.id, 'u-rodrigue'), 'FORBIDDEN');
  });
});

describe('invitations et hiérarchie', () => {
  it('donne accès seulement après acceptation', async () => {
    const { s } = setup();
    await expectCode(s.reports.list('b-etoile', 'u-rodrigue'), 'FORBIDDEN');
    const [inv] = await s.team.listMyInvitations('u-rodrigue');
    await s.team.respondToInvitation(inv.id, 'u-rodrigue', true);
    await expect(s.reports.list('b-etoile', 'u-rodrigue')).resolves.toEqual([]);
    expect(await s.team.listMyInvitations('u-rodrigue')).toEqual([]);
  });

  it('un refus ne donne aucun accès', async () => {
    const { s } = setup();
    const [inv] = await s.team.listMyInvitations('u-rodrigue');
    await s.team.respondToInvitation(inv.id, 'u-rodrigue', false);
    await expectCode(s.reports.list('b-etoile', 'u-rodrigue'), 'FORBIDDEN');
  });

  it("empêche un gérant d'inviter au niveau Gestion complète ou de retirer un égal / le propriétaire", async () => {
    const { s } = setup();
    await expectCode(s.team.invite('b-maman', 'u-fatou', { phone: '01 97 00 00 55', roleId: 'r-gerant' }), 'FORBIDDEN');
    await expect(s.team.invite('b-maman', 'u-fatou', { phone: '01 97 00 00 55', roleId: 'r-serveur' })).resolves.toBeDefined();
    const members = await s.team.listMembers('b-maman', 'u-koffi');
    const owner = members.find((m) => m.isOwner)!;
    await expectCode(s.team.removeMember(owner.member.id, 'u-fatou'), 'FORBIDDEN');
    await expectCode(s.team.removeMember(owner.member.id, 'u-koffi'), 'FORBIDDEN');
  });

  it("refuse un doublon d'invitation et un numéro invalide", async () => {
    const { s } = setup();
    await expectCode(s.team.invite('b-maman', 'u-koffi', { phone: '12', roleId: 'r-serveur' }), 'VALIDATION');
    await expectCode(s.team.invite('b-maman', 'u-koffi', { phone: '01 97 00 00 06', roleId: 'r-serveur' }), 'CONFLICT');
  });

  it('retire un membre sans supprimer ses bilans (soft delete)', async () => {
    const { s } = setup();
    const before = (await s.reports.list('b-maman', 'u-koffi')).filter((r) => r.authorId === 'u-rodrigue').length;
    const rodrigue = (await s.team.listMembers('b-maman', 'u-koffi')).find((m) => m.user.id === 'u-rodrigue')!;
    await s.team.removeMember(rodrigue.member.id, 'u-koffi');
    await expectCode(s.reports.managerHome('b-maman', 'u-rodrigue'), 'FORBIDDEN');
    const after = await s.reports.list('b-maman', 'u-koffi');
    expect(after.filter((r) => r.authorId === 'u-rodrigue')).toHaveLength(before);
    expect(after.find((r) => r.authorId === 'u-rodrigue')!.authorName).toBe('Rodrigue Sossou');
  });

  it('seul le propriétaire crée des rôles', async () => {
    const { s } = setup();
    await expectCode(s.team.createRole('b-maman', 'u-fatou', { name: 'Barman', level: 'entry' }), 'FORBIDDEN');
    await expect(s.team.createRole('b-maman', 'u-koffi', { name: 'Barman', level: 'entry' })).resolves.toMatchObject({ name: 'Barman' });
    await expectCode(s.team.createRole('b-maman', 'u-koffi', { name: 'barman', level: 'full' }), 'CONFLICT');
  });
});

describe('bilans : envoi, modification, caisse', () => {
  it('additionne le nouveau bilan au CA du jour (multi-contributeurs)', async () => {
    const { s } = setup();
    await s.reports.submit('b-maman', 'u-rodrigue', { content: contentWith(40000) });
    await s.reports.submit('b-maman', 'u-fatou', { content: contentWith(25000) });
    const dash = await s.reports.dashboard('b-maman', 'u-koffi', 1);
    expect(dash.headline).toMatchObject({ kind: 'today', revenue: 65000, awaitingToday: false });
    const day = await s.reports.dayView('b-maman', 'u-koffi', dash.headline.day!);
    expect(day.reports).toHaveLength(2);
  });

  it("refuse un second bilan du même auteur le même jour et un bilan en lecture seule", async () => {
    const { s } = setup();
    await s.reports.submit('b-maman', 'u-rodrigue', { content: contentWith(10000) });
    await expectCode(s.reports.submit('b-maman', 'u-rodrigue', { content: contentWith(5000) }), 'CONFLICT');
    await expectCode(s.reports.submit('b-maman', 'u-yacine', { content: contentWith(5000) }), 'FORBIDDEN');
  });

  it("exige la caisse de départ au tout premier bilan d'un nouveau business", async () => {
    const { s } = setup();
    const biz = await s.businesses.create('u-aicha', {
      name: 'Kiosque Test',
      sector: 'other',
      stockEnabled: false,
      reminderTime: '20:00',
    });
    await expectCode(s.reports.submit(biz.id, 'u-aicha', { content: contentWith(10000) }), 'VALIDATION');
    await s.reports.submit(biz.id, 'u-aicha', { content: contentWith(10000), openingCash: 20000 });
    const dash = await s.reports.dashboard(biz.id, 'u-aicha', 1);
    expect(dash.cash?.closing).toBe(30000);
    expect(dash.openingCashMissing).toBe(false);
  });

  it("autorise la modification dans les 24 h, conserve les 2 versions et recalcule la caisse", async () => {
    const { s, advance } = setup();
    const before = (await s.reports.dashboard('b-etoile', 'u-koffi', 1)).cash!.closing;
    const [mine] = await s.reports.list('b-etoile', 'u-koffi', { mineOnly: true });
    advance(2 * 3600_000);
    const edited = await s.reports.edit(mine.id, 'u-koffi', contentWith(58500, { expenses: mine.versions[0].content.expenses }));
    expect(edited.versions).toHaveLength(2);
    expect(edited.versions[0].content.revenue.total).toBe(48500);
    expect((await s.reports.dashboard('b-etoile', 'u-koffi', 1)).cash!.closing).toBe(before + 10000);
  });

  it('refuse la modification après 24 h et par un autre utilisateur', async () => {
    const { s, advance } = setup();
    const [mine] = await s.reports.list('b-etoile', 'u-koffi', { mineOnly: true });
    await expectCode(s.reports.edit(mine.id, 'u-aicha', contentWith(1)), 'FORBIDDEN');
    advance(EDIT_WINDOW_MS);
    await expectCode(s.reports.edit(mine.id, 'u-koffi', contentWith(1)), 'EDIT_WINDOW_CLOSED');
  });

  it("n'inclut pas le CA d'un jour sans bilan : retombe sur le dernier bilan avec la mention En attente", async () => {
    const { s } = setup();
    const dash = await s.reports.dashboard('b-maman', 'u-koffi', 7);
    expect(dash.headline.kind).toBe('last');
    expect(dash.headline.awaitingToday).toBe(true);
  });
});

describe('stock facultatif', () => {
  it("déduit les ventes d'un bilan du stock restant et refuse l'excédent", async () => {
    const { s } = setup();
    const before = (await s.stock.list('b-maman', 'u-koffi')).find((l) => l.item.id === 'st-eau')!.remaining;
    await s.reports.submit('b-maman', 'u-rodrigue', {
      content: contentWith(5000, { stockSales: [{ itemId: 'st-eau', quantity: 3 }] }),
    });
    const after = (await s.stock.list('b-maman', 'u-koffi')).find((l) => l.item.id === 'st-eau')!.remaining;
    expect(after).toBe(before - 3);
    await expectCode(
      s.reports.submit('b-maman', 'u-fatou', {
        content: contentWith(5000, { stockSales: [{ itemId: 'st-eau', quantity: after + 1 }] }),
      }),
      'VALIDATION',
    );
  });

  it("n'expose pas le module quand il est désactivé", async () => {
    const { s } = setup();
    await expectCode(s.stock.list('b-etoile', 'u-koffi'), 'NOT_FOUND');
  });
});

describe('abonnement (lecture seule)', () => {
  it('expose statut et jours restants, et réserve les paiements au propriétaire', async () => {
    const { s } = setup();
    const owner = await s.subscriptions.get('b-maman', 'u-koffi');
    expect(owner.status).toBe('active');
    expect(owner.daysRemaining).toBe(11);
    expect(owner.subscription.payments).toHaveLength(2);
    const manager = await s.subscriptions.get('b-maman', 'u-rodrigue');
    expect(manager.subscription.payments).toEqual([]);
    expect((await s.subscriptions.get('b-eshop', 'u-aicha')).status).toBe('expired');
  });
});


describe('régressions audit mission 04', () => {
  it('réserve les mouvements globaux aux niveaux de consultation, tout en montrant la caisse au manager', async () => {
    const { s } = setup();
    const home = await s.reports.managerHome('b-maman', 'u-rodrigue');
    expect(home.cash).toEqual({ closing: (await s.reports.dashboard('b-maman', 'u-koffi', 1)).cash!.closing });
    const [report] = await s.reports.list('b-maman', 'u-rodrigue');
    const day = await s.reports.dayView('b-maman', 'u-rodrigue', report.day);
    expect(day.cash).toBeNull();
    expect(day.reports.every((r) => r.authorId === 'u-rodrigue')).toBe(true);
  });
  it('refuse le stock étranger, dupliqué ou désactivé sans écrire de bilan', async () => {
    const { s } = setup();
    for (const stockSales of [[{ itemId: 'foreign', quantity: 1 }], [{ itemId: 'st-eau', quantity: 1 }, { itemId: 'st-eau', quantity: 1 }]]) {
      await expectCode(s.reports.submit('b-maman', 'u-rodrigue', { content: contentWith(1, { stockSales }) }), 'VALIDATION');
    }
    await expectCode(s.reports.submit('b-eshop', 'u-koffi', { content: contentWith(1, { stockSales: [{ itemId: 'st-eau', quantity: 1 }] }) }), 'VALIDATION');
    expect((await s.reports.managerHome('b-maman', 'u-rodrigue')).myReportToday).toBeNull();
    const [own] = await s.reports.list('b-etoile', 'u-koffi');
    await expectCode(s.reports.edit(own.id, 'u-koffi', contentWith(1, { stockSales: [{ itemId: 'st-eau', quantity: 1 }] })), 'VALIDATION');
    expect((await s.reports.get(own.id, 'u-koffi')).versions).toHaveLength(own.versions.length);
  });
  it('isole les rôles par business et protège les invitations des autres numéros', async () => {
    const { s } = setup();
    await expectCode(s.team.invite('b-maman', 'u-koffi', { phone: '01 97 00 00 55', roleId: 'r-livreur' }), 'NOT_FOUND');
    const [inv] = await s.team.listMyInvitations('u-rodrigue');
    await expectCode(s.team.respondToInvitation(inv.id, 'u-fatou', true), 'NOT_FOUND');
    await s.team.respondToInvitation(inv.id, 'u-rodrigue', false);
    await expectCode(s.team.respondToInvitation(inv.id, 'u-rodrigue', true), 'NOT_FOUND');
  });
  it('réactive un membre invité à nouveau sans perdre ses bilans ni leur auteur', async () => {
    const { s } = setup();
    const oldReports = await s.reports.list('b-maman', 'u-rodrigue');
    const member = (await s.team.listMembers('b-maman', 'u-koffi')).find((m) => m.user.id === 'u-rodrigue')!;
    await s.team.removeMember(member.member.id, 'u-koffi');
    const inv = await s.team.invite('b-maman', 'u-koffi', { phone: '01 97 00 00 02', roleId: 'r-serveur' });
    await s.team.respondToInvitation(inv.id, 'u-rodrigue', true);
    expect(await s.reports.list('b-maman', 'u-rodrigue')).toEqual(oldReports);
    expect((await s.team.listMembers('b-maman', 'u-koffi')).filter((m) => m.user.id === 'u-rodrigue')).toHaveLength(1);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS } from '@gobilan/domain';
import { expectCode, makeDeps, mkTeam, reportInput, services, type Ctx } from './helpers';

const HOUR = 3600_000;
let ctx: Ctx;
beforeEach(async () => {
  ctx = await makeDeps();
});

describe('saisie du bilan (§6)', () => {
  it('exige la caisse de départ au premier bilan, une seule fois', async () => {
    const { reports } = services(ctx);
    const t = await mkTeam(ctx);
    await expectCode(reports.submit(t.owner.user, t.businessId, reportInput(1000)), 'validation');
    await reports.submit(t.owner.user, t.businessId, reportInput(1000, { openingCash: 50000 }));
    // Une seconde déclaration est ignorée : la caisse de départ ne se redéclare pas.
    await reports.submit(t.owner.user, t.businessId, reportInput(500, { openingCash: 999999 }));
    const amountInDb = (await ctx.db.query<{ a: string }>('select opening_cash_amount a from businesses')).rows[0]!.a;
    expect(Number(amountInDb)).toBe(50000);
  });

  it('additionne les bilans de plusieurs contributeurs le même jour (§6.3)', async () => {
    const { reports } = services(ctx);
    const t = await mkTeam(ctx);
    const a = await t.addMember('Awa', t.roles.entry);
    const k = await t.addMember('Koffi', t.roles.entry);
    await reports.submit(a.user, t.businessId, reportInput(30000, { openingCash: 100000 }));
    await reports.submit(k.user, t.businessId, reportInput(18500, { expenses: 6000 }));
    const d = await reports.dashboard(t.owner.user, t.businessId);
    expect(d.headline).toMatchObject({ kind: 'today', revenue: 48500 });
    expect(d.expensesToday).toBe(6000);
    expect(d.theoreticalCash).toBe(100000 + 48500 - 6000);
    expect(d.contributors.map((c) => c.authorName).sort()).toEqual(['Awa', 'Koffi']);
  });

  it("est idempotent : un renvoi réseau avec le même identifiant ne crée pas de doublon", async () => {
    const { reports } = services(ctx);
    const t = await mkTeam(ctx);
    const input = reportInput(1000, { openingCash: 0, id: 'req-idempotent-1' });
    const first = await reports.submit(t.owner.user, t.businessId, input);
    const second = await reports.submit(t.owner.user, t.businessId, input);
    expect(second).toMatchObject({ id: first.id, duplicate: true });
    expect(Number((await ctx.db.query<{ n: string }>('select count(*) n from reports')).rows[0]!.n)).toBe(1);
  });

  it("date le bilan par l'horloge serveur dans le fuseau du pays (Bénin UTC+1, Côte d'Ivoire UTC+0)", async () => {
    const { reports } = services(ctx);
    ctx.clock.set(Date.parse('2026-10-19T23:30:00.000Z'));
    const bj = await mkTeam(ctx, { country: 'BJ' });
    const ci = await mkTeam(ctx, { country: 'CI' });
    const rb = await reports.submit(bj.owner.user, bj.businessId, reportInput(1, { openingCash: 0 }));
    const rc = await reports.submit(ci.owner.user, ci.businessId, reportInput(1, { openingCash: 0 }));
    expect(rb.day).toBe('2026-10-20');
    expect(rc.day).toBe('2026-10-19');
  });

  it("refuse un montant non entier ou négatif au niveau domaine même si le contrat était contourné", async () => {
    const { reports } = services(ctx);
    const t = await mkTeam(ctx);
    const bad = reportInput(10.5, { openingCash: 0 });
    await expectCode(reports.submit(t.owner.user, t.businessId, bad), 'validation');
  });

  it('gère le stock : vente supérieure au restant refusée, module désactivé refusé', async () => {
    const { biz, reports } = services(ctx);
    const off = await mkTeam(ctx, { stock: false });
    await expectCode(reports.submit(off.owner.user, off.businessId, reportInput(1, { openingCash: 0, stock: [{ itemId: 'x', quantity: 1 }] })), 'validation');

    const on = await mkTeam(ctx, { stock: true });
    const item = await biz.addStockItem(on.owner.user, on.businessId, { name: 'Savon', initialQuantity: 10 });
    await expectCode(reports.submit(on.owner.user, on.businessId, reportInput(1, { openingCash: 0, stock: [{ itemId: item.id, quantity: 11 }] })), 'validation');
    await reports.submit(on.owner.user, on.businessId, reportInput(1, { openingCash: 0, stock: [{ itemId: item.id, quantity: 4 }] }));
    await expectCode(reports.submit(on.owner.user, on.businessId, reportInput(1, { stock: [{ itemId: item.id, quantity: 7 }] })), 'validation');
    await reports.submit(on.owner.user, on.businessId, reportInput(1, { stock: [{ itemId: item.id, quantity: 6 }] }));
  });

  it("refuse un article de stock d'un AUTRE business", async () => {
    const { biz, reports } = services(ctx);
    const a = await mkTeam(ctx, { stock: true });
    const b = await mkTeam(ctx, { stock: true });
    const foreign = await biz.addStockItem(b.owner.user, b.businessId, { name: 'Autre', initialQuantity: 5 });
    await expectCode(reports.submit(a.owner.user, a.businessId, reportInput(1, { openingCash: 0, stock: [{ itemId: foreign.id, quantity: 1 }] })), 'validation');
  });

  it("notifie le propriétaire sans montant quand un employé envoie un bilan (§9.2)", async () => {
    const { reports } = services(ctx);
    const t = await mkTeam(ctx);
    const e = await t.addMember('Awa', t.roles.entry);
    await reports.submit(e.user, t.businessId, reportInput(123456, { openingCash: 0 }));
    const sent = ctx.providers.push.sent.filter((p) => p.userId === t.owner.user.id);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.payload.body).toBe('Nouveau bilan reçu — Boutique Étoile');
    expect(sent[0]!.payload.body).not.toMatch(/\d{3}/);
  });
});

describe('modification sous 24 h et versions (§6.6)', () => {
  async function setup() {
    const { reports } = services(ctx);
    const t = await mkTeam(ctx);
    const emp = await t.addMember('Awa', t.roles.entry);
    const r = await reports.submit(emp.user, t.businessId, reportInput(50000, { openingCash: 100000 }));
    return { reports, t, emp, r };
  }

  it("ajoute une version et conserve l'originale, avec horodatages", async () => {
    const { reports, t, emp, r } = await setup();
    ctx.clock.advance(2 * HOUR);
    const edit = await reports.edit(emp.user, r.id, { content: reportInput(60000).content });
    expect(edit.versionNo).toBe(2);
    const full = await reports.get(t.owner.user, r.id);
    expect(full.versions).toHaveLength(2);
    expect(full.versions[0]!.content.revenue.total).toBe(50000);
    expect(full.versions[1]!.content.revenue.total).toBe(60000);
    expect(Date.parse(full.versions[1]!.savedAt)).toBeGreaterThan(Date.parse(full.versions[0]!.savedAt));
  });

  it('notifie le propriétaire de la modification', async () => {
    const { reports, t, emp, r } = await setup();
    ctx.clock.advance(HOUR);
    await reports.edit(emp.user, r.id, { content: reportInput(60000).content });
    expect(ctx.providers.push.sent.some((p) => p.userId === t.owner.user.id && p.payload.body.startsWith('Bilan modifié'))).toBe(true);
  });

  it('recalcule la caisse théorique de ce jour et des suivants', async () => {
    const { reports, t, emp, r } = await setup();
    const before = (await reports.dashboard(t.owner.user, t.businessId)).theoreticalCash;
    ctx.clock.advance(HOUR);
    await reports.edit(emp.user, r.id, { content: reportInput(60000).content });
    const after = (await reports.dashboard(t.owner.user, t.businessId)).theoreticalCash;
    expect((after ?? 0) - (before ?? 0)).toBe(10000);
  });

  it('refuse après 24 h, et la fenêtre ne se prolonge pas à chaque modification', async () => {
    const { reports, emp, r } = await setup();
    ctx.clock.advance(20 * HOUR);
    await reports.edit(emp.user, r.id, { content: reportInput(51000).content });
    ctx.clock.advance(5 * HOUR); // 25 h après l'envoi initial
    await expectCode(reports.edit(emp.user, r.id, { content: reportInput(52000).content }), 'edit_window_closed');
  });

  it("autorise jusqu'à la dernière milliseconde puis refuse pile à 24 h", async () => {
    const { reports, emp, r } = await setup();
    ctx.clock.advance(24 * HOUR - 1);
    await reports.edit(emp.user, r.id, { content: reportInput(51000).content });
    ctx.clock.advance(1);
    await expectCode(reports.edit(emp.user, r.id, { content: reportInput(52000).content }), 'edit_window_closed');
  });

  it("seul l'auteur modifie : ni le propriétaire ni un autre employé", async () => {
    const { reports, t, r } = await setup();
    const other = await t.addMember('Koffi', t.roles.entry);
    await expectCode(reports.edit(t.owner.user, r.id, { content: reportInput(1).content }), 'forbidden');
    await expectCode(reports.edit(other.user, r.id, { content: reportInput(1).content }), 'not_found'); // « Saisie seule » ne voit pas ce bilan
  });

  it("les versions sont immuables en base : UPDATE et DELETE sont refusés par le schéma", async () => {
    const { r } = await setup();
    await expect(ctx.db.query(`update report_versions set content = '{}'::jsonb where report_id = $1`, [r.id])).rejects.toThrow(/ajout seul/);
    await expect(ctx.db.query('delete from report_versions where report_id = $1', [r.id])).rejects.toThrow(/ajout seul/);
    await expect(ctx.db.query(`update reports set day = '2020-01-01' where id = $1`, [r.id])).rejects.toThrow(/ajout seul/);
  });

  it('deux modifications simultanées produisent deux versions distinctes, sans collision', async () => {
    const { reports, emp, r } = await setup();
    ctx.clock.advance(HOUR);
    const results = await Promise.allSettled([
      reports.edit(emp.user, r.id, { content: reportInput(61000).content }),
      reports.edit(emp.user, r.id, { content: reportInput(62000).content }),
    ]);
    expect(results.every((x) => x.status === 'fulfilled')).toBe(true);
    const nos = (await ctx.db.query<{ version_no: number }>('select version_no from report_versions where report_id = $1 order by 1', [r.id])).rows.map((x) => x.version_no);
    expect(nos).toEqual([1, 2, 3]);
  });
});

describe('historique et dashboard (§7)', () => {
  it('ne montre jamais un faux zéro : retombe sur le dernier bilan avec sa date', async () => {
    const { reports } = services(ctx);
    const t = await mkTeam(ctx);
    await reports.submit(t.owner.user, t.businessId, reportInput(40000, { openingCash: 0 }));
    ctx.clock.advance(DAY_MS);
    const d = await reports.dashboard(t.owner.user, t.businessId);
    expect(d.headline).toMatchObject({ kind: 'last', revenue: 40000, awaitingToday: true });
  });
  it('affiche l\'état vide sans bilan', async () => {
    const { reports } = services(ctx);
    const t = await mkTeam(ctx);
    expect((await reports.dashboard(t.owner.user, t.businessId)).headline.kind).toBe('none');
  });
});

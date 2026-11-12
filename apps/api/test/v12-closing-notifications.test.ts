import { beforeEach, describe, expect, it } from 'vitest';
import { ScheduledJobs } from '../src/services/jobs';
import { expectCode, makeDeps, mkTeam, mkUser, reportInput, services, type Ctx } from './helpers';

/**
 * Modifications v1.2 du 01/11/2026 : §2 heure de fermeture (REC-01, volet notifications internes) et
 * §4 notifications internes au propriétaire (REC-05, REC-06). Les envois WhatsApp (REC-02/03/07) restent
 * hors périmètre tant que la décision §9 n'est pas prise : rien ici ne simule un envoi WhatsApp.
 */
let ctx: Ctx;
beforeEach(async () => {
  ctx = await makeDeps();
});

const at = (iso: string) => ctx.clock.set(Date.parse(iso));
const reminderTimeOf = async (id: string) => (await ctx.db.query<{ reminder_time: string }>('select reminder_time from businesses where id = $1', [id])).rows[0]!.reminder_time.slice(0, 5);
const reminders = () => ctx.providers.push.sent.filter((p) => p.payload.type === 'reminder');

describe('REC-01 — heure de fermeture choisie à la création puis modifiée (v1.2 §2)', () => {
  it('rattrape une fermeture tardive après minuit sans doublon et pour le jour correct', async () => {
    const t = await mkTeam(ctx, { country: 'CI' });
    await t.addMember('Employé', t.roles.entry);
    await ctx.db.query('update businesses set reminder_time = $2 where id = $1', [t.businessId, '23:30']);
    const jobs = new ScheduledJobs(ctx.deps);
    at('2026-10-20T00:15:00Z');
    expect((await jobs.runOnce({ reconcile: false })).reminders).toBe(1);
    const log = await ctx.db.query<{ dedupe_key: string }>("select dedupe_key from notification_log where kind = 'reminder'");
    expect(log.rows[0]?.dedupe_key).toContain(':2026-10-19:');
    at('2026-10-20T01:00:00Z');
    expect((await jobs.runOnce({ reconcile: false })).reminders).toBe(0);
    at('2026-10-20T02:30:00Z');
    expect((await jobs.runOnce({ reconcile: false })).reminders).toBe(0);
  });

  it('après minuit, ne rappelle pas si le bilan du jour de fermeture existe déjà', async () => {
    const t = await mkTeam(ctx, { country: 'CI' });
    await t.addMember('Employé', t.roles.entry);
    await ctx.db.query('update businesses set reminder_time = $2 where id = $1', [t.businessId, '23:30']);
    at('2026-10-19T22:00:00Z');
    await services(ctx).reports.submit(t.owner.user, t.businessId, reportInput(1000, { openingCash: 0 }));
    at('2026-10-20T00:15:00Z');
    expect((await new ScheduledJobs(ctx.deps).runOnce({ reconcile: false })).reminders).toBe(0);
  });

  it('enregistre 18:00 à la création, puis 21:30 ; les rappels internes suivent la nouvelle heure', async () => {
    const { biz } = services(ctx);
    const owner = await mkUser(ctx, 'Patron');
    const { id } = await biz.createBusiness(owner.user, owner.deviceRowId, { name: 'Chez Awa', country: 'BJ', sector: 'boutique', stockEnabled: false, closingTime: '18:00' });
    expect(await reminderTimeOf(id)).toBe('18:00');
    const role = await biz.createRole(owner.user, id, { name: 'Caisse', level: 'entry' });
    const emp = await mkUser(ctx, 'Koffi');
    await biz.respondInvitation(emp.user, (await biz.invite(owner.user, id, { phone: emp.user.phone, roleId: role.id })).id, true);
    const jobs = new ScheduledJobs(ctx.deps);

    at('2026-10-19T17:05:00Z'); // 18:05 à Cotonou : rappel à 18:00
    expect((await jobs.runOnce({ reconcile: false })).reminders).toBe(1);

    await biz.update(owner.user, id, { reminderTime: '21:30' });
    expect(await reminderTimeOf(id)).toBe('21:30');
    at('2026-10-20T17:05:00Z'); // lendemain 18:05 : plus de rappel à l'ancienne heure
    expect((await jobs.runOnce({ reconcile: false })).reminders).toBe(0);
    at('2026-10-20T20:35:00Z'); // 21:35 à Cotonou : rappel à la nouvelle heure
    expect((await jobs.runOnce({ reconcile: false })).reminders).toBe(1);
    expect(reminders().every((p) => p.userId === emp.user.id)).toBe(true);
  });

  it("garde 20:00 par défaut et réserve la modification au propriétaire", async () => {
    const { biz } = services(ctx);
    const t = await mkTeam(ctx);
    expect(await reminderTimeOf(t.businessId)).toBe('20:00');
    const full = await t.addMember('Gérant', t.roles.full);
    await expectCode(biz.update(full.user, t.businessId, { reminderTime: '18:00' }), 'forbidden');
    expect(await reminderTimeOf(t.businessId)).toBe('20:00');
  });

  it("calcule l'heure locale du pays : 18:00 à Abidjan correspond à 18:00 UTC, pas 17:00", async () => {
    const { biz } = services(ctx);
    const owner = await mkUser(ctx, 'Patron', 'CI');
    const { id } = await biz.createBusiness(owner.user, owner.deviceRowId, { name: 'Maquis', country: 'CI', sector: 'bar_restaurant', stockEnabled: false, closingTime: '18:00' });
    const role = await biz.createRole(owner.user, id, { name: 'Caisse', level: 'entry' });
    const emp = await mkUser(ctx, 'Yao', 'CI');
    await biz.respondInvitation(emp.user, (await biz.invite(owner.user, id, { phone: emp.user.phone, roleId: role.id })).id, true);
    const jobs = new ScheduledJobs(ctx.deps);
    at('2026-10-19T17:05:00Z'); // 17:05 à Abidjan : pas encore (une hypothèse UTC+1 aurait envoyé)
    expect((await jobs.runOnce({ reconcile: false })).reminders).toBe(0);
    at('2026-10-19T18:05:00Z');
    expect((await jobs.runOnce({ reconcile: false })).reminders).toBe(1);
  });
});

describe('REC-05 / REC-06 — notifications internes au propriétaire (v1.2 §4)', () => {
  const ownerNotices = (ownerId: string) => ctx.providers.push.sent.filter((p) => p.userId === ownerId && (p.payload.type === 'report_available' || p.payload.type === 'report_sent'));

  it('REC-05 : un seul employé → « Le bilan de [Business] est disponible »', async () => {
    const { reports } = services(ctx);
    const t = await mkTeam(ctx);
    const emp = await t.addMember('Awa Koné', t.roles.entry);
    await reports.submit(emp.user, t.businessId, reportInput(123456, { openingCash: 0 }));
    expect(ownerNotices(t.owner.user.id).map((p) => p.payload)).toEqual([{ type: 'report_available', businessName: 'Boutique Étoile', badge: true }]);
  });

  it('REC-06 : trois employés → trois notifications individuelles « [Prénom] a envoyé son bilan »', async () => {
    const { reports } = services(ctx);
    const t = await mkTeam(ctx);
    const team = [await t.addMember('Awa Koné', t.roles.entry), await t.addMember('Koffi Mensah', t.roles.entry), await t.addMember('Yao', t.roles.full)];
    await t.addMember('Comptable', t.roles.readonly); // lecture seule : n'est pas un employé qui saisit
    await reports.submit(team[0]!.user, t.businessId, reportInput(1000, { openingCash: 0 }));
    for (const m of team.slice(1)) await reports.submit(m.user, t.businessId, reportInput(2000));
    const sent = ownerNotices(t.owner.user.id);
    expect(sent.map((p) => p.payload)).toEqual(
      ['Awa', 'Koffi', 'Yao'].map((authorFirstName) => ({ type: 'report_sent', businessName: 'Boutique Étoile', authorFirstName, badge: true })),
    );
    // Aucun montant dans les charges utiles (écran verrouillé, CDC §9.2).
    expect(JSON.stringify(sent)).not.toMatch(/1000|2000/);
  });

  it("aucune notification quand le propriétaire saisit lui-même, et pas de doublon sur un renvoi idempotent", async () => {
    const { reports } = services(ctx);
    const t = await mkTeam(ctx);
    const emp = await t.addMember('Awa', t.roles.entry);
    await reports.submit(t.owner.user, t.businessId, reportInput(1000, { openingCash: 0 }));
    expect(ownerNotices(t.owner.user.id)).toHaveLength(0);
    const input = reportInput(500, { id: 'b8a6b3a4-2f43-4b8e-8f43-2b1f3d7a9c10' });
    await reports.submit(emp.user, t.businessId, input);
    await reports.submit(emp.user, t.businessId, input);
    expect(ownerNotices(t.owner.user.id)).toHaveLength(1);
  });
});

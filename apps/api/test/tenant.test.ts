import { beforeEach, describe, expect, it } from 'vitest';
import { expectCode, makeDeps, mkTeam, mkUser, reportInput, services, type Ctx } from './helpers';

let ctx: Ctx;
beforeEach(async () => {
  ctx = await makeDeps();
});

describe('isolation entre business (IDOR, cahier §13.1)', () => {
  it("un utilisateur d'un autre business reçoit « introuvable » sur TOUTES les ressources", async () => {
    const { biz, reports, subs } = services(ctx);
    const a = await mkTeam(ctx);
    const reportA = await reports.submit(a.owner.user, a.businessId, reportInput(50000, { openingCash: 100000 }));
    const intruder = await mkUser(ctx, 'Intrus');
    const b = await biz.createBusiness(intruder.user, intruder.deviceRowId, { name: 'Autre', country: 'BJ', sector: 'other', stockEnabled: false });

    const attempts: Promise<unknown>[] = [
      biz.listMembers(intruder.user, a.businessId),
      biz.listRoles(intruder.user, a.businessId),
      biz.createRole(intruder.user, a.businessId, { name: 'X', level: 'full' }),
      biz.invite(intruder.user, a.businessId, { phone: '+2290100000000', roleId: a.roles.full }),
      biz.listStock(intruder.user, a.businessId),
      biz.update(intruder.user, a.businessId, { name: 'Piraté' }),
      reports.submit(intruder.user, a.businessId, reportInput(1)),
      reports.list(intruder.user, a.businessId),
      reports.get(intruder.user, reportA.id),
      reports.edit(intruder.user, reportA.id, { content: reportInput(1).content }),
      reports.dashboard(intruder.user, a.businessId),
      subs.view(intruder.user, a.businessId),
      subs.createCheckout(intruder.user, a.businessId),
    ];
    await Promise.all(attempts.map(p => expectCode(p, 'not_found')));

    // Et rien n'a fuité ni changé.
    expect((await biz.listMine(intruder.user)).map((x) => x.id)).toEqual([b.id]);
    expect((await reports.get(a.owner.user, reportA.id)).versions).toHaveLength(1);
    const name = (await ctx.db.query<{ name: string }>('select name from businesses where id = $1', [a.businessId])).rows[0]!.name;
    expect(name).toBe('Boutique Étoile');
  });

  it("refuse un identifiant mal formé sans erreur SQL (pas d'injection)", async () => {
    const { reports } = services(ctx);
    const a = await mkTeam(ctx);
    await expectCode(reports.get(a.owner.user, "'; drop table reports; --"), 'not_found');
    await expectCode(reports.dashboard(a.owner.user, '1 or 1=1'), 'not_found');
    const n = (await ctx.db.query<{ n: string }>('select count(*) n from reports')).rows[0]!.n;
    expect(Number(n)).toBe(0);
  });

  it('un membre retiré perd tout accès futur mais ses bilans restent avec son nom (§5.4)', async () => {
    const { biz, reports } = services(ctx);
    const t = await mkTeam(ctx);
    const emp = await t.addMember('Awa', t.roles.entry);
    const r = await reports.submit(emp.user, t.businessId, reportInput(10000, { openingCash: 5000 }));
    const members = await biz.listMembers(t.owner.user, t.businessId);
    const memberId = members.find((m) => m.user_id === emp.user.id)!.member_id;
    await biz.removeMember(t.owner.user, t.businessId, memberId);

    await expectCode(reports.submit(emp.user, t.businessId, reportInput(1)), 'not_found');
    await expectCode(reports.get(emp.user, r.id), 'not_found');
    const kept = await reports.get(t.owner.user, r.id);
    expect(kept.authorName).toBe('Awa');
  });

  it("une invitation ne peut être acceptée que par le numéro invité", async () => {
    const { biz } = services(ctx);
    const t = await mkTeam(ctx);
    const invited = await mkUser(ctx, 'Invité');
    const thief = await mkUser(ctx, 'Voleur');
    const inv = await biz.invite(t.owner.user, t.businessId, { phone: invited.user.phone, roleId: t.roles.entry });
    await expectCode(biz.respondInvitation(thief.user, inv.id, true), 'not_found');
    expect(await biz.myInvitations(thief.user)).toEqual([]);
    expect(await biz.myInvitations(invited.user)).toHaveLength(1);
    await biz.respondInvitation(invited.user, inv.id, true);
    expect((await biz.listMine(invited.user)).map((b) => b.id)).toEqual([t.businessId]);
  });

  it("une invitation posée AVANT l'inscription est liée automatiquement par le numéro (§4.5)", async () => {
    const { biz } = services(ctx);
    const t = await mkTeam(ctx);
    const futurePhone = '+2290199999999';
    const inv = await biz.invite(t.owner.user, t.businessId, { phone: futurePhone, roleId: t.roles.entry });
    expect(inv.status).toBe('pending');
    // La personne crée son compte plus tard avec ce numéro.
    const row = (await ctx.db.query<{ id: string }>('insert into users(phone, country, name, created_at) values ($1,$2,$3,$4) returning id', [futurePhone, 'BJ', 'Nouvelle', new Date(ctx.clock.now()).toISOString()])).rows[0]!;
    const pending = await biz.myInvitations({ id: row.id, phone: futurePhone, name: 'Nouvelle', country: 'BJ' });
    expect(pending).toMatchObject([{ business_name: 'Boutique Étoile', role_name: 'Caissière' }]);
    // L'accès n'est PAS effectif avant acceptation.
    expect(await biz.listMine({ id: row.id, phone: futurePhone, name: 'Nouvelle', country: 'BJ' })).toEqual([]);
  });
});

describe('rôles et hiérarchie (§5.3, §5.4)', () => {
  it('seul le propriétaire crée des rôles', async () => {
    const { biz } = services(ctx);
    const t = await mkTeam(ctx);
    const gerant = await t.addMember('Gérant', t.roles.full);
    await expectCode(biz.createRole(gerant.user, t.businessId, { name: 'Nouveau', level: 'entry' }), 'forbidden');
  });

  it("personne ne retire un rang égal ou supérieur, et le propriétaire est intouchable", async () => {
    const { biz } = services(ctx);
    const t = await mkTeam(ctx);
    const g1 = await t.addMember('Gérant 1', t.roles.full);
    const g2 = await t.addMember('Gérant 2', t.roles.full);
    const caissiere = await t.addMember('Caissière', t.roles.entry);
    const members = await biz.listMembers(t.owner.user, t.businessId);
    const id = (uid: string) => members.find((m) => m.user_id === uid)!.member_id;
    await expectCode(biz.removeMember(g1.user, t.businessId, id(g2.user.id)), 'forbidden');
    await expectCode(biz.removeMember(g1.user, t.businessId, id(t.owner.user.id)), 'forbidden');
    await expectCode(biz.removeMember(t.owner.user, t.businessId, id(t.owner.user.id)), 'forbidden');
    await biz.removeMember(g1.user, t.businessId, id(caissiere.user.id)); // niveau inférieur : autorisé
  });

  it("un gérant n'attribue qu'un niveau strictement inférieur au sien", async () => {
    const { biz } = services(ctx);
    const t = await mkTeam(ctx);
    const gerant = await t.addMember('Gérant', t.roles.full);
    await expectCode(biz.invite(gerant.user, t.businessId, { phone: '+2290100000009', roleId: t.roles.full }), 'forbidden');
    await biz.invite(gerant.user, t.businessId, { phone: '+2290100000009', roleId: t.roles.entry });
  });

  it("un rôle d'un AUTRE business ne peut pas être attribué", async () => {
    const { biz } = services(ctx);
    const a = await mkTeam(ctx);
    const b = await mkTeam(ctx);
    await expectCode(biz.invite(a.owner.user, a.businessId, { phone: '+2290100000008', roleId: b.roles.entry }), 'not_found');
  });

  it("« Saisie seule » ne voit que ses propres bilans, ni tableau de bord, ni équipe, ni abonnement", async () => {
    const { biz, reports, subs } = services(ctx);
    const t = await mkTeam(ctx);
    const e1 = await t.addMember('Awa', t.roles.entry);
    const e2 = await t.addMember('Koffi', t.roles.entry);
    const r1 = await reports.submit(e1.user, t.businessId, reportInput(1000, { openingCash: 0 }));
    await reports.submit(e2.user, t.businessId, reportInput(2000));
    expect((await reports.list(e1.user, t.businessId)).map((r) => r.id)).toEqual([r1.id]);
    await expectCode(reports.dashboard(e1.user, t.businessId), 'forbidden');
    await expectCode(biz.listMembers(e1.user, t.businessId), 'forbidden');
    await expectCode(subs.view(e1.user, t.businessId), 'forbidden');
    const e2Report = (await reports.list(e2.user, t.businessId))[0]!;
    await expectCode(reports.get(e1.user, e2Report.id), 'not_found');
  });

  it("« Lecture seule » consulte sans pouvoir saisir ni modifier", async () => {
    const { reports } = services(ctx);
    const t = await mkTeam(ctx);
    const compta = await t.addMember('Comptable', t.roles.readonly);
    await reports.submit(t.owner.user, t.businessId, reportInput(1000, { openingCash: 0 }));
    expect(await reports.dashboard(compta.user, t.businessId)).toBeTruthy();
    await expectCode(reports.submit(compta.user, t.businessId, reportInput(1)), 'forbidden');
  });
});

describe('plusieurs business pour un même compte (§5.1)', () => {
  it('le rôle dépend du business : patron ici, gérant ailleurs', async () => {
    const { biz } = services(ctx);
    const a = await mkTeam(ctx);
    const b = await mkTeam(ctx);
    const inv = await biz.invite(b.owner.user, b.businessId, { phone: a.owner.user.phone, roleId: b.roles.full });
    await biz.respondInvitation(a.owner.user, inv.id, true);
    const mine = await biz.listMine(a.owner.user);
    expect(mine.map((m) => [m.isOwner, m.level]).sort()).toEqual([[false, 'full'], [true, 'owner']]);
  });
});

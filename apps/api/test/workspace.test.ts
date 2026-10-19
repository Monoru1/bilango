import { beforeEach, describe, expect, it } from 'vitest';
import { makeDeps, mkTeam, mkUser, reportInput, services, expectCode, DAY_MS, type Ctx } from './helpers';
import { WorkspaceService } from '../src/services/workspace';

let ctx: Ctx;
beforeEach(async () => { ctx = await makeDeps(); });
describe('PWA workspace integration and isolation', () => {
  it('loads persistent business, reports, versions, cash and stock for owner', async () => {
    const team = await mkTeam(ctx, { stock: true }); const { biz, reports } = services(ctx);
    const item = await biz.addStockItem(team.owner.user, team.businessId, { name: 'Riz', initialQuantity: 10 });
    const r = await reports.submit(team.owner.user, team.businessId, reportInput(1000, { openingCash: 500, expenses: 100, stock: [{ itemId: item.id, quantity: 2 }] }));
    await reports.edit(team.owner.user, r.id, { content: reportInput(1200, { stock: [{ itemId: item.id, quantity: 3 }] }).content });
    const w = await new WorkspaceService(ctx.deps).load(team.owner.user, team.businessId);
    expect(w.reports[0]?.versions).toHaveLength(2); expect(w.theoreticalCash).toBe(1700); expect(w.stockLevels[0]?.remaining).toBe(7);
    expect(w.business.openingCash?.amount).toBe(500);
  });
  it('entry users receive own reports, current stock and no team data, financial history or other reports', async () => {
    const team = await mkTeam(ctx, { stock: true }); const entry = await team.addMember('Caissier', team.roles.entry);
    const { biz, reports } = services(ctx); const item = await biz.addStockItem(team.owner.user, team.businessId, { name: 'Riz', initialQuantity: 10 });
    await reports.submit(team.owner.user, team.businessId, reportInput(98765, { openingCash: 100, stock: [{ itemId: item.id, quantity: 4 }] }));
    const w = await new WorkspaceService(ctx.deps).load(entry.user, team.businessId);
    expect(w.reports).toEqual([]); expect(w.users).toEqual([entry.user]); expect(w.members).toHaveLength(1);
    expect(w.invitations).toEqual([]); expect(w.subscription.payments).toEqual([]); expect(w.theoreticalCash).toBeNull();
    expect(w.stockLevels[0]?.remaining).toBe(6); expect(JSON.stringify(w)).not.toContain('98765');
  });
  it('refuses workspace access across businesses and immediately after removal', async () => {
    const team = await mkTeam(ctx); const other = await mkUser(ctx, 'Intrus');
    const ws = new WorkspaceService(ctx.deps);
    await expectCode(ws.load(other.user, team.businessId), 'not_found');
    const entry = await team.addMember('Employé', team.roles.entry);
    const member = (await ws.load(entry.user, team.businessId)).members[0]!;
    await services(ctx).biz.removeMember(team.owner.user, team.businessId, member.id);
    await expectCode(ws.load(entry.user, team.businessId), 'not_found');
  });
  it('keeps invitation target and role so acceptance opens the right business', async () => {
    const team = await mkTeam(ctx); const guest = await mkUser(ctx, 'Invité');
    await services(ctx).biz.invite(team.owner.user, team.businessId, { phone: guest.user.phone, roleId: team.roles.entry });
    const ws = new WorkspaceService(ctx.deps); const invitations = await ws.invitations('i.phone=$1', guest.user.phone);
    expect(invitations[0]).toMatchObject({ businessId: team.businessId, roleId: team.roles.entry, businessName: 'Boutique Étoile', status: 'pending' });
    await services(ctx).biz.respondInvitation(guest.user, invitations[0]!.id, true);
    expect((await ws.load(guest.user, team.businessId)).members[0]?.userId).toBe(guest.user.id);
  });
  it('blocked owner receives subscription access without leaking reports or cash', async () => {
    const team = await mkTeam(ctx, { stock: true }); const { reports } = services(ctx);
    const r = await reports.submit(team.owner.user, team.businessId, reportInput(12345, { openingCash: 700 }));
    ctx.clock.advance(11 * DAY_MS);
    const w = await new WorkspaceService(ctx.deps).load(team.owner.user, team.businessId);
    expect(w.reports).toEqual([]); expect(w.business.openingCash).toBeNull(); expect(w.theoreticalCash).toBeNull();
    expect(w.subscription.trialEndsAt).not.toBeNull();
    await expectCode(reports.list(team.owner.user, team.businessId), 'subscription_blocked');
    await expectCode(reports.get(team.owner.user, r.id), 'subscription_blocked');
    await expectCode(services(ctx).biz.addStockItem(team.owner.user, team.businessId, { name: 'Interdit après blocage', initialQuantity: 100 }), 'subscription_blocked');
  });
  it('does not truncate accounting to 60 reports or 400 days', async () => {
    const team = await mkTeam(ctx); const { reports } = services(ctx);
    for (let i = 0; i < 65; i++) await reports.submit(team.owner.user, team.businessId, reportInput(10, { openingCash: 100 }));
    ctx.clock.advance(401 * DAY_MS);
    await ctx.db.query('update businesses set paid_until=$2 where id=$1', [team.businessId, new Date(ctx.clock.now() + DAY_MS).toISOString()]);
    const w = await new WorkspaceService(ctx.deps).load(team.owner.user, team.businessId);
    expect(w.reports).toHaveLength(65); expect(w.theoreticalCash).toBe(750);
  });
});

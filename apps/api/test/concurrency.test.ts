import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService, OTP_MAX_PER_DEVICE_24H, OTP_MAX_PER_IP_24H } from '../src/services/auth';
import { WorkspaceService } from '../src/services/workspace';
import { makeDeps, mkUser, services, mkTeam, reportInput, payFor, sendWebhook, device, type Ctx } from './helpers';

let ctx: Ctx;
beforeEach(async () => { ctx = await makeDeps(); });
describe('security regression', () => {
  it('ignores a signed payment event for a different transaction, including refund', async () => {
    const team = await mkTeam(ctx); const p = await payFor(ctx, team.owner, team.businessId);
    expect(await sendWebhook(ctx, { ...p.event, id: 'wrong-approval', entity: { ...p.event.entity, id: 'other-tx' } })).toBe('ignored');
    expect(await p.send()).toBe('confirmed');
    expect(await sendWebhook(ctx, { ...p.event, id: 'wrong-refund', name: 'transaction.refunded', entity: { ...p.event.entity, id: 'other-tx' } })).toBe('ignored');
    expect((await ctx.db.query<{ status: string }>('select status from payments')).rows[0]?.status).toBe('confirmed');
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)('real PostgreSQL concurrent transactions', () => {
  it('grants only one trial when same account creates businesses concurrently', async () => {
    const owner = await mkUser(ctx, 'Patron'); const { biz } = services(ctx);
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => biz.createBusiness(owner.user, owner.deviceRowId, { name: `Business ${i}`, country: 'BJ', sector: 'boutique', stockEnabled: false })));
    expect(results.filter(r => r.trialGranted)).toHaveLength(1);
  });
  it('enforces shared device quota across different phone numbers', async () => {
    const auth = new AuthService(ctx.deps);
    const outcomes = await Promise.allSettled(Array.from({ length: 9 }, (_, i) => auth.requestOtp({ country: 'BJ', phone: `01970000${String(i).padStart(2, '0')}`, purpose: 'signup', device: device(), captchaToken: 'test' }, `10.0.0.${i}`)));
    expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(OTP_MAX_PER_DEVICE_24H);
  });
  it('enforces shared IP quota across different phone numbers and devices', async () => {
    const auth = new AuthService(ctx.deps);
    const outcomes = await Promise.allSettled(Array.from({ length: 14 }, (_, i) => auth.requestOtp({ country: 'BJ', phone: `01970001${String(i).padStart(2, '0')}`, purpose: 'signup', device: device(`different-device-${i}`), captchaToken: 'test' }, '10.0.0.1')));
    expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(OTP_MAX_PER_IP_24H);
  });
  it('serializes stock consumption: two sellers cannot both sell the last item', async () => {
    const team = await mkTeam(ctx, { stock: true }); const { biz, reports } = services(ctx);
    const item = await biz.addStockItem(team.owner.user, team.businessId, { name: 'Dernier article', initialQuantity: 1 });
    const outcomes = await Promise.allSettled([1, 2].map(() => reports.submit(team.owner.user, team.businessId, reportInput(100, { openingCash: 10, stock: [{ itemId: item.id, quantity: 1 }] }))));
    expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await new WorkspaceService(ctx.deps).load(team.owner.user, team.businessId)).stockLevels[0]?.remaining).toBe(0);
  });
  it('rolls back report and initial cash together when a version insert fails', async () => {
    const team = await mkTeam(ctx); const { reports } = services(ctx);
    await ctx.db.exec("create function fail_version_test() returns trigger language plpgsql as $$ begin raise exception 'test rollback'; end $$; create trigger fail_test before insert on report_versions for each row execute function fail_version_test();");
    await expect(reports.submit(team.owner.user, team.businessId, reportInput(100, { openingCash: 900 }))).rejects.toThrow('test rollback');
    expect((await ctx.db.query('select * from reports')).rows).toEqual([]);
    expect((await ctx.db.query<{ opening_cash_amount: string | null }>('select opening_cash_amount from businesses')).rows[0]?.opening_cash_amount).toBeNull();
  });
  it('serializes archiving a role against sending an invitation', async () => {
    const team = await mkTeam(ctx); const guest = await mkUser(ctx, 'Invité'); const { biz } = services(ctx);
    const outcomes = await Promise.allSettled([biz.archiveRole(team.owner.user, team.businessId, team.roles.entry), biz.invite(team.owner.user, team.businessId, { phone: guest.user.phone, roleId: team.roles.entry })]);
    expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  });
  it('serializes manager role changes against registering an agent', async () => {
    const { mkPartner } = await import('./helpers'); const { AdminService } = await import('../src/services/admin'); const { PartnerService } = await import('../src/services/partners');
    const manager = await mkPartner(ctx, { role: 'manager' }, 'concurrent-manager@test.example');
    const outcomes = await Promise.allSettled([new AdminService(ctx.deps).changePartnerRole({ email: 'admin@test.example' }, manager.partner.id, { role: 'influencer', promoCode: 'NEW225' }), new PartnerService(ctx.deps).registerAgent(manager.partner, { name: 'Koffi Agent', email: 'concurrent-agent@test.example', promoCode: 'KOFFI225' })]);
    expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  });
  it('migrations are idempotent on an already migrated schema', async () => {
    const { migrate } = await import('../src/db'); expect(await migrate(ctx.db)).toEqual([]);
  });
});

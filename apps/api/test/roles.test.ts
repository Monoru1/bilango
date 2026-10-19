import { beforeEach, describe, expect, it } from 'vitest';
import { AdminService } from '../src/services/admin';
import { PartnerService } from '../src/services/partners';
import { WorkspaceService } from '../src/services/workspace';
import { expectCode, makeDeps, mkTeam, mkPartner, mkReferred, mkUser, services, type Ctx } from './helpers';
let ctx: Ctx;
beforeEach(async () => { ctx = await makeDeps(); });
describe('application role lifecycle', () => {
  it('owner can rename/change permission and current members immediately receive the new access', async () => {
    const t = await mkTeam(ctx); const employee = await t.addMember('Employé', t.roles.entry); const { biz } = services(ctx);
    await biz.updateRole(t.owner.user, t.businessId, t.roles.entry, { name: 'Consultant', level: 'readonly' });
    expect((await new WorkspaceService(ctx.deps).load(employee.user, t.businessId)).roles[0]).toMatchObject({ name: 'Consultant', level: 'readonly' });
    await expectCode(biz.updateRole(employee.user, t.businessId, t.roles.entry, { name: 'Chef', level: 'full' }), 'forbidden');
    const other = await mkUser(ctx, 'Autre');
    await expectCode(biz.updateRole(other.user, t.businessId, t.roles.entry, { name: 'Chef', level: 'full' }), 'not_found');
  });
  it('archives only unused roles and refuses invitations using an archived role', async () => {
    const t = await mkTeam(ctx); const { biz } = services(ctx); const guest = await mkUser(ctx, 'Invité');
    await biz.invite(t.owner.user, t.businessId, { phone: guest.user.phone, roleId: t.roles.entry });
    await expectCode(biz.archiveRole(t.owner.user, t.businessId, t.roles.entry), 'conflict');
    await biz.archiveRole(t.owner.user, t.businessId, t.roles.readonly);
    expect((await biz.listRoles(t.owner.user, t.businessId)).some(r => r.id === t.roles.readonly)).toBe(false);
    await expectCode(biz.invite(t.owner.user, t.businessId, { phone: guest.user.phone, roleId: t.roles.readonly }), 'not_found');
    expect((await ctx.db.query('select 1 from roles where id=$1', [t.roles.readonly])).rows).toHaveLength(1);
  });
});
describe('partner role transition', () => {
  it('revokes sessions, requires new agreement and appends an audit entry', async () => {
    const p = await mkPartner(ctx, { role: 'manager' }, 'manager@test.example');
    const admin = new AdminService(ctx.deps); const partners = new PartnerService(ctx.deps);
    await admin.changePartnerRole({ email: 'admin@test.example' }, p.partner.id, { role: 'influencer', promoCode: 'MARIE229' });
    expect(await partners.resolveSession(p.token)).toBeNull();
    const next = await partners.login(p.partner.email, 'motdepasse-solide');
    expect(next.partner).toMatchObject({ role: 'influencer', agreementAccepted: false });
    await expectCode(partners.dashboard(next.partner), 'forbidden');
    await partners.acceptAgreement(next.partner, '1.0', '127.0.0.1');
    expect((await partners.resolveSession(next.token))?.agreementAccepted).toBe(true);
    expect((await admin.auditLog()).find(r => r.action === 'partner.role.change')).toMatchObject({ oldValue: { role: 'manager' }, newValue: { role: 'influencer', agreementRequired: true } });
  });
  it('preserves accounts carrying referral or commission obligations', async () => {
    const ref = await mkReferred(ctx); const admin = new AdminService(ctx.deps);
    await expectCode(admin.changePartnerRole({ email: 'admin@test.example' }, ref.agent!.id, { role: 'manager' }), 'conflict');
    await expectCode(admin.changePartnerRole({ email: 'admin@test.example' }, ref.manager!.id, { role: 'influencer', promoCode: 'OTHER225' }), 'conflict');
    expect((await ctx.db.query<{ role: string }>('select role from partners where id=$1', [ref.agent!.id])).rows[0]?.role).toBe('agent');
  });
  it('rejects stale manager sessions after a role change', async () => {
    const p = await mkPartner(ctx, { role: 'manager' }, 'old-manager@test.example', 'Marie');
    await new AdminService(ctx.deps).changePartnerRole({ email: 'admin@test.example' }, p.partner.id, { role: 'influencer', promoCode: 'MARIE225' });
    await expectCode(new PartnerService(ctx.deps).registerAgent(p.partner, { name: 'Koffi Agent', email: 'agent@test.example', promoCode: 'KOFFI225' }), 'forbidden');
  });
});

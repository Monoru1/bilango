import { beforeEach, describe, expect, it } from 'vitest';
import { AdminService } from '../src/services/admin';
import { makeDeps, expectCode, type Ctx } from './helpers';
let ctx: Ctx;
beforeEach(async () => { ctx = await makeDeps(); });
const lastCode = () => /(?:confirmation :|code :)\s*(\d{6})/i.exec(ctx.providers.messages.emails.at(-1)!.text)![1]!;
describe('confirmed admin allowlist', () => {
  it('adds only after email confirmation, logs before/after and prevents reuse', async () => {
    const admin = new AdminService(ctx.deps); await admin.upsertAdmin('primary@test.example', 'primary-test-password');
    const actor = { email: 'primary@test.example' };
    const req = await admin.requestAllowlistChange(actor, { action: 'add', email: 'backup@test.example', password: 'backup-test-password' });
    const code = lastCode();
    expect((await admin.listAllowlist()).filter(a => a.active)).toHaveLength(1);
    await expectCode(admin.confirmAllowlistChange(actor, req.requestId, code === '111111' ? '222222' : '111111'), 'otp_invalid');
    await admin.confirmAllowlistChange(actor, req.requestId, code);
    expect((await admin.listAllowlist()).filter(a => a.active)).toHaveLength(2);
    expect((await admin.auditLog()).find(a => a.action === 'admin.allowlist.add')).toMatchObject({ actor: actor.email, target: 'backup@test.example', oldValue: { active: false }, newValue: { active: true } });
    await expectCode(admin.confirmAllowlistChange(actor, req.requestId, code), 'unauthenticated');
  });
  it('prevents removing one of the last two admins', async () => {
    const admin = new AdminService(ctx.deps); await admin.upsertAdmin('a@test.example', 'primary-test-password'); await admin.upsertAdmin('b@test.example', 'backup-test-password');
    const req = await admin.requestAllowlistChange({ email: 'a@test.example' }, { action: 'remove', email: 'b@test.example' });
    await expectCode(admin.confirmAllowlistChange({ email: 'a@test.example' }, req.requestId, lastCode()), 'conflict');
    expect((await admin.listAllowlist()).filter(a => a.active)).toHaveLength(2);
  });
  it('revokes removed admin sessions immediately and rejects a different confirmer', async () => {
    const admin = new AdminService(ctx.deps);
    for (const id of ['a', 'b', 'c']) await admin.upsertAdmin(`${id}@test.example`, 'admin-test-password');
    const login = await admin.startLogin('c@test.example', 'admin-test-password'); const session = await admin.verifyLogin(login.challengeId, lastCode());
    const req = await admin.requestAllowlistChange({ email: 'a@test.example' }, { action: 'remove', email: 'c@test.example' }); const code = lastCode();
    await expectCode(admin.confirmAllowlistChange({ email: 'b@test.example' }, req.requestId, code), 'unauthenticated');
    await admin.confirmAllowlistChange({ email: 'a@test.example' }, req.requestId, code);
    expect(await admin.resolveSession(session.token)).toBeNull();
  });
  it('binds each 2FA code to its own challenge, not any previous challenge', async () => {
    const admin = new AdminService(ctx.deps); await admin.upsertAdmin('a@test.example', 'admin-test-password');
    const first = await admin.startLogin('a@test.example', 'admin-test-password'); const firstCode = lastCode();
    ctx.clock.advance(1000);
    const second = await admin.startLogin('a@test.example', 'admin-test-password'); let secondCode = lastCode();
    // Extremely rare random equality: issue another challenge rather than make a flaky assertion.
    if (firstCode === secondCode) { ctx.clock.advance(1000); const next = await admin.startLogin('a@test.example', 'admin-test-password'); second.challengeId = next.challengeId; secondCode = lastCode(); }
    await expectCode(admin.verifyLogin(first.challengeId, secondCode), 'otp_invalid');
    expect((await admin.verifyLogin(second.challengeId, secondCode)).admin.email).toBe('a@test.example');
  });
});

describe('admin operations and financial audit', () => {
  it('corrects payout details atomically and stores no clear personal fields in audit', async () => {
    const { mkPartner } = await import('./helpers');
    const { PartnerService } = await import('../src/services/partners');
    const p = await mkPartner(ctx, { role: 'manager' }, 'manager@test.example');
    const admin = new AdminService(ctx.deps);
    await admin.updatePayoutBlock({ email: 'admin@test.example' }, p.partner.id, { phone: '+2250701020304', network: 'Orange', displayName: 'Marie Test' });
    expect(await new PartnerService(ctx.deps).getPayoutBlock(p.partner)).toEqual({ phone: '+2250701020304', network: 'Orange', displayName: 'Marie Test' });
    const log = await admin.auditLog();
    expect(log.find(r => r.action === 'admin.payout_block.change')).toMatchObject({ actor: 'admin@test.example', target: p.partner.id });
    expect(JSON.stringify(log)).not.toContain('+2250701020304'); expect(JSON.stringify(log)).not.toContain('Marie Test');
    await expectCode(admin.updatePayoutBlock({ email: 'admin@test.example' }, p.partner.id, { phone: '+2250701020304', network: 'TMoney', displayName: 'Marie Test' }), 'validation');
  });
  it('lists actual subscription statuses and referrals for administrative review', async () => {
    const { mkReferred } = await import('./helpers'); const referred = await mkReferred(ctx);
    const admin = new AdminService(ctx.deps);
    expect((await admin.listSubscriptions(0, 50))[0]).toMatchObject({ id: referred.businessId, status: 'trial' });
    expect((await admin.listReferrals())[0]?.businessName).toBe('Boutique Étoile');
  });
});

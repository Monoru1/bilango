import { beforeEach, describe, expect, it } from 'vitest';
import { OwnerReferralService } from '../src/services/owner-referrals';
import { buildApp } from '../src/http/app';
import { AuthService } from '../src/services/auth';
import { expectCode, makeDeps, mkTeam, mkUser, payFor, services, type Ctx } from './helpers';

let ctx: Ctx;
beforeEach(async () => { ctx = await makeDeps(); });

describe('génération du code de parrainage propriétaire', () => {
  it('refuse la génération sans session authentifiée', async () => {
    const app = buildApp(ctx.deps, { secureCookies: true, rateLimit: false });
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/me/owner-referral-code', headers: { origin: 'http://localhost:5173', 'x-gobilan-csrf': '1' } });
      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
  it('exige un paiement confirmé du propriétaire puis conserve un seul code non réattribuable', async () => {
    const t = await mkTeam(ctx);
    const outsider = await mkUser(ctx, 'Autre');
    const service = new OwnerReferralService(ctx.deps);
    await expectCode(service.generate(t.owner.user), 'forbidden');
    await ctx.db.query("insert into payments(business_id,merchant_reference,status,amount,created_at,confirmed_at) values ($1,'fixture-owner-payment','confirmed',2000,$2,$2)", [t.businessId, new Date(ctx.clock.now()).toISOString()]);
    await expectCode(service.generate(outsider.user), 'forbidden');
    const first = await service.generate(t.owner.user);
    expect(first.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(first.active).toBe(true);
    expect(await service.generate(t.owner.user)).toEqual(first);
    await expect(ctx.db.query('delete from owner_referral_codes where owner_id=$1', [t.owner.user.id])).rejects.toThrow();
    await expect(ctx.db.query('delete from referral_code_registry where code=$1', [first.code])).rejects.toThrow();
  });

  it('génère deux codes distincts en parallèle après paiement et déduplique chaque propriétaire (REC-11)', async () => {
    const first = await mkTeam(ctx);
    const second = await mkTeam(ctx);
    expect(await (await payFor(ctx, first.owner, first.businessId)).send()).toBe('confirmed');
    expect(await (await payFor(ctx, second.owner, second.businessId)).send()).toBe('confirmed');
    const service = new OwnerReferralService(ctx.deps);
    const [a, b, repeatedA, repeatedB] = await Promise.all([
      service.generate(first.owner.user), service.generate(second.owner.user),
      service.generate(first.owner.user), service.generate(second.owner.user),
    ]);
    expect(a).toEqual(repeatedA);
    expect(b).toEqual(repeatedB);
    expect(a.code).not.toBe(b.code);
    expect((await ctx.db.query("select code from referral_code_registry where kind='owner'")).rows).toHaveLength(2);
  });

  it('interdit la collision entre un code owner et un code partenaire', async () => {
    const t = await mkTeam(ctx);
    await ctx.db.query("insert into payments(business_id,merchant_reference,status,amount,created_at,confirmed_at) values ($1,'fixture-owner-payment','confirmed',2000,$2,$2)", [t.businessId, new Date(ctx.clock.now()).toISOString()]);
    const { code } = await new OwnerReferralService(ctx.deps).generate(t.owner.user);
    await expect(ctx.db.query("insert into partners(email,name,country,role,promo_code,created_at) values('fixture@example.test','Test','BJ','influencer',$1,$2)", [code, new Date(ctx.clock.now()).toISOString()])).rejects.toThrow();
  });

  it('associe un filleul et journalise 30 jours au premier paiement confirmé sans commission partenaire', async () => {
    const sponsor = await mkTeam(ctx);
    expect(await (await payFor(ctx, sponsor.owner, sponsor.businessId)).send()).toBe('confirmed');
    const { code } = await new OwnerReferralService(ctx.deps).generate(sponsor.owner.user);
    const referred = await mkUser(ctx, 'Filleul');
    const auth = new AuthService(ctx.deps);
    await auth.updateProfile(referred.user.id, 'Filleul', code);
    await auth.updateProfile(referred.user.id, 'Filleul', code);
    await expectCode(auth.updateProfile(sponsor.owner.user.id, 'Parrain', code), 'validation');
    const business = await services(ctx).biz.createBusiness(referred.user, referred.deviceRowId, { name: 'Test', country: 'BJ', sector: 'boutique', stockEnabled: false });
    const sponsorEndsAt = (await services(ctx).subs.view(sponsor.owner.user, sponsor.businessId)).endsAt;
    const payment = await payFor(ctx, referred, business.id);
    expect((await ctx.db.query('select * from owner_referral_rewards')).rows).toHaveLength(0);
    expect(await payment.send()).toBe('confirmed');
    expect(await payment.send()).toBe('duplicate');
    expect(await (await payFor(ctx, referred, business.id)).send()).toBe('confirmed');
    expect((await services(ctx).subs.view(sponsor.owner.user, sponsor.businessId)).endsAt).toBe(sponsorEndsAt);
    const rewards = await ctx.db.query<{ referred_user_id: string; days: number }>('select referred_user_id,days from owner_referral_rewards');
    expect(rewards.rows).toEqual([{ referred_user_id: referred.user.id, days: 30 }]);
    expect(await new OwnerReferralService(ctx.deps).view(sponsor.owner.user)).toMatchObject({ eligible: true, code: { code, active: true }, registrations: 1, paid: 1, days: 30 });
    expect(await new OwnerReferralService(ctx.deps).view(referred.user)).toMatchObject({ registrations: 0, paid: 0, days: 0 });
    expect((await ctx.db.query('select * from referrals where business_id=$1', [business.id])).rows).toHaveLength(0);
    expect((await ctx.db.query('select * from commission_ledger where payment_id in (select id from payments where business_id=$1)', [business.id])).rows).toHaveLength(0);
    await expect(ctx.db.query('delete from owner_referral_rewards where referred_user_id=$1', [referred.user.id])).rejects.toThrow();
  });

  it('refuse un code owner après la création du premier business', async () => {
    const sponsor = await mkTeam(ctx);
    expect(await (await payFor(ctx, sponsor.owner, sponsor.businessId)).send()).toBe('confirmed');
    const { code } = await new OwnerReferralService(ctx.deps).generate(sponsor.owner.user);
    const late = await mkTeam(ctx);
    await expectCode(new AuthService(ctx.deps).updateProfile(late.owner.user.id, 'Tardif', code), 'conflict');
    expect((await ctx.db.query('select * from owner_referral_attributions where referred_user_id=$1', [late.owner.user.id])).rows).toHaveLength(0);
  });
});

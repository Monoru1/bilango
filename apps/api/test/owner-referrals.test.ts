import { beforeEach, describe, expect, it } from 'vitest';
import { OwnerReferralService } from '../src/services/owner-referrals';
import { buildApp } from '../src/http/app';
import { expectCode, makeDeps, mkTeam, mkUser, type Ctx } from './helpers';

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

  it('interdit la collision entre un code owner et un code partenaire', async () => {
    const t = await mkTeam(ctx);
    await ctx.db.query("insert into payments(business_id,merchant_reference,status,amount,created_at,confirmed_at) values ($1,'fixture-owner-payment','confirmed',2000,$2,$2)", [t.businessId, new Date(ctx.clock.now()).toISOString()]);
    const { code } = await new OwnerReferralService(ctx.deps).generate(t.owner.user);
    await expect(ctx.db.query("insert into partners(email,name,country,role,promo_code,created_at) values('fixture@example.test','Test','BJ','influencer',$1,$2)", [code, new Date(ctx.clock.now()).toISOString()])).rejects.toThrow();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS, expectCode, makeDeps, mkPartner, mkReferred, partnerServices, payFor, services, type Ctx } from './helpers';

let ctx: Ctx;
beforeEach(async () => {
  ctx = await makeDeps();
});

const ledger = async () => (await ctx.db.query<{ partner_id: string; role: string; amount: string }>('select partner_id, role, amount from commission_ledger order by role')).rows;

describe('commissions via paiement confirmé (§10.8)', () => {
  it('agent + manager : 1000/800 au 1er paiement, 500/500 ensuite', async () => {
    const r = await mkReferred(ctx);
    const p1 = await payFor(ctx, r.owner, r.businessId);
    expect(await p1.send()).toBe('confirmed');
    expect((await ledger()).map((l) => `${l.role}:${l.amount}`)).toEqual(['agent:1000', 'manager:800']);
    await (await payFor(ctx, r.owner, r.businessId)).send();
    expect((await ledger()).map((l) => `${l.role}:${l.amount}`).sort()).toEqual(['agent:1000', 'agent:500', 'manager:500', 'manager:800']);
  });

  it('influenceur : 1800 puis 1000, sans manager', async () => {
    const r = await mkReferred(ctx, { via: 'influencer' });
    await (await payFor(ctx, r.owner, r.businessId)).send();
    await (await payFor(ctx, r.owner, r.businessId)).send();
    expect((await ledger()).map((l) => `${l.role}:${l.amount}`).sort()).toEqual(['influencer:1000', 'influencer:1800']);
  });

  it('rejouer le webhook ne double pas la commission', async () => {
    const r = await mkReferred(ctx);
    const p = await payFor(ctx, r.owner, r.businessId);
    await p.send();
    await p.send();
    expect(await ledger()).toHaveLength(2);
  });

  it("aucune commission si le 1er paiement dépasse 30 jours après l'inscription", async () => {
    const r = await mkReferred(ctx);
    ctx.clock.advance(31 * DAY_MS);
    await (await payFor(ctx, r.owner, r.businessId)).send();
    expect(await ledger()).toHaveLength(0);
  });

  it('plafonne à 12 paiements commissionnés', async () => {
    const r = await mkReferred(ctx);
    for (let i = 0; i < 14; i++) {
      await (await payFor(ctx, r.owner, r.businessId)).send();
      ctx.clock.advance(28 * DAY_MS);
    }
    const agentLines = (await ledger()).filter((l) => l.role === 'agent');
    expect(agentLines).toHaveLength(12);
  });

  it('un paiement sans parrainage ne génère rien', async () => {
    const { mkTeam } = await import('./helpers');
    const t = await mkTeam(ctx);
    await (await payFor(ctx, t.owner, t.businessId)).send();
    expect(await ledger()).toHaveLength(0);
  });

  it('un code promo inconnu ou suspendu est refusé à la saisie', async () => {
    const { auth } = partnerServices(ctx);
    const { mkUser } = await import('./helpers');
    const u = await mkUser(ctx, 'X', 'CI');
    await expectCode(auth.updateProfile(u.user.id, 'X', 'NOPE999'), 'validation');
  });

  it("l'exclusion d'un parrainage annule les lignes par écriture inverse (journal append-only)", async () => {
    const r = await mkReferred(ctx);
    await (await payFor(ctx, r.owner, r.businessId)).send();
    const { admin } = partnerServices(ctx);
    const ref = (await ctx.db.query<{ id: string }>('select id from referrals')).rows[0]!.id;
    expect(await admin.excludeReferral({ email: 'admin@novadis.test' }, { referralId: ref, reason: 'Commerce de la famille' })).toEqual({ reversed: 2 });
    const sum = (await ctx.db.query<{ s: string }>('select sum(amount) s from commission_ledger')).rows[0]!.s;
    expect(Number(sum)).toBe(0);
    await (await payFor(ctx, r.owner, r.businessId)).send();
    expect(Number((await ctx.db.query<{ s: string }>('select sum(amount) s from commission_ledger')).rows[0]!.s)).toBe(0);
    await expect(ctx.db.query('update commission_ledger set amount = 1')).rejects.toThrow();
    await expect(ctx.db.query('delete from commission_ledger')).rejects.toThrow();
  });
});

describe('comptes partenaires (§10.1–10.4)', () => {
  it('activation unique, accord obligatoire, puis connexion', async () => {
    const { partners } = partnerServices(ctx);
    const m = await mkPartner(ctx, { role: 'manager' }, 'm@ex.test', 'Marie');
    expect(m.partner.role).toBe('manager');
    expect(m.partner.agreementAccepted).toBe(true);
    await expectCode(partners.activate('jeton-faux-jeton-faux', 'motdepasse-solide', '1.0', null), 'unauthenticated');
    const login = await partners.login('m@ex.test', 'motdepasse-solide');
    expect((await partners.resolveSession(login.token))?.id).toBe(m.partner.id);
  });

  it("le jeton d'activation est à usage unique", async () => {
    const { partners } = partnerServices(ctx);
    const { activationToken } = await import('./helpers');
    const { admin } = partnerServices(ctx);
    void admin;
    await partners.createByAdmin('admin@novadis.test', { name: 'Inf', country: 'CI', email: 'i@ex.test', role: 'influencer', promoCode: 'INF1' });
    const tok = activationToken(ctx, 'i@ex.test');
    await partners.activate(tok, 'motdepasse-solide', '1.0', null);
    await expect(partners.activate(tok, 'motdepasse-solide', '1.0', null)).rejects.toThrow();
  });

  it("l'aperçu du lien d'activation révèle le rôle sans consommer le jeton, et refuse un jeton inconnu ou expiré", async () => {
    const { partners } = partnerServices(ctx);
    const { activationToken } = await import('./helpers');
    await partners.createByAdmin('admin@novadis.test', { name: 'Inf', country: 'CI', email: 'i2@ex.test', role: 'influencer', promoCode: 'INF2' });
    const tok = activationToken(ctx, 'i2@ex.test');
    expect(await partners.previewActivation(tok)).toMatchObject({ role: 'influencer', agreementVersion: '1.0' });
    expect(await partners.previewActivation(tok)).toMatchObject({ role: 'influencer' }); // pas consommé
    await expectCode(partners.previewActivation('x'.repeat(30)), 'unauthenticated');
    ctx.clock.advance(8 * DAY_MS);
    await expectCode(partners.previewActivation(tok), 'unauthenticated');
    await expectCode(partners.activate(tok, 'motdepasse-solide', '1.0', null), 'unauthenticated');
  });

  it('verrouille après des échecs répétés, message identique pour compte inconnu et mauvais mot de passe', async () => {
    const { partners } = partnerServices(ctx);
    await mkPartner(ctx, { role: 'manager' }, 'm@ex.test');
    const unknown = await partners.login('zz@ex.test', 'x').catch((e: Error) => e.message);
    const wrong = await partners.login('m@ex.test', 'mauvais').catch((e: Error) => e.message);
    expect(unknown).toBe(wrong);
    for (let i = 0; i < 6; i++) await partners.login('m@ex.test', 'mauvais').catch(() => undefined);
    await expect(partners.login('m@ex.test', 'motdepasse-solide')).rejects.toThrow();
  });

  it('un partenaire suspendu perd sa session immédiatement', async () => {
    const { partners, admin } = partnerServices(ctx);
    const m = await mkPartner(ctx, { role: 'manager' }, 'm@ex.test');
    const login = await partners.login('m@ex.test', 'motdepasse-solide');
    await admin.setPartnerStatus({ email: 'admin@novadis.test' }, m.partner.id, 'suspended');
    expect(await partners.resolveSession(login.token)).toBeNull();
  });

  it("un manager ne voit que SES agents et l'agent n'est pas créé par un autre manager", async () => {
    const { partners } = partnerServices(ctx);
    const m1 = (await mkPartner(ctx, { role: 'manager' }, 'm1@ex.test')).partner;
    const m2 = (await mkPartner(ctx, { role: 'manager' }, 'm2@ex.test')).partner;
    await mkPartner(ctx, { role: 'agent', manager: m1, code: 'ZOE225', name: 'Zoe' }, 'a@ex.test');
    const d2 = await partners.dashboard(m2);
    expect(d2.role === 'manager' && d2.team).toHaveLength(0);
    const d1 = await partners.dashboard(m1);
    expect(d1.role === 'manager' && d1.team).toHaveLength(1);
  });

  it('un code promo ne peut pas être pris deux fois', async () => {
    const m = (await mkPartner(ctx, { role: 'manager' }, 'm@ex.test')).partner;
    await mkPartner(ctx, { role: 'agent', manager: m, code: 'ZOE225', name: 'Zoe' }, 'a@ex.test');
    await expect(mkPartner(ctx, { role: 'agent', manager: m, code: 'ZOE225', name: 'Zoe' }, 'b@ex.test')).rejects.toThrow();
  });

  it('les tableaux de bord ne contiennent aucun numéro de téléphone ni donnée de paiement', async () => {
    const r = await mkReferred(ctx);
    await (await payFor(ctx, r.owner, r.businessId)).send();
    const { partners } = partnerServices(ctx);
    for (const p of [r.agent!, r.manager!]) {
      const json = JSON.stringify(await partners.dashboard(p));
      expect(json).not.toMatch(/\+\d{8,}/);
      expect(json).not.toMatch(/phone|telephone|whatsapp/i);
    }
    expect(JSON.stringify(await partners.dashboard(r.agent!))).toContain('Boutique Étoile');
  });

  it('bloc Paiement chiffré au repos, jamais renvoyé en clair par le partenaire lui-même via le tableau de bord', async () => {
    const { partners } = partnerServices(ctx);
    const m = (await mkPartner(ctx, { role: 'manager' }, 'm@ex.test')).partner;
    await partners.setPayoutBlock(m, { phone: '+22507070707', network: 'MTN', displayName: 'Marie M' } as never);
    const raw = (await ctx.db.query<{ payout_phone_enc: string }>('select payout_phone_enc from partners where id = $1', [m.id])).rows[0]!.payout_phone_enc;
    expect(raw).not.toContain('07070707');
    expect((await partners.getPayoutBlock(m))?.phone).toBe('+22507070707');
  });
});

describe('administration et versements (§10.9–10.10)', () => {
  async function adminSession() {
    const { admin } = partnerServices(ctx);
    await admin.upsertAdmin('admin@novadis.test', 'admin-mot-de-passe-long');
    const { challengeId } = await admin.startLogin('admin@novadis.test', 'admin-mot-de-passe-long');
    const code = /\b(\d{6})\b/.exec([...ctx.providers.messages.emails].reverse().find((m) => m.to === 'admin@novadis.test' && /\b\d{6}\b/.test(m.text))!.text)![1]!;
    return { admin, challengeId, code };
  }

  it('connexion en 2 étapes : mauvais code refusé, bon code accepté, session vérifiée', async () => {
    const { admin, challengeId, code } = await adminSession();
    await expectCode(admin.verifyLogin(challengeId, code === '000000' ? '111111' : '000000'), 'otp_invalid');
    const ok = await admin.verifyLogin(challengeId, code);
    expect((await admin.resolveSession(ok.token))?.email).toBe('admin@novadis.test');
    await expectCode(admin.verifyLogin(challengeId, code), 'otp_invalid'); // challenge à usage unique
  });

  it("une adresse retirée de la liste perd sa session et ne peut plus se connecter", async () => {
    const { admin, challengeId, code } = await adminSession();
    const ok = await admin.verifyLogin(challengeId, code);
    await ctx.db.query(`update admin_users set active = false where email = 'admin@novadis.test'`);
    expect(await admin.resolveSession(ok.token)).toBeNull();
    await expect(admin.startLogin('admin@novadis.test', 'admin-mot-de-passe-long')).rejects.toThrow();
  });

  it('une adresse inconnue reçoit la même erreur qu\'un mauvais mot de passe', async () => {
    const { admin } = await adminSession();
    const a = await admin.startLogin('inconnu@x.test', 'x').catch((e: Error) => e.message);
    const b = await admin.startLogin('admin@novadis.test', 'faux').catch((e: Error) => e.message);
    expect(a).toBe(b);
  });

  async function owedSetup(payments: number) {
    const r = await mkReferred(ctx);
    for (let i = 0; i < payments; i++) await (await payFor(ctx, r.owner, r.businessId)).send();
    return r;
  }

  it('seuil de 2000 FCFA : 1000 FCFA dus => non payable ; validation refusée', async () => {
    const r = await owedSetup(1); // agent 1000
    const { admin } = partnerServices(ctx);
    const cal = await admin.payoutCalendar('2026-12-01');
    const line = cal.partners.find((p) => p.partnerId === r.agent!.id)!;
    expect(line.gross).toBe(1000);
    expect(line.payable).toBe(false);
    await expectCode(admin.validatePayout({ email: 'a@x' }, { partnerId: r.agent!.id, cycleDate: '2026-12-01', fees: 0 }), 'conflict');
  });

  it('valide un versement : montant recalculé serveur, net = brut - frais, pas de double versement, annulation => dû à nouveau', async () => {
    const r = await owedSetup(3); // agent 1000+500+500 = 2000
    const { admin } = partnerServices(ctx);
    const me = { email: 'admin@novadis.test' };
    const cycle = '2026-12-01';
    await expectCode(admin.validatePayout(me, { partnerId: r.agent!.id, cycleDate: cycle, fees: 5000 }), 'validation');
    const res = await admin.validatePayout(me, { partnerId: r.agent!.id, cycleDate: cycle, fees: 40, transferReference: 'TX1' });
    expect(res).toMatchObject({ gross: 2000, fees: 40, net: 1960 });
    await expectCode(admin.validatePayout(me, { partnerId: r.agent!.id, cycleDate: cycle, fees: 0 }), 'conflict');
    await expect(ctx.db.query('update payouts set net = 99999')).rejects.toThrow();

    await admin.reversePayout(me, { payoutId: res.payoutId, reason: 'Virement échoué' });
    await expectCode(admin.reversePayout(me, { payoutId: res.payoutId, reason: 'Encore' }), 'conflict');
    expect(ctx.providers.messages.emails.some((m) => m.to === 'koffi@ex.test' && m.subject.includes('reporté'))).toBe(true);
    const again = await admin.validatePayout(me, { partnerId: r.agent!.id, cycleDate: cycle, fees: 0 });
    expect(again.gross).toBe(2000);
  });

  it("révèle le bloc Paiement uniquement à l'admin, avec trace d'audit append-only", async () => {
    const r = await owedSetup(1);
    const { admin, partners } = partnerServices(ctx);
    await expectCode(admin.revealPayoutBlock({ email: 'admin@novadis.test' }, r.agent!.id), 'conflict');
    await partners.setPayoutBlock(r.agent!, { phone: '+2250101010101', network: 'Moov', displayName: 'Koffi A' } as never);
    expect((await admin.revealPayoutBlock({ email: 'admin@novadis.test' }, r.agent!.id)).phone).toBe('+2250101010101');
    const log = await admin.auditLog();
    expect(log.some((l) => l.action === 'partner.payout_block.reveal')).toBe(true);
    await expect(ctx.db.query('update audit_log set actor = \'x\'')).rejects.toThrow();
    await expect(ctx.db.query('delete from audit_log')).rejects.toThrow();
  });

  it('les statistiques agrègent sans fuite de données personnelles', async () => {
    await owedSetup(1);
    const s = await partnerServices(ctx).admin.stats();
    expect(s).toMatchObject({ businesses: 1, confirmedRevenue: 2000, commissionsDue: 1800 });
    expect(services(ctx)).toBeTruthy();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../src/services/auth';
import { AppError } from '../src/errors';
import { device, makeDeps } from './helpers';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const PHONE_NAT = '01 97 00 00 01';
const PHONE = '+2290197000001';

let ctx: Awaited<ReturnType<typeof makeDeps>>;
let auth: AuthService;

beforeEach(async () => {
  ctx = await makeDeps();
  auth = new AuthService(ctx.deps);
});

const ask = (purpose: 'signup' | 'pin_reset' | 'new_device' = 'signup', dev = device(), phone = PHONE_NAT) =>
  auth.requestOtp({ country: 'BJ', phone, purpose, device: dev, captchaToken: 'ok' }, '10.0.0.1');
const verify = (code: string, purpose: 'signup' | 'pin_reset' | 'new_device' = 'signup', dev = device(), phone = PHONE_NAT) =>
  auth.verifyOtp({ country: 'BJ', phone, purpose, code, device: dev });
const codeSent = () => ctx.providers.messages.lastCodeFor(PHONE)!;

async function signup(pin = '4829', dev = device()) {
  await ask('signup', dev);
  const r = await verify(codeSent(), 'signup', dev);
  if (r.kind !== 'pin_required') throw new Error('attendu pin_required');
  return auth.createPin({ otpProof: r.proof, pin, device: dev });
}

async function expectCode(p: Promise<unknown>, code: string) {
  const err = await p.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
  return err as AppError;
}

describe('OTP WhatsApp (§4.4)', () => {
  it('envoie un code à 4 chiffres, stocké haché (jamais en clair)', async () => {
    await ask();
    expect(codeSent()).toMatch(/^\d{4}$/);
    const rows = (await ctx.db.query<{ code_hash: string }>('select code_hash from otp_codes')).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.code_hash).not.toContain(codeSent());
  });

  it('exige le CAPTCHA', async () => {
    await expectCode(auth.requestOtp({ country: 'BJ', phone: PHONE_NAT, purpose: 'signup', device: device(), captchaToken: 'invalid' }, null), 'forbidden');
    expect(ctx.providers.messages.whatsapp).toHaveLength(0);
  });

  it('refuse un numéro invalide pour le pays', async () => {
    await expectCode(ask('signup', device(), '0197'), 'validation');
  });

  it('limite à 2 codes par 24 h puis bloque avec le contact support', async () => {
    await ask();
    ctx.clock.advance(MIN);
    await ask();
    ctx.clock.advance(MIN);
    const err = await expectCode(ask(), 'otp_quota');
    expect(err.message).toContain('contact@gobilan.com');
    expect(err.retryAfterSeconds).toBeGreaterThan(0);
    expect(ctx.providers.messages.whatsapp).toHaveLength(2);
    // 24 h après le premier code, un créneau se libère.
    ctx.clock.advance(DAY - 2 * MIN);
    await ask();
    expect(ctx.providers.messages.whatsapp).toHaveLength(3);
  });

  it("ne compte pas un code dont l'envoi a échoué", async () => {
    ctx.providers.messages.failNext = true;
    await expectCode(ask(), 'internal');
    await ask();
    await ask();
    expect(ctx.providers.messages.whatsapp).toHaveLength(2);
  });

  it('plafonne par appareil : 5 demandes / 24 h sur des numéros différents', async () => {
    const dev = device('device-shared01');
    for (let i = 0; i < 5; i++) await ask('signup', dev, `01 97 00 00 ${String(10 + i)}`);
    await expectCode(ask('signup', dev, '01 97 00 00 99'), 'rate_limited');
  });

  it('accepte au plus 4 saisies puis exige un nouveau code', async () => {
    await ask();
    const good = codeSent();
    const bad = good === '0000' ? '1111' : '0000';
    for (let i = 0; i < 3; i++) await expectCode(verify(bad), 'otp_invalid');
    await expectCode(verify(bad), 'otp_exhausted');
    // Même le bon code est refusé après épuisement.
    await expectCode(verify(good), 'otp_exhausted');
  });

  it('expire après 10 minutes', async () => {
    await ask();
    ctx.clock.advance(10 * MIN);
    await expectCode(verify(codeSent()), 'otp_expired');
  });

  it('est à usage unique', async () => {
    await ask();
    const code = codeSent();
    const r1 = await verify(code);
    expect(r1.kind).toBe('pin_required');
    await expectCode(verify(code), 'otp_invalid');
  });

  it('refuse un code émis pour un autre motif', async () => {
    await ask('pin_reset');
    await expectCode(verify(codeSent(), 'signup'), 'otp_invalid');
  });

  it('résiste aux saisies parallèles : le plafond de 4 essais tient', async () => {
    await ask();
    const good = codeSent();
    const bad = good === '0000' ? '1111' : '0000';
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => verify(bad)));
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    const attempts = (await ctx.db.query<{ attempts: number }>('select attempts from otp_codes')).rows[0]!.attempts;
    expect(attempts).toBeLessThanOrEqual(4);
  });
});

describe('inscription et PIN (§4.1, §4.2)', () => {
  it('crée le compte après OTP puis PIN, avec une session', async () => {
    const s = await signup();
    expect(s.user.phone).toBe(PHONE);
    expect(s.user.country).toBe('BJ');
    expect(await auth.resolveSession(s.token)).toMatchObject({ user: { phone: PHONE } });
  });

  it('stocke le PIN haché et poivré, jamais en clair', async () => {
    await signup('4829');
    const hash = (await ctx.db.query<{ pin_hash: string }>('select pin_hash from users')).rows[0]!.pin_hash;
    expect(hash.startsWith('s1$')).toBe(true);
    expect(hash).not.toContain('4829');
  });

  it("ne permet pas de réutiliser une preuve OTP, ni sur un autre appareil", async () => {
    const dev = device();
    await ask('signup', dev);
    const r = await verify(codeSent(), 'signup', dev);
    if (r.kind !== 'pin_required') throw new Error();
    await expectCode(auth.createPin({ otpProof: r.proof, pin: '4829', device: device('device-other001') }), 'unauthenticated');
    await auth.createPin({ otpProof: r.proof, pin: '4829', device: dev });
    await expectCode(auth.createPin({ otpProof: r.proof, pin: '1111', device: dev }), 'unauthenticated');
  });

  it('refuse une preuve expirée', async () => {
    await ask();
    const r = await verify(codeSent());
    if (r.kind !== 'pin_required') throw new Error();
    ctx.clock.advance(11 * MIN);
    await expectCode(auth.createPin({ otpProof: r.proof, pin: '4829', device: device() }), 'unauthenticated');
  });

  it('connecte sur un appareil connu avec le bon PIN', async () => {
    await signup('4829');
    const s = await auth.loginPin({ phone: PHONE, pin: '4829', device: device() });
    expect(s.user.phone).toBe(PHONE);
  });

  it('bloque 5 min après 4 erreurs, sans comparer le PIN pendant le blocage', async () => {
    await signup('4829');
    for (let i = 0; i < 3; i++) await expectCode(auth.loginPin({ phone: PHONE, pin: '0000', device: device() }), 'unauthenticated');
    const locked = await expectCode(auth.loginPin({ phone: PHONE, pin: '0000', device: device() }), 'locked');
    expect(locked.retryAfterSeconds).toBe(300);
    // Pendant le blocage, même le BON PIN est refusé : aucun test gratuit.
    await expectCode(auth.loginPin({ phone: PHONE, pin: '4829', device: device() }), 'locked');
    ctx.clock.advance(5 * MIN);
    await auth.loginPin({ phone: PHONE, pin: '4829', device: device() });
  });

  it('double le blocage à chaque nouvelle série (5 puis 10 minutes)', async () => {
    await signup('4829');
    for (let i = 0; i < 4; i++) await auth.loginPin({ phone: PHONE, pin: '0000', device: device() }).catch(() => undefined);
    ctx.clock.advance(5 * MIN);
    for (let i = 0; i < 3; i++) await expectCode(auth.loginPin({ phone: PHONE, pin: '0000', device: device() }), 'unauthenticated');
    const second = await expectCode(auth.loginPin({ phone: PHONE, pin: '0000', device: device() }), 'locked');
    expect(second.retryAfterSeconds).toBe(600);
  });

  it('le blocage survit à un redémarrage : il est en base, pas en mémoire', async () => {
    await signup('4829');
    for (let i = 0; i < 4; i++) await auth.loginPin({ phone: PHONE, pin: '0000', device: device() }).catch(() => undefined);
    const fresh = new AuthService(ctx.deps);
    await expectCode(fresh.loginPin({ phone: PHONE, pin: '4829', device: device() }), 'locked');
  });

  it("résiste aux essais de PIN parallèles : pas plus de 4 comparaisons avant blocage", async () => {
    await signup('4829');
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => auth.loginPin({ phone: PHONE, pin: '0000', device: device() })));
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    const u = (await ctx.db.query<{ pin_lock_count: number }>('select pin_lock_count from users')).rows[0]!;
    expect(u.pin_lock_count).toBe(1);
  });

  it('ne révèle pas si un numéro a un compte', async () => {
    const e1 = await expectCode(auth.loginPin({ phone: '+2290100000000', pin: '1234', device: device() }), 'unauthenticated');
    await signup('4829');
    const e2 = await expectCode(auth.loginPin({ phone: PHONE, pin: '1111', device: device() }), 'unauthenticated');
    expect(e1.message).toBe(e2.message);
  });

  it('refuse un PIN correct sur un appareil inconnu', async () => {
    await signup('4829');
    await expectCode(auth.loginPin({ phone: PHONE, pin: '4829', device: device('device-unknown1') }), 'unauthenticated');
  });
});

describe('nouvel appareil et PIN oublié (§4.3, §4.2)', () => {
  it('donne accès après OTP sur un nouvel appareil et liste les anciens', async () => {
    await signup('4829');
    const dev2 = device('device-second01');
    ctx.clock.advance(DAY + MIN);
    await ask('new_device', dev2);
    const r = await verify(codeSent(), 'new_device', dev2);
    if (r.kind !== 'session') throw new Error('attendu session');
    expect(r.otherDevices).toHaveLength(1);
    expect(ctx.providers.push.sent.some((p) => p.payload.body.includes('nouvel appareil'))).toBe(true);
    // Le PIN reste valable sur le nouvel appareil, désormais connu.
    await auth.loginPin({ phone: PHONE, pin: '4829', device: dev2 });
  });

  it("déconnecte l'ancien appareil sur demande", async () => {
    const first = await signup('4829');
    ctx.clock.advance(DAY + MIN);
    const dev2 = device('device-second01');
    await ask('new_device', dev2);
    const r = await verify(codeSent(), 'new_device', dev2);
    if (r.kind !== 'session') throw new Error();
    expect(await auth.logoutOtherDevices(r.session.user.id, r.session.deviceId)).toBe(1);
    expect(await auth.resolveSession(first.token)).toBeNull();
    expect(await auth.resolveSession(r.session.token)).not.toBeNull();
  });

  it('PIN oublié : OTP puis nouveau PIN, blocage remis à zéro, sessions coupées', async () => {
    const first = await signup('4829');
    for (let i = 0; i < 4; i++) await auth.loginPin({ phone: PHONE, pin: '0000', device: device() }).catch(() => undefined);
    ctx.clock.advance(DAY + MIN);
    await ask('pin_reset');
    const r = await verify(codeSent(), 'pin_reset');
    if (r.kind !== 'pin_required') throw new Error();
    expect(r.mode).toBe('reset');
    await auth.createPin({ otpProof: r.proof, pin: '7351', device: device() });
    await auth.loginPin({ phone: PHONE, pin: '7351', device: device() });
    await expectCode(auth.loginPin({ phone: PHONE, pin: '4829', device: device() }), 'unauthenticated');
    expect(await auth.resolveSession(first.token)).toBeNull();
  });
});

describe('sessions', () => {
  it('révoque à la déconnexion et refuse un jeton inconnu', async () => {
    const s = await signup();
    await auth.logout(s.token);
    expect(await auth.resolveSession(s.token)).toBeNull();
    expect(await auth.resolveSession('nope')).toBeNull();
  });
  it('expire après la durée configurée', async () => {
    const s = await signup();
    ctx.clock.advance(91 * DAY);
    expect(await auth.resolveSession(s.token)).toBeNull();
  });
  it('ne stocke que le hash du jeton de session', async () => {
    const s = await signup();
    const rows = (await ctx.db.query<{ token_hash: string }>('select token_hash from user_sessions')).rows;
    expect(rows.every((r) => r.token_hash !== s.token)).toBe(true);
  });
});

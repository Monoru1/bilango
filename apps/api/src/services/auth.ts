import {
  checkOtpState,
  COUNTRIES,
  countryOfPhone,
  evaluateOtpIssue,
  INITIAL_PIN_STATE,
  isPinLocked,
  normalizePhone,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  OTP_USER_LENGTH,
  pinRetryAfterMs,
  registerPinFailure,
  registerPinSuccess,
  type CountryCode,
  type PinState,
} from '@gobilan/domain';
import type { z } from 'zod';
import type { createPinSchema, loginPinSchema, requestOtpSchema, verifyOtpSchema } from '@gobilan/contracts';
import { iso } from '../clock';
import { hashSecret, otpDigest, randomDigits, randomToken, safeEqualHex, sha256, verifySecret } from '../crypto';
import type { Db } from '../db';
import type { Deps } from '../deps';
import { AppError } from '../errors';

type RequestOtp = z.infer<typeof requestOtpSchema>;
type VerifyOtp = z.infer<typeof verifyOtpSchema>;
type CreatePin = z.infer<typeof createPinSchema>;
type LoginPin = z.infer<typeof loginPinSchema>;

/** Plafonds complémentaires par appareil et par adresse IP (§4.4) — valeurs D-009, à valider. */
export const OTP_MAX_PER_DEVICE_24H = 5;
export const OTP_MAX_PER_IP_24H = 10;
const DAY = 24 * 60 * 60 * 1000;
const PROOF_TTL_MS = 10 * 60 * 1000;

export interface SessionUser {
  id: string;
  phone: string;
  name: string;
  country: CountryCode;
}

export interface IssuedSession {
  token: string;
  expiresAt: string;
  user: SessionUser;
  deviceId: string;
}

export type VerifyOtpResult =
  | { kind: 'session'; session: IssuedSession; otherDevices: { id: string; label: string | null; lastSeenAt: string }[] }
  | { kind: 'pin_required'; proof: string; mode: 'create' | 'reset' };

interface UserRow {
  id: string;
  phone: string;
  country: CountryCode;
  name: string;
  pin_hash: string | null;
  pin_failed_attempts: number;
  pin_lock_count: number;
  pin_locked_until: Date | null;
}

const toUser = (u: UserRow): SessionUser => ({ id: u.id, phone: u.phone, name: u.name, country: u.country });

export class AuthService {
  constructor(private readonly deps: Deps) {}

  private get now() {
    return this.deps.clock.now();
  }

  // --- OTP WhatsApp -------------------------------------------------------------------------

  /**
   * Envoie un code à 4 chiffres. La réponse est IDENTIQUE que le numéro ait un compte ou non :
   * on n'énumère pas les comptes. Quotas : 2 codes / 24 h par numéro, + plafonds par appareil
   * et par IP, CAPTCHA obligatoire (§4.4).
   */
  async requestOtp(input: RequestOtp, ip: string | null): Promise<{ sent: true; expiresInSeconds: number }> {
    if (!(await this.deps.providers.captcha.verify(input.captchaToken, ip))) {
      throw new AppError('forbidden', 'Vérification anti-robot échouée. Réessayez.');
    }
    const phone = normalizePhone(input.country, input.phone);
    if (!phone) throw new AppError('validation', 'Numéro WhatsApp invalide pour ce pays.');
    const now = this.now;

    const row = await this.deps.db.tx(async (t) => {
      // Lock shared device/IP quota buckets as well as phone; sorted to avoid deadlocks.
      for (const key of [`otp-device:${input.device.deviceId}`, ...(ip ? [`otp-ip:${ip}`] : []), `otp:${phone}`].sort()) {
        await t.query('select pg_advisory_xact_lock(hashtext($1))', [key]);
      }
      // Sérialise les demandes d'un même numéro (course : 3 demandes simultanées pour 2 codes).
      await t.query('select pg_advisory_xact_lock(hashtext($1))', [`otp:${phone}`]);
      const issued = (await t.query<{ issued_at: Date }>('select issued_at from otp_codes where subject = $1 and issued_at > $2', [phone, iso(now - DAY)])).rows.map((r) => r.issued_at.getTime());
      const decision = evaluateOtpIssue(issued, now);
      if (!decision.allowed) {
        throw new AppError(
          'otp_quota',
          'Vous avez atteint la limite de codes pour 24 heures. Contactez le support : contact@gobilan.com',
          Math.max(1, Math.ceil(((decision.retryAt as number) - now) / 1000)),
        );
      }
      const byDevice = await t.query<{ n: string }>('select count(*) n from otp_codes where device_key = $1 and issued_at > $2', [input.device.deviceId, iso(now - DAY)]);
      if (Number(byDevice.rows[0]?.n) >= OTP_MAX_PER_DEVICE_24H) throw new AppError('rate_limited', 'Trop de demandes depuis cet appareil. Réessayez plus tard.', 3600);
      if (ip) {
        const byIp = await t.query<{ n: string }>('select count(*) n from otp_codes where ip = $1 and issued_at > $2', [ip, iso(now - DAY)]);
        if (Number(byIp.rows[0]?.n) >= OTP_MAX_PER_IP_24H) throw new AppError('rate_limited', 'Trop de demandes depuis ce réseau. Réessayez plus tard.', 3600);
      }
      const code = randomDigits(OTP_USER_LENGTH);
      const id = (
        await t.query<{ id: string }>(
          `insert into otp_codes(subject, channel, purpose, code_hash, device_key, ip, issued_at) values ($1,'whatsapp',$2,$3,$4,$5,$6) returning id`,
          [phone, input.purpose, otpDigest(code, phone, this.deps.secrets.pepper), input.device.deviceId, ip, iso(now)],
        )
      ).rows[0]!.id;
      return { id, code };
    });

    try {
      await this.deps.providers.messages.sendWhatsAppOtp(phone, row.code);
    } catch {
      // Aucun code n'a été délivré : on ne le compte pas dans le quota de l'utilisateur.
      await this.deps.db.query('delete from otp_codes where id = $1', [row.id]);
      throw new AppError('internal', "Impossible d'envoyer le code pour le moment. Réessayez dans quelques minutes.");
    }
    return { sent: true, expiresInSeconds: OTP_TTL_MS / 1000 };
  }

  /**
   * Valide le code. Les 4 saisies maximum sont comptées de façon ATOMIQUE avant la comparaison,
   * et la consommation est à usage unique : deux requêtes parallèles ne peuvent pas dépasser
   * le plafond ni réutiliser un code.
   */
  async verifyOtp(input: VerifyOtp): Promise<VerifyOtpResult> {
    const phone = normalizePhone(input.country, input.phone);
    if (!phone) throw new AppError('validation', 'Numéro WhatsApp invalide pour ce pays.');
    const now = this.now;
    const db = this.deps.db;

    const latest = (
      await db.query<{ id: string; code_hash: string; issued_at: Date; attempts: number; consumed_at: Date | null; purpose: string }>(
        'select id, code_hash, issued_at, attempts, consumed_at, purpose from otp_codes where subject = $1 order by issued_at desc limit 1',
        [phone],
      )
    ).rows[0];
    if (!latest || latest.purpose !== input.purpose) throw new AppError('otp_invalid', 'Code incorrect ou expiré. Demandez un nouveau code.');

    const state = checkOtpState({ issuedAt: latest.issued_at.getTime(), attempts: latest.attempts, consumed: latest.consumed_at !== null }, now);
    if (state === 'expired') throw new AppError('otp_expired', 'Ce code a expiré. Demandez un nouveau code.');
    if (state === 'already_used') throw new AppError('otp_invalid', 'Ce code a déjà été utilisé.');
    if (state === 'too_many_attempts') throw new AppError('otp_exhausted', 'Trop d\'essais. Demandez un nouveau code.');

    // Comptage atomique de la saisie (la condition `attempts < max` est vérifiée par la base).
    const counted = await db.query<{ attempts: number }>(
      'update otp_codes set attempts = attempts + 1 where id = $1 and attempts < $2 and consumed_at is null returning attempts',
      [latest.id, OTP_MAX_ATTEMPTS],
    );
    if (counted.rows.length === 0) throw new AppError('otp_exhausted', 'Trop d\'essais. Demandez un nouveau code.');

    if (!safeEqualHex(otpDigest(input.code, phone, this.deps.secrets.pepper), latest.code_hash)) {
      const left = OTP_MAX_ATTEMPTS - (counted.rows[0]?.attempts ?? OTP_MAX_ATTEMPTS);
      if (left <= 0) throw new AppError('otp_exhausted', 'Trop d\'essais. Demandez un nouveau code.');
      throw new AppError('otp_invalid', `Code incorrect. Il vous reste ${left} essai${left > 1 ? 's' : ''}.`);
    }

    const consumed = await db.query('update otp_codes set consumed_at = $2 where id = $1 and consumed_at is null returning id', [latest.id, iso(now)]);
    if (consumed.rows.length === 0) throw new AppError('otp_invalid', 'Ce code a déjà été utilisé.');

    const user = (await db.query<UserRow>('select * from users where phone = $1', [phone])).rows[0];

    // PIN oublié, ou numéro sans compte : il faut créer un PIN (preuve à usage unique).
    if (input.purpose === 'pin_reset' || !user) {
      const proof = randomToken();
      await db.query('insert into otp_proofs(token_hash, subject, purpose, device_key, expires_at) values ($1,$2,$3,$4,$5)', [
        sha256(proof),
        phone,
        user ? 'pin_reset' : 'signup',
        input.device.deviceId,
        iso(now + PROOF_TTL_MS),
      ]);
      return { kind: 'pin_required', proof, mode: user ? 'reset' : 'create' };
    }

    // Compte existant, nouvel appareil : accès après validation du numéro (§4.3).
    const device = await this.registerDevice(db, user.id, input.device);
    const session = await this.issueSession(db, user, device);
    const others = (
      await db.query<{ id: string; label: string | null; last_seen_at: Date }>(
        'select id, label, last_seen_at from devices where user_id = $1 and id <> $2 and revoked_at is null',
        [user.id, device],
      )
    ).rows;
    if (others.length > 0) {
      // Notification à l'ancien appareil (§4.3, §9.2) — jamais de contenu sensible.
      await this.deps.providers.push.sendToUser(user.id, { type: 'new_device' }, { excludeDeviceId: device }).catch(() => undefined);
    }
    return { kind: 'session', session, otherDevices: others.map((o) => ({ id: o.id, label: o.label, lastSeenAt: o.last_seen_at.toISOString() })) };
  }

  // --- PIN ----------------------------------------------------------------------------------

  async createPin(input: CreatePin): Promise<IssuedSession> {
    const now = this.now;
    const proofHash = sha256(input.otpProof);
    const pinHash = await hashSecret(input.pin, this.deps.secrets.pepper);

    return this.deps.db.tx(async (t) => {
      // Consommation atomique : une preuve ne sert qu'une fois, pour le même appareil.
      const proof = (
        await t.query<{ subject: string; purpose: string }>(
          `update otp_proofs set consumed_at = $2 where token_hash = $1 and consumed_at is null and expires_at > $2 and device_key = $3 returning subject, purpose`,
          [proofHash, iso(now), input.device.deviceId],
        )
      ).rows[0];
      if (!proof) throw new AppError('unauthenticated', 'Validation expirée. Recommencez avec votre numéro.');

      let user = (await t.query<UserRow>('select * from users where phone = $1 for update', [proof.subject])).rows[0];
      if (!user) {
        const country = countryOfPhone(proof.subject);
        if (!country) throw new AppError('validation', 'Pays non pris en charge.');
        user = (
          await t.query<UserRow>('insert into users(phone, country, pin_hash, created_at) values ($1,$2,$3,$4) returning *', [proof.subject, country, pinHash, iso(now)])
        ).rows[0]!;
      } else {
        // PIN oublié : nouveau PIN, état de blocage remis à zéro, autres sessions coupées (§4.2).
        await t.query('update users set pin_hash = $2, pin_failed_attempts = 0, pin_lock_count = 0, pin_locked_until = null where id = $1', [user.id, pinHash]);
        await t.query('update user_sessions set revoked_at = $2 where user_id = $1 and revoked_at is null', [user.id, iso(now)]);
      }
      const device = await this.registerDevice(t, user.id, input.device);
      return this.issueSession(t, user, device);
    });
  }

  /**
   * Connexion par PIN sur un appareil DÉJÀ connu. Le blocage est appliqué ici, côté serveur :
   * pendant un blocage le PIN n'est même pas comparé (pas de test gratuit), et l'état est
   * verrouillé en base (`for update`) pour résister aux essais parallèles.
   */
  async loginPin(input: LoginPin): Promise<IssuedSession> {
    const now = this.now;
    type Outcome = { ok: true; session: IssuedSession } | { ok: false; error: AppError };
    // IMPORTANT : l'échec est RETOURNÉ par la transaction puis levé APRÈS le commit. Lever dans la
    // transaction l'annulerait et effacerait le compteur d'erreurs : le blocage ne s'appliquerait jamais.
    const outcome = await this.deps.db.tx<Outcome>(async (t) => {
      const user = (await t.query<UserRow>('select * from users where phone = $1 for update', [input.phone])).rows[0];
      if (!user || !user.pin_hash) {
        await verifySecret(input.pin, 'x$x$x', this.deps.secrets.pepper).catch(() => false); // coût comparable
        return { ok: false, error: new AppError('unauthenticated', 'Numéro ou PIN incorrect.') };
      }
      const state = toPinState(user);
      const lockedError = (s: PinState) =>
        new AppError('locked', 'Trop d\'erreurs. Réessayez après le délai indiqué.', Math.ceil(pinRetryAfterMs(s, now) / 1000));
      if (isPinLocked(state, now)) return { ok: false, error: lockedError(state) };

      const knownDevice = (
        await t.query<{ id: string }>('select id from devices where user_id = $1 and device_key = $2 and revoked_at is null', [user.id, input.device.deviceId])
      ).rows[0];
      if (!knownDevice) return { ok: false, error: new AppError('unauthenticated', 'Appareil non reconnu. Validez votre numéro par WhatsApp.') };

      const ok = await verifySecret(input.pin, user.pin_hash, this.deps.secrets.pepper);
      if (!ok) {
        const next = registerPinFailure(state, now);
        await savePinState(t, user.id, next);
        return { ok: false, error: isPinLocked(next, now) ? lockedError(next) : new AppError('unauthenticated', 'Numéro ou PIN incorrect.') };
      }
      await savePinState(t, user.id, registerPinSuccess());
      await t.query('update devices set last_seen_at = $2 where id = $1', [knownDevice.id, iso(now)]);
      return { ok: true, session: await this.issueSession(t, user, knownDevice.id) };
    });
    if (!outcome.ok) throw outcome.error;
    return outcome.session;
  }

  // --- Sessions et appareils ----------------------------------------------------------------

  private async registerDevice(db: Db, userId: string, device: { deviceId: string; label?: string | undefined }): Promise<string> {
    const now = iso(this.now);
    const row = (
      await db.query<{ id: string }>(
        `insert into devices(user_id, device_key, label, first_seen_at, last_seen_at) values ($1,$2,$3,$4,$4)
         on conflict (user_id, device_key) do update set last_seen_at = excluded.last_seen_at, revoked_at = null
         returning id`,
        [userId, device.deviceId, device.label ?? null, now],
      )
    ).rows[0]!;
    return row.id;
  }

  private async issueSession(db: Db, user: UserRow, deviceId: string): Promise<IssuedSession> {
    const token = randomToken();
    const expires = this.now + this.deps.config.userSessionDays * DAY;
    await db.query('insert into user_sessions(user_id, device_id, token_hash, created_at, expires_at) values ($1,$2,$3,$4,$5)', [
      user.id,
      deviceId,
      sha256(token),
      iso(this.now),
      iso(expires),
    ]);
    return { token, expiresAt: iso(expires), user: toUser(user), deviceId };
  }

  /** Résout un jeton de session ; `null` si absent, révoqué ou expiré. */
  async resolveSession(token: string): Promise<{ user: SessionUser; deviceId: string } | null> {
    const row = (
      await this.deps.db.query<UserRow & { device_id: string }>(
        `select u.*, s.device_id from user_sessions s
           join users u on u.id = s.user_id
           join devices d on d.id = s.device_id
          where s.token_hash = $1 and s.revoked_at is null and s.expires_at > $2 and d.revoked_at is null`,
        [sha256(token), iso(this.now)],
      )
    ).rows[0];
    return row ? { user: toUser(row), deviceId: row.device_id } : null;
  }

  async logout(token: string): Promise<void> {
    await this.deps.db.query('update user_sessions set revoked_at = $2 where token_hash = $1 and revoked_at is null', [sha256(token), iso(this.now)]);
  }

  /** « L'application propose ensuite de déconnecter l'ancien appareil » (§4.3). */
  async logoutOtherDevices(userId: string, currentDeviceId: string): Promise<number> {
    const now = iso(this.now);
    await this.deps.db.query('update user_sessions set revoked_at = $3 where user_id = $1 and device_id <> $2 and revoked_at is null', [userId, currentDeviceId, now]);
    const r = await this.deps.db.query('update devices set revoked_at = $3 where user_id = $1 and id <> $2 and revoked_at is null returning id', [userId, currentDeviceId, now]);
    return r.rows.length;
  }

  /**
   * Étape « Identité » (§4.1) + code de parrainage optionnel. Le code doit désigner un agent ou un
   * influenceur ACTIF ; il est retenu sur le compte et rattaché au premier business créé (D-018).
   */
  async updateProfile(userId: string, name: string, referralCode?: string): Promise<void> {
    await this.deps.db.tx(async t => {
    let code: string | null = null;
    if (referralCode) {
      code = referralCode.trim().toUpperCase();
      const ok = await t.query(`select 1 from partners where promo_code = $1 and status = 'active' and role in ('agent','influencer') for update`, [code]);
      if (ok.rows.length === 0) throw new AppError('validation', 'Code de parrainage inconnu.');
    }
    await t.query('update users set name = $2, referral_partner_code = coalesce(referral_partner_code, $3) where id = $1', [userId, name, code]);
    });
  }

  static countryDial(country: CountryCode): string {
    return COUNTRIES[country].dialCode;
  }
}

function toPinState(u: UserRow): PinState {
  return {
    failedAttempts: u.pin_failed_attempts,
    lockCount: u.pin_lock_count,
    lockedUntil: u.pin_locked_until ? u.pin_locked_until.getTime() : null,
  };
}

async function savePinState(db: Db, userId: string, s: PinState): Promise<void> {
  await db.query('update users set pin_failed_attempts = $2, pin_lock_count = $3, pin_locked_until = $4 where id = $1', [
    userId,
    s.failedAttempts,
    s.lockCount,
    s.lockedUntil === null ? null : iso(s.lockedUntil),
  ]);
}

export { INITIAL_PIN_STATE };

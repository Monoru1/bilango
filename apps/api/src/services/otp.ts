import { checkOtpState, evaluateOtpIssue, OTP_MAX_ATTEMPTS, OTP_PARTNER_LENGTH } from '@gobilan/domain';
import { iso } from '../clock';
import { otpDigest, randomDigits, safeEqualHex } from '../crypto';
import type { Db } from '../db';
import type { Deps } from '../deps';
import { AppError } from '../errors';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Codes à 6 chiffres envoyés par e-mail (mot de passe oublié des partenaires, 2e facteur admin).
 * Mêmes limites que l'OTP WhatsApp : 4 saisies, 2 codes / 24 h, usage unique, 10 minutes (§10.1).
 */
export async function issueEmailCode(deps: Deps, subject: string, purpose: string, opts: { enforceQuota: boolean }): Promise<{ id: string; code: string }> {
  const now = deps.clock.now();
  return deps.db.tx(async (t) => {
    await t.query('select pg_advisory_xact_lock(hashtext($1))', [`otp:${subject}`]);
    if (opts.enforceQuota) {
      const issued = (await t.query<{ issued_at: Date }>('select issued_at from otp_codes where subject = $1 and purpose = $2 and issued_at > $3', [subject, purpose, iso(now - DAY)])).rows.map((r) => r.issued_at.getTime());
      const d = evaluateOtpIssue(issued, now);
      if (!d.allowed) {
        throw new AppError('otp_quota', 'Limite de codes atteinte pour 24 heures. Contactez le support : contact@gobilan.com', Math.max(1, Math.ceil(((d.retryAt as number) - now) / 1000)));
      }
    }
    const code = randomDigits(OTP_PARTNER_LENGTH);
    const row = (
      await t.query<{ id: string }>(
        `insert into otp_codes(subject, channel, purpose, code_hash, issued_at) values ($1,'email',$2,$3,$4) returning id`,
        [subject, purpose, otpDigest(code, subject, deps.secrets.pepper), iso(now)],
      )
    ).rows[0]!;
    return { id: row.id, code };
  });
}

/** Vérifie un code e-mail : comptage atomique des saisies, usage unique, expiration. */
export async function verifyEmailCode(db: Db, deps: Deps, subject: string, purpose: string, code: string): Promise<void> {
  const now = deps.clock.now();
  const latest = (
    await db.query<{ id: string; code_hash: string; issued_at: Date; attempts: number; consumed_at: Date | null }>(
      'select id, code_hash, issued_at, attempts, consumed_at from otp_codes where subject = $1 and purpose = $2 order by issued_at desc limit 1',
      [subject, purpose],
    )
  ).rows[0];
  if (!latest) throw new AppError('otp_invalid', 'Code incorrect ou expiré.');
  const state = checkOtpState({ issuedAt: latest.issued_at.getTime(), attempts: latest.attempts, consumed: latest.consumed_at !== null }, now);
  if (state === 'expired') throw new AppError('otp_expired', 'Ce code a expiré. Demandez-en un nouveau.');
  if (state === 'already_used') throw new AppError('otp_invalid', 'Ce code a déjà été utilisé.');
  if (state === 'too_many_attempts') throw new AppError('otp_exhausted', 'Trop d\'essais. Demandez un nouveau code.');
  const counted = await db.query<{ attempts: number }>('update otp_codes set attempts = attempts + 1 where id = $1 and attempts < $2 and consumed_at is null returning attempts', [latest.id, OTP_MAX_ATTEMPTS]);
  if (counted.rows.length === 0) throw new AppError('otp_exhausted', 'Trop d\'essais. Demandez un nouveau code.');
  if (!safeEqualHex(otpDigest(code, subject, deps.secrets.pepper), latest.code_hash)) {
    const left = OTP_MAX_ATTEMPTS - (counted.rows[0]?.attempts ?? OTP_MAX_ATTEMPTS);
    throw new AppError(left <= 0 ? 'otp_exhausted' : 'otp_invalid', left <= 0 ? 'Trop d\'essais. Demandez un nouveau code.' : `Code incorrect. Il vous reste ${left} essai${left > 1 ? 's' : ''}.`);
  }
  const used = await db.query('update otp_codes set consumed_at = $2 where id = $1 and consumed_at is null returning id', [latest.id, iso(now)]);
  if (used.rows.length === 0) throw new AppError('otp_invalid', 'Ce code a déjà été utilisé.');
}

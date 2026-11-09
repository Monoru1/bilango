import { randomInt } from 'node:crypto';
import { canGenerateOwnerReferralCode } from '@gobilan/domain';
import type { Deps } from '../deps';
import { AppError } from '../errors';
import type { SessionUser } from './auth';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

/** Attribution du code personnel après paiement confirmé. Récompenses non encore activées. */
export class OwnerReferralService {
  constructor(private readonly deps: Deps) {}

  async generate(actor: SessionUser): Promise<{ code: string; active: boolean }> {
    return this.deps.db.tx(async (t) => {
      await t.query('select id from users where id=$1 for update', [actor.id]);
      const existing = await t.query<{ code: string; active: boolean }>('select code,active from owner_referral_codes where owner_id=$1', [actor.id]);
      if (existing.rows[0]) return existing.rows[0];
      const paid = await t.query(`select 1 from payments p join businesses b on b.id=p.business_id where b.owner_id=$1 and p.status='confirmed' limit 1`, [actor.id]);
      if (!canGenerateOwnerReferralCode(paid.rows.length > 0)) throw new AppError('forbidden', 'Un premier abonnement payé est nécessaire.');
      for (let i = 0; i < 10; i++) {
        const code = randomCode();
        const reserved = await t.query("insert into referral_code_registry(code,kind) values($1,'owner') on conflict do nothing returning code", [code]);
        if (!reserved.rows.length) continue;
        const result = await t.query<{ code: string; active: boolean }>(
          'insert into owner_referral_codes(owner_id,code,created_at) values($1,$2,$3) returning code,active',
          [actor.id, code, new Date(this.deps.clock.now()).toISOString()],
        );
        return result.rows[0]!;
      }
      throw new AppError('internal', 'Génération momentanément indisponible.');
    });
  }
}

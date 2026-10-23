import { pushPayloadSchema, type PushSubscriptionInput } from '@gobilan/contracts';
import type { Clock } from '../clock';
import { iso } from '../clock';
import type { Db } from '../db';
import type { Deps } from '../deps';
import { AppError } from '../errors';
import type { PushPayload, PushSendOptions, PushSender, PushTransport } from '../providers';
import type { SessionUser } from './auth';

/** Nombre d'échecs consécutifs (hors 404/410, révoqués aussitôt) avant de cesser d'utiliser un abonnement. */
export const PUSH_MAX_FAILURES = 5;
/** Abonnements actifs conservés par utilisateur (téléphones successifs) ; les plus anciens sont révoqués. */
export const PUSH_MAX_ACTIVE_PER_USER = 10;

/** Enregistrement / retrait des abonnements Web Push de l'utilisateur connecté (cahier §9). */
export class PushService {
  constructor(private readonly deps: Deps) {}

  async register(actor: SessionUser, deviceId: string, input: PushSubscriptionInput, userAgent: string | undefined): Promise<{ ok: true }> {
    const now = iso(this.deps.clock.now());
    await this.deps.db.tx(async (t) => {
      // Un point d'accès Web Push est un secret de capacité. S'il appartient déjà à un AUTRE compte, il n'est
      // repris que si les clés de chiffrement sont identiques (même navigateur, nouvelle connexion) : sinon un
      // tiers pourrait « voler » l'abonnement d'autrui, ou le rendre illisible en y plaçant ses propres clés.
      const row = (
        await t.query<{ id: string }>(
          `insert into push_subscriptions(user_id, device_id, endpoint, p256dh, auth, user_agent, created_at)
           values ($1,$2,$3,$4,$5,$6,$7)
           on conflict (endpoint) do update set
             user_id = excluded.user_id, device_id = excluded.device_id, p256dh = excluded.p256dh, auth = excluded.auth,
             user_agent = excluded.user_agent, revoked_at = null, failure_count = 0
           where push_subscriptions.user_id = excluded.user_id
              or (push_subscriptions.p256dh = excluded.p256dh and push_subscriptions.auth = excluded.auth)
           returning id`,
          [actor.id, deviceId, input.endpoint, input.keys.p256dh, input.keys.auth, userAgent?.slice(0, 200) ?? null, now],
        )
      ).rows[0];
      if (!row) throw new AppError('conflict', 'Cet abonnement ne peut pas être enregistré.');
      await t.query(
        `update push_subscriptions set revoked_at = $2
          where user_id = $1 and revoked_at is null
            and id not in (select id from push_subscriptions where user_id = $1 and revoked_at is null order by created_at desc, id limit ${PUSH_MAX_ACTIVE_PER_USER})`,
        [actor.id, now],
      );
    });
    return { ok: true };
  }

  /** Retrait volontaire (désactivation des notifications). Sans effet sur l'abonnement d'un autre compte. */
  async unregister(actor: SessionUser, endpoint: string): Promise<{ ok: true }> {
    await this.deps.db.query(`update push_subscriptions set revoked_at = $3 where user_id = $1 and endpoint = $2 and revoked_at is null`, [
      actor.id,
      endpoint,
      iso(this.deps.clock.now()),
    ]);
    return { ok: true };
  }
}

/**
 * Expéditeur adossé à la base : lit les abonnements actifs de l'utilisateur et les livre via un
 * `PushTransport`. Règles de livraison :
 *  - 2xx : succès, compteur d'échecs remis à zéro ;
 *  - 404 / 410 : abonnement expiré côté navigateur, révoqué immédiatement ;
 *  - autre échec ou exception : compteur incrémenté, abonnement révoqué après `PUSH_MAX_FAILURES`.
 * Ne lève JAMAIS : une notification manquée ne doit jamais faire échouer un bilan ou un paiement.
 */
export class DbPushSender implements PushSender {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly transport: PushTransport,
  ) {}

  async sendToUser(userId: string, payload: PushPayload, opts: PushSendOptions = {}): Promise<void> {
    try {
      // Le schéma retire tout champ inattendu : rien d'autre que type / nom du business / badge ne part.
      const body = JSON.stringify(pushPayloadSchema.parse(payload));
      const subs = (
        await this.db.query<{ id: string; endpoint: string; p256dh: string; auth: string }>(
          `select id, endpoint, p256dh, auth from push_subscriptions
            where user_id = $1 and revoked_at is null and ($2::uuid is null or device_id is distinct from $2::uuid)`,
          [userId, opts.excludeDeviceId ?? null],
        )
      ).rows;
      await Promise.all(subs.map((s) => this.deliver(s, body)));
    } catch {
      /* volontairement silencieux : voir la documentation de la méthode */
    }
  }

  private async deliver(sub: { id: string; endpoint: string; p256dh: string; auth: string }, body: string): Promise<void> {
    let status = 0;
    try {
      status = (await this.transport.send({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, body)).status;
    } catch {
      status = 0;
    }
    const now = iso(this.clock.now());
    try {
      if (status >= 200 && status < 300) {
        await this.db.query('update push_subscriptions set last_success_at = $2, failure_count = 0 where id = $1', [sub.id, now]);
      } else if (status === 404 || status === 410) {
        await this.db.query('update push_subscriptions set revoked_at = $2 where id = $1 and revoked_at is null', [sub.id, now]);
      } else {
        await this.db.query(
          `update push_subscriptions set failure_count = failure_count + 1,
             revoked_at = case when failure_count + 1 >= $3 then $2::timestamptz else revoked_at end
           where id = $1`,
          [sub.id, now, PUSH_MAX_FAILURES],
        );
      }
    } catch {
      /* la base indisponible ne doit pas casser l'opération métier appelante */
    }
  }
}

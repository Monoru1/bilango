import {
  daysRemaining,
  extendedPaidUntil,
  SUBSCRIPTION_PRICE_FCFA,
  subscriptionPopup,
  subscriptionStatus,
} from '@gobilan/domain';
import { fedapayWebhookSchema } from '@gobilan/contracts';
import { iso } from '../clock';
import { randomToken, verifyFedapaySignature } from '../crypto';
import type { Deps } from '../deps';
import { AppError, forbidden } from '../errors';
import { requireAccess, subscriptionOf } from './access';
import { recordCommissionsForPayment, reverseCommissionsForPayment } from './commission-ledger';
import type { SessionUser } from './auth';

export type WebhookOutcome = 'confirmed' | 'duplicate' | 'ignored' | 'failed' | 'refunded';

export class SubscriptionService {
  constructor(private readonly deps: Deps) {}

  private get now() {
    return this.deps.clock.now();
  }

  /** Vue propriétaire : statut, jours restants, pop-up à afficher, historique des paiements (§7.4, §8.3). */
  async view(actor: SessionUser, businessId: string) {
    const ctx = await requireAccess(this.deps.db, actor.id, businessId);
    if (!ctx.access.isOwner) throw forbidden(); // viewSubscription : propriétaire uniquement
    const sub = subscriptionOf(ctx.business);
    const payments = (
      await this.deps.db.query<{ id: string; confirmed_at: Date; amount: string; provider: string | null; merchant_reference: string }>(
        `select id, confirmed_at, amount, provider, merchant_reference from payments where business_id = $1 and status = 'confirmed' order by confirmed_at desc`,
        [businessId],
      )
    ).rows;
    return {
      businessId,
      status: subscriptionStatus(sub, this.now),
      endsAt: sub.paidUntil && sub.trialEndsAt ? (sub.paidUntil > sub.trialEndsAt ? sub.paidUntil : sub.trialEndsAt) : (sub.paidUntil ?? sub.trialEndsAt),
      daysRemaining: daysRemaining(sub, this.now),
      popup: subscriptionPopup(sub, this.now),
      payments: payments.map((p) => ({ id: p.id, paidAt: p.confirmed_at.toISOString(), amount: Number(p.amount), provider: p.provider ?? '', reference: p.merchant_reference })),
    };
  }

  /**
   * Crée la transaction côté SERVEUR. `merchant_reference` unique et jamais réutilisé ; le
   * business et le type d'opération voyagent dans `custom_metadata` (§8.2). Rien n'est prolongé ici.
   */
  async createCheckout(actor: SessionUser, businessId: string) {
    const ctx = await requireAccess(this.deps.db, actor.id, businessId);
    if (!ctx.access.isOwner) throw forbidden();
    const reference = `SUB-${businessId}-${iso(this.now).slice(0, 7)}-${randomToken(6)}`;
    const payment = (
      await this.deps.db.query<{ id: string }>(
        `insert into payments(business_id, merchant_reference, status, amount, created_at) values ($1,$2,'pending',$3,$4) returning id`,
        [businessId, reference, SUBSCRIPTION_PRICE_FCFA, iso(this.now)],
      )
    ).rows[0]!;
    try {
      const tx = await this.deps.providers.gateway.createTransaction({
        merchantReference: reference,
        amount: SUBSCRIPTION_PRICE_FCFA,
        country: ctx.business.country,
        description: `Abonnement GoBilan — ${ctx.business.name} (30 jours)`,
        metadata: { business_id: businessId, type: 'renouvellement_abonnement' },
      });
      await this.deps.db.query('update payments set fedapay_transaction_id = $2 where id = $1', [payment.id, tx.transactionId]);
      return { merchantReference: reference, paymentUrl: tx.paymentUrl };
    } catch {
      await this.deps.db.query(`update payments set status = 'failed' where id = $1 and status = 'pending'`, [payment.id]);
      throw new AppError('internal', 'Paiement momentanément indisponible. Réessayez dans quelques minutes.');
    }
  }

  /**
   * Webhook FedaPay. Règles :
   *  1. signature vérifiée sur le CORPS BRUT (sinon rejet, rien n'est lu) ;
   *  2. idempotence par identifiant d'évènement ET par référence marchande ;
   *  3. le paiement est RE-VÉRIFIÉ auprès de la passerelle (jamais cru sur la seule charge utile) ;
   *  4. montant, business et mode (test/live) doivent correspondre à la transaction créée par le serveur ;
   *  5. prolongation + commissions dans UNE transaction SQL verrouillée sur la ligne de paiement.
   */
  async handleWebhook(rawBody: string, signatureHeader: string | undefined): Promise<WebhookOutcome> {
    if (!verifyFedapaySignature(rawBody, signatureHeader, this.deps.secrets.fedapayWebhookSecret, this.now)) {
      throw new AppError('unauthenticated', 'Signature invalide.');
    }
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new AppError('validation', 'Corps invalide.');
    }
    const parsed = fedapayWebhookSchema.safeParse(json);
    if (!parsed.success) throw new AppError('validation', 'Évènement invalide.');
    const event = parsed.data;

    // Idempotence : un évènement DÉJÀ TRAITÉ est un doublon. Un évènement reçu mais non traité (panne
    // passerelle, erreur 500) doit pouvoir être rejoué par FedaPay, sinon le paiement serait perdu.
    await this.deps.db.query(
      'insert into webhook_events(event_id, received_at, payload) values ($1,$2,$3::jsonb) on conflict (event_id) do nothing',
      [event.id, iso(this.now), rawBody],
    );
    const seen = (await this.deps.db.query<{ processed_at: Date | null }>('select processed_at from webhook_events where event_id = $1', [event.id])).rows[0];
    if (seen?.processed_at) return 'duplicate';

    const mode = event.entity.mode;
    const expectedMode = this.deps.config.fedapayMode === 'live' ? 'live' : 'test';
    if (mode && mode !== expectedMode) return this.finish(event.id, 'ignored');

    const reference = event.entity.merchant_reference;
    if (!reference) return this.finish(event.id, 'ignored');
    const payment = (
      await this.deps.db.query<{ id: string; business_id: string; status: string; amount: string; fedapay_transaction_id: string | null }>(
        'select id, business_id, status, amount, fedapay_transaction_id from payments where merchant_reference = $1',
        [reference],
      )
    ).rows[0];
    if (!payment) return this.finish(event.id, 'ignored');

    if (event.name === 'transaction.approved') {
      if (event.entity.custom_metadata?.business_id !== payment.business_id) return this.finish(event.id, 'ignored');
      const remote = await this.deps.providers.gateway.getTransaction(event.entity.id);
      if (!remote) throw new AppError('internal', 'Vérification passerelle indisponible : réessayez.'); // FedaPay renverra l'évènement
      if (remote.status !== 'approved' || remote.merchantReference !== reference || remote.amount !== Number(payment.amount)) {
        return this.finish(event.id, 'ignored');
      }
      return this.finish(event.id, await this.confirm(payment.id, event.entity.id, remote.provider));
    }
    if (event.name === 'transaction.declined' || event.name === 'transaction.canceled') {
      await this.deps.db.query(`update payments set status = $2 where id = $1 and status = 'pending'`, [payment.id, event.name === 'transaction.declined' ? 'failed' : 'cancelled']);
      return this.finish(event.id, 'failed');
    }
    if (event.name === 'transaction.refunded' || event.name === 'transaction.disputed') {
      await this.deps.db.tx(async (t) => {
        await t.query(`update payments set status = $2 where id = $1 and status = 'confirmed'`, [payment.id, event.name === 'transaction.refunded' ? 'refunded' : 'disputed']);
        await reverseCommissionsForPayment(t, payment.id, event.name.split('.')[1] ?? 'refund', this.now);
      });
      return this.finish(event.id, 'refunded');
    }
    return this.finish(event.id, 'ignored');
  }

  private async finish(eventId: string, outcome: WebhookOutcome): Promise<WebhookOutcome> {
    await this.deps.db.query('update webhook_events set processed_at = $2 where event_id = $1', [eventId, iso(this.now)]);
    return outcome;
  }

  /** Confirmation idempotente : une seconde confirmation du même paiement ne prolonge PAS deux fois. */
  private async confirm(paymentId: string, transactionId: string, provider: string | null): Promise<WebhookOutcome> {
    return this.deps.db.tx(async (t) => {
      const p = (
        await t.query<{ id: string; business_id: string; status: string; amount: string }>('select id, business_id, status, amount from payments where id = $1 for update', [paymentId])
      ).rows[0]!;
      if (p.status === 'confirmed') return 'duplicate' as const;
      if (p.status !== 'pending') return 'ignored' as const;

      const biz = (await t.query<{ id: string; trial_ends_at: Date | null; paid_until: Date | null }>('select id, trial_ends_at, paid_until from businesses where id = $1 for update', [p.business_id])).rows[0]!;
      const sub = subscriptionOf(biz);
      const statusBefore = subscriptionStatus(sub, this.now);
      const until = extendedPaidUntil(sub, this.now);
      await t.query(`update businesses set paid_until = $2 where id = $1`, [biz.id, until]);
      await t.query(`update payments set status = 'confirmed', confirmed_at = $2, extended_until = $3, provider = $4, fedapay_transaction_id = coalesce(fedapay_transaction_id, $5) where id = $1`, [p.id, iso(this.now), until, provider, transactionId]);
      await recordCommissionsForPayment(t, { id: p.id, businessId: p.business_id, confirmedAt: this.now, amount: Number(p.amount) }, statusBefore);
      await this.deps.providers.push.sendToUser((await t.query<{ owner_id: string }>('select owner_id from businesses where id = $1', [biz.id])).rows[0]!.owner_id, { title: 'GoBilan', body: 'Paiement reçu. Merci !' }).catch(() => undefined);
      return 'confirmed' as const;
    });
  }

  /**
   * Vérification périodique de secours (§8.2, par exemple toutes les heures) : interroge la
   * passerelle pour les paiements restés en attente et applique le même traitement qu'un webhook.
   */
  async reconcilePending(olderThanMs = 5 * 60 * 1000): Promise<{ checked: number; confirmed: number }> {
    const rows = (
      await this.deps.db.query<{ id: string; fedapay_transaction_id: string; merchant_reference: string; amount: string }>(
        `select id, fedapay_transaction_id, merchant_reference, amount from payments where status = 'pending' and fedapay_transaction_id is not null and created_at < $1`,
        [iso(this.now - olderThanMs)],
      )
    ).rows;
    let confirmed = 0;
    for (const r of rows) {
      const remote = await this.deps.providers.gateway.getTransaction(r.fedapay_transaction_id).catch(() => null);
      if (!remote) continue;
      if (remote.status === 'approved' && remote.merchantReference === r.merchant_reference && remote.amount === Number(r.amount)) {
        if ((await this.confirm(r.id, r.fedapay_transaction_id, remote.provider)) === 'confirmed') confirmed++;
      } else if (remote.status === 'declined' || remote.status === 'canceled') {
        await this.deps.db.query(`update payments set status = $2 where id = $1 and status = 'pending'`, [r.id, remote.status === 'declined' ? 'failed' : 'cancelled']);
      }
    }
    return { checked: rows.length, confirmed };
  }
}

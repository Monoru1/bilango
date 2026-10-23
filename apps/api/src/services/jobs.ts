import { COUNTRIES, REMINDER_DAYS_BEFORE, daysRemaining, subscriptionStatus, toDayKey, type CountryCode } from '@gobilan/domain';
import { iso } from '../clock';
import type { Deps } from '../deps';
import { subscriptionOf } from './access';
import { SubscriptionService } from './subscriptions';

/** Fenêtre d'envoi du rappel quotidien : à partir de l'heure choisie, pendant 3 h (pas de rappel périmé après un redémarrage). */
export const REMINDER_WINDOW_MINUTES = 180;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export interface JobSummary {
  reconcile: { checked: number; confirmed: number } | null;
  reminders: number;
  expiring: number;
  errors: string[];
}

interface BusinessRow {
  id: string;
  owner_id: string;
  name: string;
  country: CountryCode;
  reminder_time: string;
  trial_ends_at: Date | null;
  paid_until: Date | null;
}

const toMinutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Tâches périodiques (cahier §8.2 rapprochement, §9 notifications). Chaque tâche est idempotente :
 * l'exécuter deux fois, ou depuis deux instances, n'envoie pas deux notifications (clé de
 * déduplication unique en base) et ne confirme pas deux fois un paiement (verrou sur la ligne).
 */
export class ScheduledJobs {
  constructor(private readonly deps: Deps) {}

  private get now() {
    return this.deps.clock.now();
  }

  /**
   * Rappel « pensez à faire le bilan » (§6.7, §9.2) : destiné au MANAGER, c'est-à-dire aux membres non propriétaires
   * autorisés à saisir (« Saisie seule » ou « Gestion complète »), si aucun bilan n'existe pour le jour du business.
   * Le propriétaire ne reçoit pas ce rappel : son alerte est « bilan envoyé », et l'heure de rappel est SA consigne.
   */
  async sendDailyReminders(): Promise<number> {
    const businesses = (await this.deps.db.query<BusinessRow>('select id, owner_id, name, country, reminder_time, trial_ends_at, paid_until from businesses')).rows;
    let sent = 0;
    for (const b of businesses) {
      const offset = COUNTRIES[b.country].utcOffsetMinutes;
      const localMinutes = Math.floor((((this.now + offset * MINUTE_MS) % DAY_MS) + DAY_MS) % DAY_MS / MINUTE_MS);
      const start = toMinutes(b.reminder_time);
      if (localMinutes < start || localMinutes >= start + REMINDER_WINDOW_MINUTES) continue;
      if (subscriptionStatus(subscriptionOf(b), this.now) === 'blocked') continue; // saisie impossible : pas de rappel
      const day = toDayKey(this.now, offset);
      const done = await this.deps.db.query('select 1 from reports where business_id = $1 and day = $2 limit 1', [b.id, day]);
      if (done.rows.length > 0) continue;
      const recipients = (
        await this.deps.db.query<{ user_id: string }>(
          `select m.user_id from members m left join roles r on r.id = m.role_id
            where m.business_id = $1 and m.status = 'active' and not m.is_owner and r.level in ('entry','full')`,
          [b.id],
        )
      ).rows;
      for (const r of recipients) {
        if (await this.claim(`reminder:${b.id}:${day}:${r.user_id}`, 'reminder', r.user_id, b.id)) {
          await this.deps.providers.push.sendToUser(r.user_id, { type: 'reminder', businessName: b.name });
          sent++;
        }
      }
    }
    return sent;
  }

  /** « Expiration proche » : le propriétaire est prévenu chaque jour de J-3 à J-1 (même seuil que le pop-up, §8.3). */
  async sendExpiryNotices(): Promise<number> {
    const businesses = (await this.deps.db.query<BusinessRow>('select id, owner_id, name, country, reminder_time, trial_ends_at, paid_until from businesses')).rows;
    let sent = 0;
    for (const b of businesses) {
      const sub = subscriptionOf(b);
      const status = subscriptionStatus(sub, this.now);
      if (status !== 'trial' && status !== 'active') continue;
      const left = daysRemaining(sub, this.now);
      if (left < 1 || left > REMINDER_DAYS_BEFORE) continue;
      const day = toDayKey(this.now, COUNTRIES[b.country].utcOffsetMinutes);
      if (await this.claim(`expiring:${b.id}:${day}`, 'expiring', b.owner_id, b.id)) {
        await this.deps.providers.push.sendToUser(b.owner_id, { type: 'expiring', businessName: b.name });
        sent++;
      }
    }
    return sent;
  }

  /**
   * Réserve l'envoi : l'insertion atomique est le verrou de déduplication. Remise AU PLUS UNE FOIS : un échec de
   * livraison ne provoque pas de nouvel essai le même jour (préférable à des notifications répétées).
   */
  private async claim(dedupeKey: string, kind: 'reminder' | 'expiring', userId: string, businessId: string): Promise<boolean> {
    const r = await this.deps.db.query(
      'insert into notification_log(dedupe_key, kind, user_id, business_id, created_at) values ($1,$2,$3,$4,$5) on conflict (dedupe_key) do nothing returning id',
      [dedupeKey, kind, userId, businessId, iso(this.now)],
    );
    return r.rows.length > 0;
  }

  /** Exécute les tâches ; une tâche en échec n'empêche pas les autres. */
  async runOnce(opts: { reconcile?: boolean } = {}): Promise<JobSummary> {
    const summary: JobSummary = { reconcile: null, reminders: 0, expiring: 0, errors: [] };
    const guard = async (name: string, fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (e) {
        summary.errors.push(`${name}: ${e instanceof Error ? e.message : 'erreur'}`);
      }
    };
    if (opts.reconcile ?? true) await guard('reconcile', async () => void (summary.reconcile = await new SubscriptionService(this.deps).reconcilePending()));
    await guard('reminders', async () => void (summary.reminders = await this.sendDailyReminders()));
    await guard('expiring', async () => void (summary.expiring = await this.sendExpiryNotices()));
    return summary;
  }
}

export interface SchedulerOptions {
  /** Cadence de vérification des rappels/expirations (défaut : 1 minute). */
  tickMs?: number;
  /** Cadence du rapprochement FedaPay (défaut : 1 heure, §8.2). */
  reconcileEveryMs?: number;
  onSummary?: (s: JobSummary) => void;
}

/** Démarre l'ordonnanceur en processus. Sans chevauchement ; n'empêche pas l'arrêt du processus. Retourne `stop()`. */
export function startScheduler(deps: Deps, opts: SchedulerOptions = {}): () => void {
  const jobs = new ScheduledJobs(deps);
  const tickMs = opts.tickMs ?? 60_000;
  const reconcileEveryMs = opts.reconcileEveryMs ?? 3_600_000;
  let running = false;
  let lastReconcile = -Infinity;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const now = deps.clock.now();
      const reconcile = now - lastReconcile >= reconcileEveryMs;
      if (reconcile) lastReconcile = now;
      opts.onSummary?.(await jobs.runOnce({ reconcile }));
    } finally {
      running = false;
    }
  };
  // Une erreur inattendue d'un cycle ne doit jamais faire tomber le processus (rejet non géré).
  const safeTick = () => void tick().catch((e) => console.error('[scheduler] cycle en erreur', e instanceof Error ? e.message : e));
  const timer = setInterval(safeTick, tickMs);
  timer.unref();
  safeTick();
  return () => clearInterval(timer);
}

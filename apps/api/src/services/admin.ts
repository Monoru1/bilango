import { COUNTRIES, computePayoutBalances, netOfFees, PAYOUT_THRESHOLD_FCFA, subscriptionStatus, type LedgerEntry, type PartnerRole } from '@gobilan/domain';
import type { z } from 'zod';
import type { adminAllowlistChangeSchema, payoutBlockSchema, excludeReferralSchema, reversePayoutSchema, validatePayoutSchema } from '@gobilan/contracts';
import { iso } from '../clock';
import { decryptField, encryptField, hashSecret, randomToken, sha256, verifySecret } from '../crypto';
import type { Db } from '../db';
import type { Deps } from '../deps';
import { AppError, notFound } from '../errors';
import { subscriptionOf } from './access';
import { reverseCommissionsForReferral } from './commission-ledger';
import { issueEmailCode, verifyEmailCode } from './otp';

const MIN = 60_000;
/** 5 mots de passe erronés -> blocage de 15 minutes (cahier §13.4 : « blocage temporaire », durée D-016). */
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_MS = 15 * MIN;

export interface AdminSession {
  email: string;
}

export class AdminService {
  constructor(private readonly deps: Deps) {}

  private get now() {
    return this.deps.clock.now();
  }

  // --- Authentification : e-mail + mot de passe PUIS code e-mail à CHAQUE connexion (§10.1) ---------

  async startLogin(email: string, password: string): Promise<{ challengeId: string }> {
    const e = email.toLowerCase();
    const now = this.now;
    type Outcome = { ok: true; challengeId: string } | { ok: false; error: AppError };
    const out = await this.deps.db.tx<Outcome>(async (t) => {
      await t.query('select pg_advisory_xact_lock(hashtext($1))', [`admin-login:${e}`]);
      const st = (await t.query<{ failed_attempts: number; locked_until: Date | null }>('select * from admin_login_state where email = $1 for update', [e])).rows[0];
      if (st?.locked_until && st.locked_until.getTime() > now) {
        return { ok: false, error: new AppError('locked', 'Trop de tentatives. Réessayez plus tard.', Math.ceil((st.locked_until.getTime() - now) / 1000)) };
      }
      const admin = (await t.query<{ email: string; password_hash: string | null; active: boolean }>('select email, password_hash, active from admin_users where email = $1', [e])).rows[0];
      // Allowlist : adresse inconnue, désactivée ou sans mot de passe = même réponse qu'un mauvais mot de passe.
      const good = admin?.active && admin.password_hash ? await verifySecret(password, admin.password_hash, this.deps.secrets.pepper) : (await verifySecret(password, 'x$x$x', this.deps.secrets.pepper).catch(() => false), false);
      if (!good) {
        const fails = (st?.failed_attempts ?? 0) + 1;
        const lock = fails >= LOGIN_MAX_FAILS ? iso(now + LOGIN_LOCK_MS) : null;
        await t.query(
          `insert into admin_login_state(email, failed_attempts, locked_until) values ($1,$2,$3)
           on conflict (email) do update set failed_attempts = excluded.failed_attempts, locked_until = excluded.locked_until`,
          [e, lock ? 0 : fails, lock],
        );
        return { ok: false, error: new AppError('unauthenticated', 'Identifiants incorrects.') };
      }
      await t.query('delete from admin_login_state where email = $1', [e]);
      return { ok: true, challengeId: '' };
    });
    if (!out.ok) throw out.error;

    const { id, code } = await issueEmailCode(this.deps, e, 'admin_login', { enforceQuota: false });
    await this.deps.db.query('insert into admin_challenges(id, email, issued_at) values ($1,$2,$3)', [id, e, iso(this.now)]);
    await this.deps.providers.messages.sendEmail(e, { subject: 'Code de connexion GoBilan Admin', text: `Votre code : ${code}\nValable 10 minutes, usage unique.` });
    return { challengeId: id };
  }

  async verifyLogin(challengeId: string, code: string): Promise<{ token: string; admin: AdminSession }> {
    if (!/^[0-9a-f-]{36}$/i.test(challengeId)) throw new AppError('unauthenticated', 'Code incorrect ou expiré.');
    const ch = (await this.deps.db.query<{ email: string; consumed_at: Date | null }>('select email, consumed_at from admin_challenges where id = $1', [challengeId])).rows[0];
    if (!ch) throw new AppError('unauthenticated', 'Code incorrect ou expiré.');
    if (ch.consumed_at) throw new AppError('otp_invalid', 'Ce code a déjà été utilisé.');
    await verifyEmailCode(this.deps.db, this.deps, ch.email, 'admin_login', code, challengeId);
    const allowed = await this.deps.db.query('select 1 from admin_users where email=$1 and active', [ch.email]);
    if (!allowed.rows.length) throw new AppError('unauthenticated', 'Accès administrateur révoqué.');
    await this.deps.db.query('update admin_challenges set consumed_at = $2 where id = $1', [challengeId, iso(this.now)]);
    const token = randomToken();
    await this.deps.db.query('insert into admin_sessions(email, token_hash, created_at, expires_at) values ($1,$2,$3,$4)', [
      ch.email,
      sha256(token),
      iso(this.now),
      iso(this.now + this.deps.config.adminSessionMinutes * MIN),
    ]);
    // Alerte à chaque nouvelle connexion (§13.4).
    await this.deps.providers.messages.sendEmail(ch.email, { subject: 'Nouvelle connexion administrateur GoBilan', text: `Connexion le ${iso(this.now)}. Si ce n'est pas vous, changez votre mot de passe immédiatement.` });
    await this.audit(ch.email, 'admin.login', null, null, null);
    return { token, admin: { email: ch.email } };
  }

  /** Vérifiée à CHAQUE requête : session valide ET adresse toujours autorisée (§10.1, §13.4). */
  async resolveSession(token: string): Promise<AdminSession | null> {
    const row = (
      await this.deps.db.query<{ email: string }>(
        `select s.email from admin_sessions s join admin_users a on a.email = s.email
          where s.token_hash = $1 and s.revoked_at is null and s.expires_at > $2 and a.active`,
        [sha256(token), iso(this.now)],
      )
    ).rows[0];
    return row ?? null;
  }

  async logout(token: string): Promise<void> {
    await this.deps.db.query('update admin_sessions set revoked_at = $2 where token_hash = $1 and revoked_at is null', [sha256(token), iso(this.now)]);
  }

  /** Amorçage : crée / met à jour un administrateur autorisé (script d'exploitation, jamais exposé en HTTP). */
  async upsertAdmin(email: string, password: string): Promise<void> {
    const hash = await hashSecret(password, this.deps.secrets.pepper);
    await this.deps.db.query(
      `insert into admin_users(email, password_hash, created_at) values ($1,$2,$3)
       on conflict (email) do update set password_hash = excluded.password_hash, active = true`,
      [email.toLowerCase(), hash, iso(this.now)],
    );
    // Changement de mot de passe : toutes les sessions sont coupées et une alerte part (§13.4).
    await this.deps.db.query('update admin_sessions set revoked_at = $2 where email = $1 and revoked_at is null', [email.toLowerCase(), iso(this.now)]);
    await this.deps.providers.messages.sendEmail(email.toLowerCase(), { subject: 'Mot de passe administrateur modifié', text: 'Le mot de passe de votre compte administrateur GoBilan vient d\'être modifié.' });
  }

  async listAllowlist() {
    return (await this.deps.db.query<{ email: string; active: boolean; created_at: Date }>('select email, active, created_at from admin_users order by email')).rows.map(r => ({ email: r.email, active: r.active, createdAt: r.created_at.toISOString() }));
  }

  async requestAllowlistChange(actor: AdminSession, input: z.infer<typeof adminAllowlistChangeSchema>) {
    const { id, code } = await issueEmailCode(this.deps, actor.email, 'admin_allowlist', { enforceQuota: true });
    const passwordHash = input.action === 'add' ? await hashSecret(input.password, this.deps.secrets.pepper) : null;
    await this.deps.db.query('insert into admin_allowlist_changes(id, requested_by, target_email, action, password_hash, expires_at) values ($1,$2,$3,$4,$5,$6)', [id, actor.email, input.email, input.action, passwordHash, iso(this.now + 10 * MIN)]);
    await this.deps.providers.messages.sendEmail(actor.email, { subject: 'Confirmer la modification des administrateurs GoBilan', text: `Action : ${input.action} — ${input.email}\nCode de confirmation : ${code}\nValable 10 minutes. Aucune modification sans confirmation.` });
    return { requestId: id };
  }

  async confirmAllowlistChange(actor: AdminSession, requestId: string, code: string) {
    const pending = (await this.deps.db.query<{ requested_by: string; consumed_at: Date | null; expires_at: Date }>('select requested_by, consumed_at, expires_at from admin_allowlist_changes where id=$1', [requestId])).rows[0];
    if (!pending || pending.requested_by !== actor.email || pending.consumed_at || pending.expires_at.getTime() <= this.now) throw new AppError('unauthenticated', 'Confirmation incorrecte ou expirée.');
    await verifyEmailCode(this.deps.db, this.deps, actor.email, 'admin_allowlist', code, requestId);
    await this.deps.db.tx(async t => {
      await t.query("select pg_advisory_xact_lock(hashtext('admin-allowlist'))");
      if (!(await t.query('select 1 from admin_users where email=$1 and active', [actor.email])).rows.length) throw new AppError('unauthenticated', 'Accès administrateur révoqué.');
      const r = (await t.query<{ target_email: string; action: 'add' | 'remove'; password_hash: string | null }>('update admin_allowlist_changes set consumed_at=$3 where id=$1 and requested_by=$2 and consumed_at is null and expires_at>$3 returning target_email, action, password_hash', [requestId, actor.email, iso(this.now)])).rows[0];
      if (!r) throw new AppError('conflict', 'Confirmation déjà utilisée.');
      const old = (await t.query<{ active: boolean }>('select active from admin_users where email=$1', [r.target_email])).rows[0];
      if (r.action === 'remove') {
        if (!old?.active) throw notFound('Administrateur actif introuvable.');
        const count = Number((await t.query<{ n: string }>('select count(*) n from admin_users where active')).rows[0]!.n);
        if (count <= 2) throw new AppError('conflict', 'Conservez au moins deux administrateurs actifs, dont une adresse de secours.');
        await t.query('update admin_users set active=false where email=$1', [r.target_email]);
      } else {
        if (old?.active) throw new AppError('conflict', 'Cette adresse est déjà autorisée.');
        await t.query('insert into admin_users(email,password_hash,active,created_at) values($1,$2,true,$3) on conflict(email) do update set password_hash=excluded.password_hash, active=true', [r.target_email, r.password_hash, iso(this.now)]);
      }
      await t.query('update admin_sessions set revoked_at=$2 where email=$1 and revoked_at is null', [r.target_email, iso(this.now)]);
      await t.query('insert into audit_log(at,actor,action,target,old_value,new_value) values($1,$2,$3,$4,$5::jsonb,$6::jsonb)', [iso(this.now), actor.email, 'admin.allowlist.' + r.action, r.target_email, JSON.stringify({ active: old?.active ?? false }), JSON.stringify({ active: r.action === 'add' })]);
    });
  }

  // --- Partenaires ----------------------------------------------------------------------------

  async listPartners(filter: { country?: string; from?: string; to?: string } = {}) {
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.country) { params.push(filter.country); where.push(`p.country = $${params.length}`); }
    if (filter.from) { params.push(filter.from); where.push(`p.created_at >= $${params.length}`); }
    if (filter.to) { params.push(filter.to); where.push(`p.created_at < $${params.length}`); }
    const rows = (
      await this.deps.db.query<{ id: string; name: string; email: string; role: PartnerRole; country: string; status: string; created_at: Date; referrals: string; earned: string | null }>(
        `select p.id, p.name, p.email, p.role, p.country, p.status, p.created_at,
                (select count(*) from referrals r where r.partner_id = p.id or r.manager_id = p.id) as referrals,
                (select sum(amount) from commission_ledger l where l.partner_id = p.id) as earned
           from partners p ${where.length ? 'where ' + where.join(' and ') : ''} order by p.created_at desc`,
        params,
      )
    ).rows;
    return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, country: r.country, status: r.status, createdAt: r.created_at.toISOString(), referrals: Number(r.referrals), earned: Number(r.earned ?? 0) }));
  }

  async setPartnerStatus(admin: AdminSession, partnerId: string, status: 'active' | 'suspended' | 'removed'): Promise<void> {
    const old = (await this.deps.db.query<{ status: string }>('select status from partners where id = $1', [partnerId])).rows[0];
    if (!old) throw notFound();
    // Un statut ne change JAMAIS les montants d'un accord en vigueur (§10.4) : on ne touche ni aux taux figés ni au journal.
    await this.deps.db.query('update partners set status = $2 where id = $1', [partnerId, status]);
    if (status !== 'active') await this.deps.db.query('update partner_sessions set revoked_at = $2 where partner_id = $1 and revoked_at is null', [partnerId, iso(this.now)]);
    await this.audit(admin.email, 'partner.status', partnerId, { status: old.status }, { status });
  }

  /** Exclusion d'un parrainage (auto-parrainage, famille, commerce du partenaire, §10.8) + annulation des lignes existantes. */
  async excludeReferral(admin: AdminSession, input: z.infer<typeof excludeReferralSchema>): Promise<{ reversed: number }> {
    return this.deps.db.tx(async (t) => {
      const ref = (await t.query<{ id: string; excluded_reason: string | null }>('select id, excluded_reason from referrals where id = $1 for update', [input.referralId])).rows[0];
      if (!ref) throw notFound();
      await t.query('update referrals set excluded_reason = $2 where id = $1', [input.referralId, input.reason]);
      const reversed = await reverseCommissionsForReferral(t, input.referralId, 'excluded', this.now);
      await t.query('insert into audit_log(at, actor, action, target, old_value, new_value) values ($1,$2,$3,$4,$5::jsonb,$6::jsonb)', [
        iso(this.now), admin.email, 'referral.exclude', input.referralId, JSON.stringify({ excluded_reason: ref.excluded_reason }), JSON.stringify({ excluded_reason: input.reason, reversed }),
      ]);
      return { reversed };
    });
  }

  async listReferrals() {
    return (await this.deps.db.query<{ id: string; business_name: string; partner_name: string; excluded_reason: string | null }>('select r.id,b.name as business_name,p.name as partner_name,r.excluded_reason from referrals r join businesses b on b.id=r.business_id join partners p on p.id=r.partner_id order by r.registered_at desc')).rows.map(r => ({ id: r.id, businessName: r.business_name, partnerName: r.partner_name, excludedReason: r.excluded_reason }));
  }

  async listSubscriptions(offset: number, limit: number) {
    const rows = (await this.deps.db.query<{ id: string; name: string; country: string; owner_name: string; trial_ends_at: Date | null; paid_until: Date | null }>('select b.id,b.name,b.country,u.name as owner_name,b.trial_ends_at,b.paid_until from businesses b join users u on u.id=b.owner_id order by b.created_at desc,b.id limit $1 offset $2', [limit, offset])).rows;
    return rows.map(b => ({ id: b.id, name: b.name, country: b.country, ownerName: b.owner_name, status: subscriptionStatus(subscriptionOf(b), this.now), ...subscriptionOf(b) }));
  }

  async updatePayoutBlock(actor: AdminSession, partnerId: string, input: z.infer<typeof payoutBlockSchema>) {
    await this.deps.db.tx(async t => {
      const old = (await t.query<{ country: keyof typeof COUNTRIES; payout_phone_enc: string | null; payout_network: string | null; payout_name_enc: string | null }>('select country,payout_phone_enc,payout_network,payout_name_enc from partners where id=$1 for update', [partnerId])).rows[0];
      if (!old) throw notFound();
      if (!COUNTRIES[old.country].networks.includes(input.network)) throw new AppError('validation', 'Réseau indisponible dans le pays du partenaire.');
      const next = { payout_phone_enc: encryptField(input.phone, this.deps.secrets.payoutKey), payout_network: input.network, payout_name_enc: encryptField(input.displayName, this.deps.secrets.payoutKey) };
      await t.query('update partners set payout_phone_enc=$2,payout_network=$3,payout_name_enc=$4 where id=$1', [partnerId, next.payout_phone_enc, next.payout_network, next.payout_name_enc]);
      const previous = { payout_phone_enc: old.payout_phone_enc, payout_network: old.payout_network, payout_name_enc: old.payout_name_enc };
      await t.query('insert into audit_log(at,actor,action,target,old_value,new_value) values($1,$2,$3,$4,$5::jsonb,$6::jsonb)', [iso(this.now), actor.email, 'admin.payout_block.change', partnerId, JSON.stringify(previous), JSON.stringify(next)]);
    });
  }

  // --- Calendrier et validation des versements (§10.9) -------------------------------------------

  private async openEntries(db: Db): Promise<{ entries: LedgerEntry[]; paid: Set<string> }> {
    const rows = (
      await db.query<{ key: string; partner_id: string; role: LedgerEntry['role']; referral_id: string; amount: string; payout_date: string; confirmed_at: Date; reverses: string | null }>(
        'select key, partner_id, role, referral_id, amount, payout_date, confirmed_at, reverses from commission_ledger',
      )
    ).rows;
    // Les lignes d'un versement ANNULÉ redeviennent dues (virement échoué : reporté au cycle suivant).
    const paid = new Set((await db.query<{ ledger_key: string }>(`select pe.ledger_key from payout_entries pe where not exists (select 1 from payout_reversals r where r.payout_id = pe.payout_id)`)).rows.map((r) => r.ledger_key));
    return {
      entries: rows.map((r) => ({ key: r.key, partnerId: r.partner_id, role: r.role, referralId: r.referral_id, amount: Number(r.amount), payoutDate: r.payout_date, confirmedAt: r.confirmed_at.toISOString(), reverses: r.reverses })),
      paid,
    };
  }

  /** Pour chaque partenaire : brut dû à la date du cycle, payable ou reporté (seuil 2 000 F). */
  async payoutCalendar(cycleDate: string) {
    const { entries, paid } = await this.openEntries(this.deps.db);
    const balances = computePayoutBalances(entries, paid, cycleDate);
    const partners = new Map((await this.deps.db.query<{ id: string; name: string; email: string; role: PartnerRole; payout_network: string | null; has_block: boolean }>(`select id, name, email, role, payout_network, payout_phone_enc is not null as has_block from partners`)).rows.map((p) => [p.id, p]));
    return {
      cycleDate,
      thresholdFcfa: PAYOUT_THRESHOLD_FCFA,
      partners: balances.map((b) => ({ ...b, name: partners.get(b.partnerId)?.name ?? '?', email: partners.get(b.partnerId)?.email ?? '?', role: partners.get(b.partnerId)?.role ?? 'agent', network: partners.get(b.partnerId)?.payout_network ?? null, hasPayoutBlock: partners.get(b.partnerId)?.has_block ?? false })),
    };
  }

  /** Coordonnées en clair, uniquement pour l'administrateur au moment du versement ; l'accès est journalisé (§13.6). */
  async revealPayoutBlock(admin: AdminSession, partnerId: string) {
    const p = (await this.deps.db.query<{ payout_phone_enc: string | null; payout_network: string | null; payout_name_enc: string | null }>('select payout_phone_enc, payout_network, payout_name_enc from partners where id = $1', [partnerId])).rows[0];
    if (!p?.payout_phone_enc || !p.payout_name_enc) throw new AppError('conflict', "Ce partenaire n'a pas renseigné son bloc Paiement.");
    await this.audit(admin.email, 'partner.payout_block.reveal', partnerId, null, null);
    return { phone: decryptField(p.payout_phone_enc, this.deps.secrets.payoutKey), network: p.payout_network, displayName: decryptField(p.payout_name_enc, this.deps.secrets.payoutKey) };
  }

  /**
   * Validation manuelle APRÈS paiement hors application. Le montant est RECALCULÉ ici depuis le
   * journal : jamais pris d'un champ client. Une ligne validée ne se modifie plus (trigger) ; la
   * contrainte d'unicité sur `payout_entries.ledger_key` interdit de verser deux fois une ligne.
   */
  async validatePayout(admin: AdminSession, input: z.infer<typeof validatePayoutSchema>) {
    return this.deps.db.tx(async (t) => {
      await t.query('select pg_advisory_xact_lock(hashtext($1))', [`payout:${input.partnerId}`]);
      const { entries, paid } = await this.openEntries(t);
      const bal = computePayoutBalances(entries, paid, input.cycleDate).find((b) => b.partnerId === input.partnerId);
      if (!bal) throw new AppError('conflict', 'Rien à verser pour ce partenaire à cette date.');
      if (!bal.payable) throw new AppError('conflict', `Solde sous le seuil de ${PAYOUT_THRESHOLD_FCFA} FCFA : reporté au cycle suivant.`);
      let line;
      try {
        line = netOfFees(bal.gross, input.fees);
      } catch (e) {
        throw new AppError('validation', (e as Error).message);
      }
      const payout = (
        await t.query<{ id: string }>(
          `insert into payouts(partner_id, cycle_date, gross, fees, net, transfer_reference, validated_by, validated_at) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
          [input.partnerId, input.cycleDate, line.gross, line.fees, line.net, input.transferReference ?? null, admin.email, iso(this.now)],
        )
      ).rows[0]!;
      for (const key of bal.entryKeys) await t.query('insert into payout_entries(payout_id, ledger_key) values ($1,$2)', [payout.id, key]);
      await t.query('insert into audit_log(at, actor, action, target, old_value, new_value) values ($1,$2,$3,$4,$5::jsonb,$6::jsonb)', [
        iso(this.now), admin.email, 'payout.validate', payout.id, null, JSON.stringify({ partnerId: input.partnerId, ...line, reference: input.transferReference ?? null }),
      ]);
      return { payoutId: payout.id, ...line };
    });
  }

  /** Virement échoué ou erreur : on ANNULE (jamais de modification) ; les lignes sont reportées au cycle suivant et le partenaire est prévenu. */
  async reversePayout(admin: AdminSession, input: z.infer<typeof reversePayoutSchema>): Promise<void> {
    await this.deps.db.tx(async (t) => {
      const p = (await t.query<{ id: string; partner_id: string }>('select id, partner_id from payouts where id = $1', [input.payoutId])).rows[0];
      if (!p) throw notFound();
      try {
        await t.query('insert into payout_reversals(payout_id, reason, reversed_by, reversed_at) values ($1,$2,$3,$4)', [p.id, input.reason, admin.email, iso(this.now)]);
      } catch {
        throw new AppError('conflict', 'Ce versement est déjà annulé.');
      }
      await t.query('insert into audit_log(at, actor, action, target, old_value, new_value) values ($1,$2,$3,$4,$5::jsonb,$6::jsonb)', [iso(this.now), admin.email, 'payout.reverse', p.id, null, JSON.stringify({ reason: input.reason })]);
      const partner = (await t.query<{ email: string; name: string }>('select email, name from partners where id = $1', [p.partner_id])).rows[0];
      if (partner) {
        await this.deps.providers.messages.sendEmail(partner.email, { subject: 'Votre versement GoBilan est reporté', text: `Bonjour ${partner.name}, votre dernier versement n'a pas pu aboutir. Il est reporté au cycle suivant. Vérifiez vos coordonnées dans votre espace partenaire.` });
      }
    });
  }

  async stats() {
    const q = async (sql: string) => Number((await this.deps.db.query<{ n: string }>(sql)).rows[0]?.n ?? 0);
    const biz = (await this.deps.db.query<{ trial_ends_at: Date | null; paid_until: Date | null }>('select trial_ends_at, paid_until from businesses')).rows;
    const counts = { trial: 0, active: 0, grace: 0, blocked: 0 };
    for (const b of biz) counts[subscriptionStatus(subscriptionOf(b), this.now)]++;
    return {
      users: await q('select count(*) n from users'),
      businesses: biz.length,
      subscriptions: counts,
      partners: await q(`select count(*) n from partners where status = 'active'`),
      confirmedRevenue: await q(`select coalesce(sum(amount),0) n from payments where status = 'confirmed'`),
      commissionsDue: await q('select coalesce(sum(amount),0) n from commission_ledger'),
    };
  }

  async auditLog(limit = 100) {
    return (await this.deps.db.query<{ id: string; at: Date; actor: string; action: string; target: string | null; old_value: unknown; new_value: unknown }>('select id, at, actor, action, target, old_value, new_value from audit_log order by id desc limit $1', [Math.min(limit, 500)])).rows.map((r) => ({ id: Number(r.id), at: r.at.toISOString(), actor: r.actor, action: r.action, target: r.target, oldValue: r.old_value, newValue: r.new_value }));
  }

  private async audit(actor: string, action: string, target: string | null, oldValue: unknown, newValue: unknown) {
    await this.deps.db.query('insert into audit_log(at, actor, action, target, old_value, new_value) values ($1,$2,$3,$4,$5::jsonb,$6::jsonb)', [iso(this.now), actor, action, target, JSON.stringify(oldValue), JSON.stringify(newValue)]);
  }
}

import {
  ACTIVATION_LINK_TTL_DAYS,
  AGREEMENT_VERSION,
  agentPromoCode,
  COUNTRIES,
  commissionMonth,
  isValidPartnerPassword,
  referralDaysLeft,
  referralStatus,
  subscriptionStatus,
  type CountryCode,
  type PartnerRole,
} from '@gobilan/domain';
import type { z } from 'zod';
import type { createPartnerSchema, payoutBlockSchema, registerAgentSchema } from '@gobilan/contracts';
import { iso } from '../clock';
import { decryptField, encryptField, hashSecret, randomToken, sha256, verifySecret } from '../crypto';
import type { Deps } from '../deps';
import { AppError, forbidden } from '../errors';
import { subscriptionOf } from './access';
import { issueEmailCode, verifyEmailCode } from './otp';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
/** Verrouillage de connexion partenaire : 5 échecs -> 15 min (hypothèse D-016, le cahier ne chiffre pas). */
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

export interface PartnerSession {
  id: string;
  email: string;
  name: string;
  role: PartnerRole;
  country: CountryCode;
  agreementAccepted: boolean;
}

interface PartnerRow {
  id: string;
  email: string;
  name: string;
  country: CountryCode;
  role: PartnerRole;
  manager_id: string | null;
  password_hash: string | null;
  status: 'invited' | 'active' | 'suspended' | 'removed';
  promo_code: string | null;
  payout_phone_enc: string | null;
  payout_network: string | null;
  payout_name_enc: string | null;
}

export class PartnerService {
  constructor(private readonly deps: Deps) {}

  private get now() {
    return this.deps.clock.now();
  }

  // --- Création des comptes (§10.2) ----------------------------------------------------------

  /** Admin : crée un manager ou un influenceur. Jamais un agent (créé uniquement par un manager). */
  async createByAdmin(adminEmail: string, input: z.infer<typeof createPartnerSchema>): Promise<{ id: string }> {
    if (input.role === 'influencer' && !input.promoCode) throw new AppError('validation', "Un influenceur a besoin d'un code promo.");
    if (input.role === 'manager' && input.promoCode) throw new AppError('validation', "Un manager n'a pas de code promo personnel (§10.5).");
    const id = await this.insertPartner({ email: input.email, name: input.name, country: input.country, role: input.role, managerId: null, promoCode: input.promoCode ?? null });
    await this.audit(adminEmail, 'partner.create', id, null, { role: input.role, country: input.country });
    await this.sendActivation(id);
    return { id };
  }

  /** Manager : enregistre ses agents (e-mail, nom, code promo). Le pays de l'agent est celui du manager. */
  async registerAgent(manager: PartnerSession, input: z.infer<typeof registerAgentSchema>): Promise<{ id: string }> {
    if (manager.role !== 'manager') throw forbidden();
    const dial = COUNTRIES[manager.country].dialCode;
    const expectedPrefix = agentPromoCode(input.name.split(/\s+/)[0] ?? '', dial);
    // [PRÉNOM][CODE PAYS] (§10.2) ; un suffixe numérique est toléré pour départager deux homonymes (D-015).
    if (!input.promoCode.startsWith(expectedPrefix.replace(/\d+$/, '')) || !/\d{3}\d*$/.test(input.promoCode)) {
      throw new AppError('validation', `Le code promo d'un agent suit le format ${expectedPrefix}.`);
    }
    const id = await this.deps.db.tx(async t => {
      const current = (await t.query<{ role: string; status: string }>('select role,status from partners where id=$1 for update', [manager.id])).rows[0];
      if (!current || current.role !== 'manager' || current.status !== 'active') throw forbidden('Le rôle de votre compte a changé. Reconnectez-vous.');
      return this.insertPartner({ email: input.email, name: input.name, country: manager.country, role: 'agent', managerId: manager.id, promoCode: input.promoCode }, t);
    });
    await this.sendActivation(id);
    return { id };
  }

  private async insertPartner(p: { email: string; name: string; country: CountryCode; role: PartnerRole; managerId: string | null; promoCode: string | null }, db: Deps['db'] = this.deps.db): Promise<string> {
    try {
      const row = (
        await db.query<{ id: string }>(
          `insert into partners(email, name, country, role, manager_id, promo_code, created_at) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
          [p.email.toLowerCase(), p.name, p.country, p.role, p.managerId, p.promoCode, iso(this.now)],
        )
      ).rows[0]!;
      return row.id;
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('partners_email_unique')) throw new AppError('conflict', 'Cette adresse e-mail correspond déjà à un partenaire (un e-mail = un seul rôle).');
      if (msg.includes('promo_code')) throw new AppError('conflict', 'Ce code promo est déjà utilisé.');
      throw e;
    }
  }

  /** E-mail d'activation : lien à usage unique, 7 jours, AUCUN mot de passe ni identifiant dans le message (§10.2, §10.12). */
  async sendActivation(partnerId: string): Promise<void> {
    const p = (await this.deps.db.query<PartnerRow>('select * from partners where id = $1', [partnerId])).rows[0];
    if (!p) return;
    const token = randomToken();
    await this.deps.db.query('insert into partner_activation_tokens(token_hash, partner_id, expires_at) values ($1,$2,$3)', [sha256(token), partnerId, iso(this.now + ACTIVATION_LINK_TTL_DAYS * DAY)]);
    const link = `${this.deps.config.partnersPortalUrl}/activer?token=${token}`;
    const lines = [`Bonjour ${p.name},`, '', 'Bienvenue dans le programme partenaires GoBilan.', `Activez votre accès : ${link}`, `Ce lien est à usage unique et expire dans ${ACTIVATION_LINK_TTL_DAYS} jours.`];
    if (p.role === 'agent' && p.promo_code) lines.push('', `Ton code promo unique : ${p.promo_code}. Il ouvre 7 jours d'essai pour les commerçants.`);
    await this.deps.providers.messages.sendEmail(p.email, { subject: 'Activez votre accès partenaire GoBilan', text: lines.join('\n') });
  }

  /** Aperçu du lien d'activation SANS le consommer : la page doit savoir quel accord afficher (§10.3). */
  async previewActivation(token: string): Promise<{ name: string; role: PartnerRole; agreementVersion: string }> {
    const row = (
      await this.deps.db.query<{ name: string; role: PartnerRole }>(
        `select p.name, p.role from partner_activation_tokens t join partners p on p.id = t.partner_id
          where t.token_hash = $1 and t.consumed_at is null and t.expires_at > $2 and p.status in ('invited','active')`,
        [sha256(token), iso(this.now)],
      )
    ).rows[0];
    if (!row) throw new AppError('unauthenticated', 'Lien invalide ou expiré. Demandez un nouveau lien à votre contact GoBilan.');
    return { name: row.name, role: row.role, agreementVersion: AGREEMENT_VERSION };
  }

  /** Activation : mot de passe (≥ 8) + acceptation de l'accord (date, heure, version, identifiant). */
  async activate(token: string, password: string, acceptedVersion: string, ip: string | null): Promise<{ token: string; partner: PartnerSession }> {
    if (!isValidPartnerPassword(password)) throw new AppError('validation', 'Le mot de passe doit contenir au moins 8 caractères.');
    if (acceptedVersion !== AGREEMENT_VERSION) throw new AppError('validation', "Veuillez accepter la version en vigueur de l'accord.");
    const hash = await hashSecret(password, this.deps.secrets.pepper);
    return this.deps.db.tx(async (t) => {
      const used = (
        await t.query<{ partner_id: string }>(`update partner_activation_tokens set consumed_at = $2 where token_hash = $1 and consumed_at is null and expires_at > $2 returning partner_id`, [sha256(token), iso(this.now)])
      ).rows[0];
      if (!used) throw new AppError('unauthenticated', 'Lien invalide ou expiré. Demandez un nouveau lien à votre contact GoBilan.');
      const p = (await t.query<PartnerRow>(`update partners set password_hash = $2, status = 'active', activated_at = $3 where id = $1 and status in ('invited','active') returning *`, [used.partner_id, hash, iso(this.now)])).rows[0];
      if (!p) throw new AppError('forbidden', 'Compte indisponible.');
      await t.query('insert into agreement_acceptances(partner_id, role, version, accepted_at, ip) values ($1,$2,$3,$4,$5)', [p.id, p.role, acceptedVersion, iso(this.now), ip]);
      const session = await this.newSession(t, p.id);
      return { token: session, partner: await this.toSession(p, true) };
    });
  }

  // --- Connexion (e-mail + mot de passe, sans double authentification, §10.1) --------------------

  async login(email: string, password: string): Promise<{ token: string; partner: PartnerSession }> {
    const e = email.toLowerCase();
    const now = this.now;
    type Outcome = { ok: true; token: string; partner: PartnerSession } | { ok: false; error: AppError };
    // Résultat retourné puis levé APRÈS commit : lever dans la transaction effacerait le compteur d'échecs.
    const out = await this.deps.db.tx<Outcome>(async (t) => {
      await t.query('select pg_advisory_xact_lock(hashtext($1))', [`partner-login:${e}`]);
      const st = (await t.query<{ failed_attempts: number; locked_until: Date | null }>('select * from partner_login_state where email = $1 for update', [e])).rows[0];
      if (st?.locked_until && st.locked_until.getTime() > now) {
        return { ok: false, error: new AppError('locked', 'Trop de tentatives. Réessayez plus tard.', Math.ceil((st.locked_until.getTime() - now) / 1000)) };
      }
      const p = (await t.query<PartnerRow>('select * from partners where lower(email) = $1', [e])).rows[0];
      const good = p?.password_hash && p.status === 'active' ? await verifySecret(password, p.password_hash, this.deps.secrets.pepper) : (await verifySecret(password, 'x$x$x', this.deps.secrets.pepper).catch(() => false), false);
      if (!p || !good) {
        const fails = (st?.failed_attempts ?? 0) + 1;
        const lock = fails >= LOGIN_MAX_FAILS ? iso(now + LOGIN_LOCK_MS) : null;
        await t.query(
          `insert into partner_login_state(email, failed_attempts, locked_until) values ($1,$2,$3)
           on conflict (email) do update set failed_attempts = excluded.failed_attempts, locked_until = excluded.locked_until`,
          [e, lock ? 0 : fails, lock],
        );
        return { ok: false, error: new AppError('unauthenticated', 'Adresse e-mail ou mot de passe incorrect.') };
      }
      await t.query('delete from partner_login_state where email = $1', [e]);
      const accepted = await this.hasAcceptedCurrent(t, p.id);
      return { ok: true, token: await this.newSession(t, p.id), partner: await this.toSession(p, accepted) };
    });
    if (!out.ok) throw out.error;
    return { token: out.token, partner: out.partner };
  }

  private async newSession(db: Deps['db'], partnerId: string): Promise<string> {
    const token = randomToken();
    await db.query('insert into partner_sessions(partner_id, token_hash, created_at, expires_at) values ($1,$2,$3,$4)', [
      partnerId,
      sha256(token),
      iso(this.now),
      iso(this.now + this.deps.config.partnerSessionHours * HOUR),
    ]);
    return token;
  }

  private async hasAcceptedCurrent(db: Deps['db'], partnerId: string): Promise<boolean> {
    return (await db.query('select 1 from agreement_acceptances a join partners p on p.id=a.partner_id where a.partner_id = $1 and a.version = $2 and a.role=p.role and not p.agreement_renewal_required limit 1', [partnerId, AGREEMENT_VERSION])).rows.length > 0;
  }

  private async toSession(p: PartnerRow, accepted: boolean): Promise<PartnerSession> {
    return { id: p.id, email: p.email, name: p.name, role: p.role, country: p.country, agreementAccepted: accepted };
  }

  async resolveSession(token: string): Promise<PartnerSession | null> {
    const p = (
      await this.deps.db.query<PartnerRow>(
        `select p.* from partner_sessions s join partners p on p.id = s.partner_id
          where s.token_hash = $1 and s.revoked_at is null and s.expires_at > $2 and p.status = 'active'`,
        [sha256(token), iso(this.now)],
      )
    ).rows[0];
    return p ? this.toSession(p, await this.hasAcceptedCurrent(this.deps.db, p.id)) : null;
  }

  async logout(token: string): Promise<void> {
    await this.deps.db.query('update partner_sessions set revoked_at = $2 where token_hash = $1 and revoked_at is null', [sha256(token), iso(this.now)]);
  }

  /** Nouvelle version d'accord : à ré-accepter, sans effet sur les parrainages en cours (§10.3). */
  async acceptAgreement(partner: PartnerSession, version: string, ip: string | null): Promise<void> {
    if (version !== AGREEMENT_VERSION) throw new AppError('validation', "Version d'accord inconnue.");
    await this.deps.db.tx(async t => {
      const current = (await t.query<{ role: PartnerRole }>('select role from partners where id=$1 for update', [partner.id])).rows[0];
      if (!current || current.role !== partner.role) throw new AppError('conflict', 'Votre rôle a changé. Reconnectez-vous.');
      await t.query('insert into agreement_acceptances(partner_id, role, version, accepted_at, ip) values ($1,$2,$3,$4,$5)', [partner.id, partner.role, version, iso(this.now), ip]);
      await t.query('update partners set agreement_renewal_required=false where id=$1', [partner.id]);
    });
  }

  // --- Mot de passe oublié : mêmes limites que l'OTP (§10.1) -----------------------------------

  /** Réponse identique que l'adresse existe ou non (jamais d'énumération). */
  async forgotPassword(email: string): Promise<{ sent: true }> {
    const e = email.toLowerCase();
    const p = (await this.deps.db.query<PartnerRow>(`select * from partners where lower(email) = $1 and status = 'active'`, [e])).rows[0];
    const { code } = await issueEmailCode(this.deps, e, 'partner_reset', { enforceQuota: true });
    if (p) await this.deps.providers.messages.sendEmail(p.email, { subject: 'Code de réinitialisation GoBilan', text: `Votre code : ${code}\nIl est valable 10 minutes et à usage unique.` });
    return { sent: true };
  }

  async resetPassword(email: string, code: string, password: string): Promise<void> {
    if (!isValidPartnerPassword(password)) throw new AppError('validation', 'Le mot de passe doit contenir au moins 8 caractères.');
    const e = email.toLowerCase();
    await verifyEmailCode(this.deps.db, this.deps, e, 'partner_reset', code);
    const hash = await hashSecret(password, this.deps.secrets.pepper);
    const p = (await this.deps.db.query<{ id: string }>(`update partners set password_hash = $2 where lower(email) = $1 and status = 'active' returning id`, [e, hash])).rows[0];
    if (!p) throw new AppError('otp_invalid', 'Code incorrect ou expiré.');
    // Un changement de mot de passe déconnecte toutes les sessions (§13.3).
    await this.deps.db.query('update partner_sessions set revoked_at = $2 where partner_id = $1 and revoked_at is null', [p.id, iso(this.now)]);
  }

  // --- Bloc Paiement (§10.10, §13.6) : seule donnée modifiable par le partenaire -----------------

  async setPayoutBlock(partner: PartnerSession, block: z.infer<typeof payoutBlockSchema>): Promise<void> {
    if (!COUNTRIES[partner.country].networks.includes(block.network)) throw new AppError('validation', "Ce réseau n'est pas disponible dans votre pays.");
    await this.deps.db.tx(async t => {
      const old = (await t.query<{ payout_phone_enc: string | null; payout_network: string | null; payout_name_enc: string | null }>('select payout_phone_enc,payout_network,payout_name_enc from partners where id=$1 for update', [partner.id])).rows[0];
      const next = { payout_phone_enc: encryptField(block.phone, this.deps.secrets.payoutKey), payout_network: block.network, payout_name_enc: encryptField(block.displayName, this.deps.secrets.payoutKey) };
      await t.query('update partners set payout_phone_enc=$2,payout_network=$3,payout_name_enc=$4 where id=$1', [partner.id, next.payout_phone_enc, next.payout_network, next.payout_name_enc]);
      await t.query('insert into audit_log(at,actor,action,target,old_value,new_value) values($1,$2,$3,$4,$5::jsonb,$6::jsonb)', [iso(this.now), partner.email, 'partner.payout_block.change', partner.id, JSON.stringify(old ?? null), JSON.stringify(next)]);
    });
  }

  async getPayoutBlock(partner: Pick<PartnerSession, 'id'>): Promise<{ phone: string; network: string; displayName: string } | null> {
    const p = (await this.deps.db.query<PartnerRow>('select payout_phone_enc, payout_network, payout_name_enc from partners where id = $1', [partner.id])).rows[0];
    if (!p?.payout_phone_enc || !p.payout_network || !p.payout_name_enc) return null;
    return { phone: decryptField(p.payout_phone_enc, this.deps.secrets.payoutKey), network: p.payout_network, displayName: decryptField(p.payout_name_enc, this.deps.secrets.payoutKey) };
  }

  /** Historique : UNIQUEMENT les versements validés (date, brut, frais, net). Les dus/en attente n'y figurent pas (§10.9). */
  async payoutHistory(partner: Pick<PartnerSession, 'id'>) {
    return (
      await this.deps.db.query<{ validated_at: Date; cycle_date: string; gross: string; fees: string; net: string }>(
        `select p.validated_at, p.cycle_date, p.gross, p.fees, p.net from payouts p
          where p.partner_id = $1 and not exists (select 1 from payout_reversals r where r.payout_id = p.id) order by p.validated_at desc`,
        [partner.id],
      )
    ).rows.map((r) => ({ validatedAt: r.validated_at.toISOString(), cycleDate: r.cycle_date, gross: Number(r.gross), fees: Number(r.fees), net: Number(r.net) }));
  }

  // --- Tableaux de bord (§10.5 à §10.7) : JAMAIS de numéro de téléphone ---------------------------

  async dashboard(partner: PartnerSession) {
    if (!partner.agreementAccepted) throw new AppError('forbidden', "Acceptez l'accord pour accéder à votre tableau de bord.");
    if (partner.role === 'agent') return this.agentDashboard(partner);
    if (partner.role === 'manager') return this.managerDashboard(partner);
    return this.influencerDashboard(partner);
  }

  private async gains(partnerId: string, role: PartnerRole) {
    const r = (
      await this.deps.db.query<{ earned: string | null; paid: string | null }>(
        `select sum(l.amount) as earned,
                sum(l.amount) filter (where exists (select 1 from payout_entries pe join payouts p on p.id = pe.payout_id where pe.ledger_key = l.key and not exists (select 1 from payout_reversals rv where rv.payout_id = p.id))) as paid
           from commission_ledger l where l.partner_id = $1 and l.role = $2`,
        [partnerId, role],
      )
    ).rows[0]!;
    const earned = Number(r.earned ?? 0);
    const paid = Number(r.paid ?? 0);
    return { earned, paidOut: paid, pending: earned - paid };
  }

  private async referralRows(where: string, params: unknown[]) {
    const rows = (
      await this.deps.db.query<{ id: string; business_name: string; registered_at: Date; partner_id: string; business_id: string; paid: boolean; trial_ends_at: Date | null; paid_until: Date | null }>(
        `select r.id, r.business_id, r.partner_id, b.name as business_name, r.registered_at, b.trial_ends_at, b.paid_until,
                exists (select 1 from commission_ledger l where l.referral_id = r.id and l.amount > 0) as paid
           from referrals r join businesses b on b.id = r.business_id where ${where} order by r.registered_at desc`,
        params,
      )
    ).rows;
    return rows.map((r) => ({
      referralId: r.id,
      partnerId: r.partner_id,
      businessName: r.business_name,
      registeredAt: r.registered_at.toISOString(),
      status: referralStatus({ registeredAt: r.registered_at.toISOString() }, r.paid, this.now),
      daysLeft: referralDaysLeft({ registeredAt: r.registered_at.toISOString() }, r.paid, this.now),
      active: subscriptionStatus(subscriptionOf(r), this.now) !== 'blocked',
    }));
  }

  private async agentDashboard(p: PartnerSession) {
    const code = (await this.deps.db.query<{ promo_code: string }>('select promo_code from partners where id = $1', [p.id])).rows[0]?.promo_code ?? '';
    const referrals = await this.referralRows('r.partner_id = $1', [p.id]);
    return {
      role: 'agent' as const,
      promoCode: code,
      referralLink: `${this.deps.config.partnersPortalUrl.replace('portail', 'app')}?code=${code}`,
      counters: { referrals: referrals.length, paid: referrals.filter((r) => r.status === 'paid').length, ...(await this.gains(p.id, 'agent')) },
      referrals: referrals.map(({ businessName, registeredAt, status, daysLeft }) => ({ businessName, registeredAt, status, daysLeft })),
    };
  }

  private async managerDashboard(p: PartnerSession) {
    const agents = (await this.deps.db.query<{ id: string; name: string; promo_code: string | null; status: string }>(`select id, name, promo_code, status from partners where manager_id = $1 order by name`, [p.id])).rows;
    // Parrainages de l'équipe : ceux dont le manager enregistré est ce manager (conservés même si l'agent a quitté, §10.8).
    const referrals = await this.referralRows('r.manager_id = $1', [p.id]);
    return {
      role: 'manager' as const,
      counters: { trialsStarted: referrals.length, paid: referrals.filter((r) => r.status === 'paid').length, ...(await this.gains(p.id, 'manager')) },
      team: agents.map((a) => {
        const mine = referrals.filter((r) => r.partnerId === a.id);
        return { name: a.name, promoCode: a.promo_code, status: a.status, referrals: mine.length, paid: mine.filter((r) => r.status === 'paid').length, conversion: mine.length ? Math.round((mine.filter((r) => r.status === 'paid').length / mine.length) * 100) : 0 };
      }),
      referrals: referrals.map(({ businessName, registeredAt, status, daysLeft }) => ({ businessName, registeredAt, status, daysLeft })),
    };
  }

  private async influencerDashboard(p: PartnerSession) {
    const code = (await this.deps.db.query<{ promo_code: string }>('select promo_code from partners where id = $1', [p.id])).rows[0]?.promo_code ?? '';
    const referrals = await this.referralRows('r.partner_id = $1', [p.id]);
    const perSubscriber = await Promise.all(
      referrals.map(async (r) => {
        const rows = (
          await this.deps.db.query<{ amount: string; payment_index: number; confirmed_at: Date }>(
            `select amount, payment_index, confirmed_at from commission_ledger where referral_id = $1 and partner_id = $2 order by confirmed_at`,
            [r.referralId, p.id],
          )
        ).rows;
        const last = [...rows].reverse().find((x) => Number(x.amount) > 0);
        return {
          businessName: r.businessName,
          month: last?.payment_index ? commissionMonth(last.payment_index) : 0,
          gainThisMonth: last ? Number(last.amount) : 0,
          totalCumulated: rows.reduce((a, x) => a + Number(x.amount), 0),
        };
      }),
    );
    return {
      role: 'influencer' as const,
      promoCode: code,
      counters: { signups: referrals.length, activeSubscriptions: referrals.filter((r) => r.active && r.status === 'paid').length, validatedRevenue: (await this.gains(p.id, 'influencer')).earned },
      subscribers: perSubscriber,
    };
  }

  private async audit(actor: string, action: string, target: string | null, oldValue: unknown, newValue: unknown) {
    await this.deps.db.query('insert into audit_log(at, actor, action, target, old_value, new_value) values ($1,$2,$3,$4,$5::jsonb,$6::jsonb)', [iso(this.now), actor, action, target, JSON.stringify(oldValue), JSON.stringify(newValue)]);
  }
}

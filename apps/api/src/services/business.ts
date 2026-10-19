import {
  can,
  canGrantLevel,
  canManageMember,
  subscriptionStatus,
  toDayKey,
  trialEndsAtFrom,
  COUNTRIES,
  type Access,
  type CountryCode,
  type PermissionLevel,
  type SubscriptionStatus,
} from '@gobilan/domain';
import type { z } from 'zod';
import type { createBusinessSchema, createRoleSchema, inviteMemberSchema, stockItemSchema, updateBusinessSchema } from '@gobilan/contracts';
import { iso } from '../clock';
import type { Deps } from '../deps';
import { AppError, forbidden, notFound } from '../errors';
import { requireAccess, subscriptionOf } from './access';
import { RATE_CARDS, AGREEMENT_VERSION } from '@gobilan/domain';
import type { SessionUser } from './auth';

type CreateBusiness = z.infer<typeof createBusinessSchema>;

export interface BusinessSummary {
  id: string;
  name: string;
  country: CountryCode;
  isOwner: boolean;
  roleName: string | null;
  level: PermissionLevel | 'owner';
  status: SubscriptionStatus;
  /** `null` quand l'utilisateur n'a pas le droit de voir le chiffre (saisie seule) ou si le business est bloqué. */
  revenueToday: number | null;
}

export class BusinessService {
  constructor(private readonly deps: Deps) {}

  private get now() {
    return this.deps.clock.now();
  }

  /**
   * Crée un business ; son créateur en est le propriétaire absolu. L'essai de 7 jours n'est
   * accordé qu'UNE fois par numéro et par appareil (§8.1 — décision D-014 à valider) : sans cela
   * il suffirait de créer des business en boucle pour ne jamais payer.
   */
  async createBusiness(user: SessionUser, deviceRowId: string, input: CreateBusiness): Promise<{ id: string; trialGranted: boolean }> {
    const now = this.now;
    return this.deps.db.tx(async (t) => {
      const deviceKey = (await t.query<{ device_key: string }>('select device_key from devices where id = $1 and user_id = $2', [deviceRowId, user.id])).rows[0]?.device_key ?? null;
      for (const key of [`trial-user:${user.id}`, ...(deviceKey ? [`trial-device:${deviceKey}`] : [])].sort()) {
        await t.query('select pg_advisory_xact_lock(hashtext($1))', [key]);
      }
      const prior = await t.query(
        `select 1 from businesses where trial_ends_at is not null and (owner_id = $1 or ($2::text is not null and created_device_key = $2)) limit 1`,
        [user.id, deviceKey],
      );
      const trialGranted = prior.rows.length === 0;
      const id = (
        await t.query<{ id: string }>(
          `insert into businesses(owner_id, name, country, sector, stock_enabled, trial_ends_at, created_device_key, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
          [user.id, input.name, input.country, input.sector, input.stockEnabled ?? false, trialGranted ? trialEndsAtFrom(now) : null, deviceKey, iso(now)],
        )
      ).rows[0]!.id;
      await t.query('insert into members(business_id, user_id, role_id, is_owner, joined_at) values ($1,$2,null,true,$3)', [id, user.id, iso(now)]);

      // Parrainage : rattaché au PREMIER business du filleul (D-018), montants figés à cette date.
      const refCode = (await t.query<{ referral_partner_code: string | null; created_at: Date }>('select referral_partner_code, created_at from users where id = $1', [user.id])).rows[0];
      if (refCode?.referral_partner_code) {
        const already = await t.query('select 1 from referrals r join businesses b on b.id = r.business_id where b.owner_id = $1 limit 1', [user.id]);
        const partner = (
          await t.query<{ id: string; role: 'agent' | 'influencer' | 'manager'; manager_id: string | null }>(
            `select id, role, manager_id from partners where promo_code = $1 and status = 'active' and role in ('agent','influencer')`,
            [refCode.referral_partner_code],
          )
        ).rows[0];
        if (partner && already.rows.length === 0 && partner.role !== 'manager') {
          await t.query(
            `insert into referrals(business_id, partner_id, partner_role, manager_id, registered_at, rates, agreement_version)
             values ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
            [id, partner.id, partner.role, partner.role === 'agent' ? partner.manager_id : null, iso(refCode.created_at.getTime()), JSON.stringify(RATE_CARDS), AGREEMENT_VERSION],
          );
        }
      }
      return { id, trialGranted };
    });
  }

  async listMine(user: Pick<SessionUser, 'id' | 'phone' | 'name' | 'country'>): Promise<BusinessSummary[]> {
    const userId = user.id;
    const rows = (
      await this.deps.db.query<{ business_id: string; is_owner: boolean; role_name: string | null; level: PermissionLevel | null }>(
        `select b.id as business_id, m.is_owner, r.name as role_name, r.level
           from members m join businesses b on b.id = m.business_id left join roles r on r.id = m.role_id
          where m.user_id = $1 and m.status = 'active' order by b.created_at`,
        [userId],
      )
    ).rows;
    const out: BusinessSummary[] = [];
    for (const r of rows) {
      const ctx = await requireAccess(this.deps.db, userId, r.business_id);
      const status = subscriptionStatus(subscriptionOf(ctx.business), this.now);
      const level: PermissionLevel | 'owner' = r.is_owner ? 'owner' : (r.level as PermissionLevel);
      let revenueToday: number | null = null;
      if (status !== 'blocked' && can(ctx.access, 'viewDashboard')) {
        const today = toDayKey(this.now, COUNTRIES[ctx.business.country].utcOffsetMinutes);
        revenueToday = await this.revenueOfDay(r.business_id, today);
      }
      out.push({
        id: r.business_id,
        name: ctx.business.name,
        country: ctx.business.country,
        isOwner: r.is_owner,
        roleName: r.role_name,
        level,
        status,
        revenueToday,
      });
    }
    return out;
  }

  private async revenueOfDay(businessId: string, day: string): Promise<number> {
    const r = await this.deps.db.query<{ total: string | null }>(
      `select sum((rv.content->'revenue'->>'total')::bigint) as total
         from reports r join lateral (select content from report_versions where report_id = r.id order by version_no desc limit 1) rv on true
        where r.business_id = $1 and r.day = $2`,
      [businessId, day],
    );
    return Number(r.rows[0]?.total ?? 0);
  }

  async update(actor: SessionUser, businessId: string, input: z.infer<typeof updateBusinessSchema>): Promise<void> {
    const { access } = await requireAccess(this.deps.db, actor.id, businessId);
    if (!access.isOwner) throw forbidden();
    await this.deps.db.query(
      `update businesses set reminder_time = coalesce($2, reminder_time), stock_enabled = coalesce($3, stock_enabled), name = coalesce($4, name) where id = $1`,
      [businessId, input.reminderTime ?? null, input.stockEnabled ?? null, input.name ?? null],
    );
  }

  // --- Rôles, équipe, invitations (§5) ----------------------------------------------------

  async createRole(actor: SessionUser, businessId: string, input: z.infer<typeof createRoleSchema>) {
    const { access } = await requireAccess(this.deps.db, actor.id, businessId);
    if (!can(access, 'createRoles')) throw forbidden();
    const row = (await this.deps.db.query<{ id: string }>('insert into roles(business_id, name, level) values ($1,$2,$3) returning id', [businessId, input.name, input.level])).rows[0]!;
    return { id: row.id };
  }

  async listRoles(actor: SessionUser, businessId: string) {
    const { access } = await requireAccess(this.deps.db, actor.id, businessId);
    if (!can(access, 'viewTeam')) throw forbidden();
    return (await this.deps.db.query<{ id: string; name: string; level: PermissionLevel }>('select id, name, level from roles where business_id = $1 order by name', [businessId])).rows;
  }

  async listMembers(actor: SessionUser, businessId: string) {
    const { access } = await requireAccess(this.deps.db, actor.id, businessId);
    if (!can(access, 'viewTeam')) throw forbidden();
    return (
      await this.deps.db.query<{ member_id: string; user_id: string; name: string; phone: string; is_owner: boolean; role_name: string | null; level: PermissionLevel | null; status: string }>(
        `select m.id as member_id, u.id as user_id, u.name, u.phone, m.is_owner, r.name as role_name, r.level, m.status
           from members m join users u on u.id = m.user_id left join roles r on r.id = m.role_id
          where m.business_id = $1 and m.status = 'active' order by m.is_owner desc, m.joined_at`,
        [businessId],
      )
    ).rows;
  }

  async invite(actor: SessionUser, businessId: string, input: z.infer<typeof inviteMemberSchema>) {
    const { access } = await requireAccess(this.deps.db, actor.id, businessId);
    if (!can(access, 'manageTeam')) throw forbidden();
    const role = (await this.deps.db.query<{ id: string; level: PermissionLevel }>('select id, level from roles where id = $1 and business_id = $2', [input.roleId, businessId])).rows[0];
    if (!role) throw notFound('Rôle introuvable.');
    // On n'attribue qu'un niveau strictement inférieur au sien (§5.3, §5.4).
    if (!canGrantLevel(access, role.level)) throw forbidden('Vous ne pouvez pas attribuer ce niveau.');
    const existing = await this.deps.db.query('select 1 from members m join users u on u.id = m.user_id where m.business_id = $1 and u.phone = $2 and m.status = \'active\'', [businessId, input.phone]);
    if (existing.rows.length > 0) throw new AppError('conflict', 'Cette personne fait déjà partie du business.');
    try {
      const row = (
        await this.deps.db.query<{ id: string }>(
          `insert into invitations(business_id, phone, role_id, invited_by, created_at) values ($1,$2,$3,$4,$5) returning id`,
          [businessId, input.phone, role.id, actor.id, iso(this.now)],
        )
      ).rows[0]!;
      return { id: row.id, status: 'pending' as const };
    } catch (e) {
      if (String((e as Error).message).includes('one_pending_invitation')) throw new AppError('conflict', 'Une invitation est déjà en attente pour ce numéro.');
      throw e;
    }
  }

  /** Invitations visibles par l'utilisateur : celles adressées à SON numéro, y compris posées avant l'inscription (§4.5). */
  async myInvitations(user: SessionUser) {
    return (
      await this.deps.db.query<{ id: string; business_name: string; role_name: string; level: PermissionLevel; created_at: Date }>(
        `select i.id, b.name as business_name, r.name as role_name, r.level, i.created_at
           from invitations i join businesses b on b.id = i.business_id join roles r on r.id = i.role_id
          where i.phone = $1 and i.status = 'pending' order by i.created_at desc`,
        [user.phone],
      )
    ).rows;
  }

  async respondInvitation(user: SessionUser, invitationId: string, accept: boolean): Promise<void> {
    await this.deps.db.tx(async (t) => {
      // Garde IDOR : l'invitation doit être adressée au numéro de l'appelant.
      const inv = (
        await t.query<{ id: string; business_id: string; role_id: string }>(
          `update invitations set status = $3, responded_at = $4 where id = $1 and phone = $2 and status = 'pending' returning id, business_id, role_id`,
          [invitationId, user.phone, accept ? 'accepted' : 'declined', iso(this.now)],
        )
      ).rows[0];
      if (!inv) throw notFound('Invitation introuvable.');
      if (accept) {
        await t.query(
          `insert into members(business_id, user_id, role_id, is_owner, status, joined_at) values ($1,$2,$3,false,'active',$4)
           on conflict (business_id, user_id) do update set status = 'active', role_id = excluded.role_id, removed_at = null, joined_at = excluded.joined_at
           where members.is_owner = false`,
          [inv.business_id, user.id, inv.role_id, iso(this.now)],
        );
      }
    });
  }

  /** Retrait = suppression logique : l'accès futur disparaît, les bilans restent avec le nom (§5.4). */
  async removeMember(actor: SessionUser, businessId: string, memberId: string): Promise<void> {
    const { access } = await requireAccess(this.deps.db, actor.id, businessId);
    const target = (
      await this.deps.db.query<{ id: string; user_id: string; is_owner: boolean; role_id: string | null; role_name: string | null; level: PermissionLevel | null }>(
        `select m.id, m.user_id, m.is_owner, m.role_id, r.name as role_name, r.level from members m left join roles r on r.id = m.role_id
          where m.id = $1 and m.business_id = $2 and m.status = 'active'`,
        [memberId, businessId],
      )
    ).rows[0];
    if (!target) throw notFound();
    const targetAccess: Access = {
      businessId,
      userId: target.user_id,
      isOwner: target.is_owner,
      role: target.role_id && target.role_name && target.level ? { id: target.role_id, businessId, name: target.role_name, level: target.level } : null,
    };
    if (!canManageMember(access, targetAccess)) throw forbidden('Vous ne pouvez pas retirer cette personne.');
    await this.deps.db.query(`update members set status = 'removed', removed_at = $2 where id = $1`, [memberId, iso(this.now)]);
    // Pas de session à couper : l'appartenance est revérifiée à CHAQUE requête (requireAccess).
  }

  // --- Stock facultatif --------------------------------------------------------------------

  async listStock(actor: SessionUser, businessId: string) {
    const { access, business } = await requireAccess(this.deps.db, actor.id, businessId);
    if (!can(access, 'viewStock') && !can(access, 'submitReport')) throw forbidden();
    if (!business.stock_enabled) return [];
    return (await this.deps.db.query<{ id: string; name: string; initial_quantity: number }>('select id, name, initial_quantity from stock_items where business_id = $1 order by name', [businessId])).rows;
  }

  async addStockItem(actor: SessionUser, businessId: string, input: z.infer<typeof stockItemSchema>) {
    const { access, business } = await requireAccess(this.deps.db, actor.id, businessId);
    if (!can(access, 'manageStock')) throw forbidden();
    if (!business.stock_enabled) throw new AppError('conflict', 'Le module Stock n\'est pas activé.');
    const row = (await this.deps.db.query<{ id: string }>('insert into stock_items(business_id, name, initial_quantity) values ($1,$2,$3) returning id', [businessId, input.name, input.initialQuantity])).rows[0]!;
    return { id: row.id };
  }
}


import { can, COUNTRIES, stockLevels, subscriptionStatus, theoreticalCash, toDayKey, type Member, type Role } from '@gobilan/domain';
import type { Workspace } from '@gobilan/contracts';
import type { Deps } from '../deps';
import { requireAccess, subscriptionOf } from './access';
import type { SessionUser } from './auth';
import { BusinessService } from './business';
import { ReportService } from './reports';
import { SubscriptionService } from './subscriptions';

/** Authorized data for existing PWA screens; permission checks remain on every write. */
export class WorkspaceService {
  constructor(private readonly deps: Deps) {}
  async load(actor: SessionUser, id: string): Promise<Workspace> {
    const { business: b, access, memberId } = await requireAccess(this.deps.db, actor.id, id);
    const biz = new BusinessService(this.deps);
    const reportsService = new ReportService(this.deps);
    const business: Workspace['business'] = {
      id: b.id, ownerId: b.owner_id, name: b.name, country: b.country, sector: b.sector,
      stockEnabled: b.stock_enabled, reminderTime: b.reminder_time.slice(0, 5), createdAt: b.created_at.toISOString(),
      openingCash: b.opening_cash_amount === null ? null : { amount: Number(b.opening_cash_amount), day: b.opening_cash_day!, declaredById: b.opening_cash_by! },
    };
    const roles: Role[] = access.role ? [access.role] : [];
    const members: Member[] = [{ id: memberId, businessId: id, userId: actor.id, roleId: access.role?.id ?? null, status: 'active', joinedAt: business.createdAt }];
    const users: Workspace['users'] = [actor];
    let invitations: Workspace['invitations'] = [];
    if (can(access, 'viewTeam')) {
      roles.splice(0, roles.length, ...(await biz.listRoles(actor, id)).map(r => ({ ...r, businessId: id })));
      const rows = (await this.deps.db.query<{ id: string; user_id: string; role_id: string | null; joined_at: Date; name: string; phone: string; country: SessionUser['country'] }>(
        `select m.id, m.user_id, m.role_id, m.joined_at, u.name, u.phone, u.country from members m join users u on u.id=m.user_id where m.business_id=$1 and m.status='active'`, [id])).rows;
      members.splice(0, members.length, ...rows.map(r => ({ id: r.id, businessId: id, userId: r.user_id, roleId: r.role_id, status: 'active' as const, joinedAt: r.joined_at.toISOString() })));
      users.splice(0, users.length, ...rows.map(r => ({ id: r.user_id, name: r.name, phone: r.phone, country: r.country })));
      invitations = await this.invitations('i.business_id=$1', id);
    }
    // All authorized reports, without the old 60-report cutoff that corrupted cash/stock totals.
    const blockedOwner = access.isOwner && subscriptionStatus(subscriptionOf(b), this.deps.clock.now()) === 'blocked';
    if (blockedOwner) business.openingCash = null;
    const reports = blockedOwner ? [] : await reportsService.list(actor, id, Number.MAX_SAFE_INTEGER);
    const stock = (blockedOwner ? [] : await biz.listStock(actor, id)).map(r => ({ id: r.id, businessId: id, name: r.name, initialQuantity: r.initial_quantity }));
    // Stock quantities require the complete sales history, including other contributors.
    // Expose quantities, never other employees' reports to entry-only users.
    const allReports = can(access, 'viewAllReports') ? reports : await reportsService.listForStock(id);
    const subscription = { businessId: id, ...subscriptionOf(b), payments: access.isOwner ? (await new SubscriptionService(this.deps).view(actor, id)).payments : [] };
    return { business, roles, members, users, invitations, reports, stock, subscription,
      stockLevels: stockLevels(stock, allReports, id),
      theoreticalCash: !blockedOwner && can(access, 'viewDashboard') ? theoreticalCash(business, allReports, toDayKey(this.deps.clock.now(), COUNTRIES[b.country].utcOffsetMinutes))?.closing ?? null : null };
  }
  async invitations(where: 'i.business_id=$1' | 'i.phone=$1', value: string): Promise<Workspace['invitations']> {
    const rows = (await this.deps.db.query<{ id: string; business_id: string; business_name: string; phone: string; role_id: string; role_name: string; level: Role['level']; invited_by: string; invited_by_name: string; created_at: Date }>(
      `select i.*, b.name as business_name, r.name as role_name, r.level, u.name as invited_by_name from invitations i join businesses b on b.id=i.business_id join roles r on r.id=i.role_id join users u on u.id=i.invited_by where ${where} and i.status='pending' order by i.created_at`, [value])).rows;
    return rows.map(r => ({ id: r.id, businessId: r.business_id, businessName: r.business_name, phone: r.phone, roleId: r.role_id, roleName: r.role_name, level: r.level, invitedById: r.invited_by, invitedByName: r.invited_by_name, status: 'pending', createdAt: r.created_at.toISOString() }));
  }
}

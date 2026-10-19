import { COUNTRIES, stockLevels, toDayKey, type Access, type Business, type Id, type Subscription } from '@gobilan/domain';
import type { ApplicationState } from '@gobilan/contracts';
const cfg = (c: Business['country']) => COUNTRIES[c];

/** Read-only selectors shared by HTTP and demo state. No seeded data or local writes. */
export class StoreView<S extends ApplicationState> {
  private listeners = new Set<() => void>();
  private version = 0;
  constructor(public state: S) {}
  now(): number { return Date.now(); }
  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getVersion = () => this.version;
  protected emit() { this.version++; this.listeners.forEach(l => l()); }
  protected set(fn: (s: S) => void) { fn(this.state); this.emit(); }
  // --- Accès ---------------------------------------------------------------------------------
  get user(): S['users'][number] | null {
    return this.state.users.find((u) => u.id === this.state.sessionUserId) ?? null;
  }
  userById(id: Id): S['users'][number] | null {
    return this.state.users.find((u) => u.id === id) ?? null;
  }
  businessesOfUser(userId: Id): Business[] {
    const ids = new Set(this.state.members.filter((m) => m.userId === userId && m.status === 'active').map((m) => m.businessId));
    return this.state.businesses.filter((b) => ids.has(b.id));
  }
  accessOf(userId: Id, businessId: Id): Access | null {
    const m = this.state.members.find((x) => x.userId === userId && x.businessId === businessId && x.status === 'active');
    if (!m) return null;
    const role = m.roleId ? this.state.roles.find((r) => r.id === m.roleId) ?? null : null;
    return { businessId, userId, isOwner: m.roleId === null, role };
  }
  business(id: Id) {
    return this.state.businesses.find((b) => b.id === id) ?? null;
  }
  offsetOf(b: Business) {
    return cfg(b.country).utcOffsetMinutes;
  }
  todayOf(b: Business) {
    return toDayKey(this.now(), this.offsetOf(b));
  }
  subOf(businessId: Id): Subscription {
    return this.state.subs.find((s) => s.businessId === businessId) ?? { businessId, trialEndsAt: null, paidUntil: null, payments: [] };
  }
  reportsOf(businessId: Id) {
    return this.state.reports.filter((r) => r.businessId === businessId);
  }
  rolesOf(businessId: Id) {
    return this.state.roles.filter((r) => r.businessId === businessId);
  }
  stockOf(businessId: Id) {
    return this.state.stock.filter((s) => s.businessId === businessId);
  }
  membersOf(businessId: Id) {
    return this.state.members.filter((m) => m.businessId === businessId && m.status === 'active');
  }
  stockLevelsOf(businessId: Id) {
    return stockLevels(this.stockOf(businessId), this.reportsOf(businessId), businessId);
  }

}

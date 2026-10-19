import { COUNTRIES, normalizePhone, type CountryCode, type PermissionLevel, type ReportContent, type Sector } from '@gobilan/domain';
import { ApiError, createClient } from '@gobilan/ui';
import type { ApplicationState, Result, Workspace } from '@gobilan/contracts';
import { StoreView } from './StoreView';

const empty = (): ApplicationState => ({ users: [], businesses: [], roles: [], members: [], invitations: [], reports: [], stock: [], subs: [], sessionUserId: null });
type Api = ReturnType<typeof createClient>;
type Device = { deviceId: string; label: string };
export function installationDevice(): Device {
  let id = localStorage.getItem('gb-device');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('gb-device', id); }
  return { deviceId: id, label: 'GoBilan PWA' };
}

/** HTTP is the only write authority. No seeded data, PIN or session token stored locally. */
export class RemoteStore extends StoreView<ApplicationState> {
  readonly mode = 'api' as const;
  loading = false;
  initialized = false;
  error: string | null = null;
  loadError: string | null = null;
  otherDevices: { id: string; label: string | null; lastSeenAt: string }[] = [];
  private proof: string | null = null;
  private otp: { country: CountryCode; phone: string; purpose: 'signup' | 'pin_reset' | 'new_device' } | null = null;
  private workspaces = new Map<string, Workspace>();
  private requestIds = new Map<string, { content: string; id: string }>();
  private active = false;
  get busy() { return this.active; }
  constructor(private api: Api = createClient(), private device: () => Device = installationDevice) { super(empty()); }
  async refreshIfIdle() { if (!this.active && !this.loading) await this.refresh(); }
  async initialize() {
    if (this.initialized || this.loading) return;
    await this.refresh();
  }
  async refresh() {
    this.loading = true; this.error = null; this.loadError = null; this.emit();
    try {
      const { user } = await this.api<{ user: Workspace['users'][number] }>('/v1/me');
      const { businesses } = await this.api<{ businesses: { id: string }[] }>('/v1/businesses');
      const { invitations } = await this.api<{ invitations: Workspace['invitations'] }>('/v1/me/invitations');
      const loaded = await Promise.all(businesses.map(b => this.api<Workspace>(`/v1/businesses/${b.id}/workspace`)));
      const next = empty();
      next.sessionUserId = user.id;
      next.users = [user]; next.invitations = invitations;
      this.workspaces.clear();
      for (const w of loaded) {
        this.workspaces.set(w.business.id, w);
        next.businesses.push(w.business); next.roles.push(...w.roles); next.members.push(...w.members);
        next.users.push(...w.users); next.invitations.push(...w.invitations);
        next.reports.push(...w.reports); next.stock.push(...w.stock); next.subs.push(w.subscription);
      }
      next.users = [...new Map(next.users.map(u => [u.id, u])).values()];
      next.invitations = [...new Map(next.invitations.map(i => [i.id, i])).values()];
      this.state = next;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) this.clear();
      else { this.error = err instanceof Error ? err.message : 'Chargement impossible.'; this.loadError = this.error; this.state = empty(); this.workspaces.clear(); }
    } finally { this.loading = false; this.initialized = true; this.emit(); }
  }
  private clear() { this.state = empty(); this.workspaces.clear(); this.proof = null; this.requestIds.clear(); }
  private failure(err: unknown): Result<never> {
    const e = err instanceof ApiError ? err : new ApiError('internal', 'Une erreur est survenue.', 500);
    this.error = e.message;
    if (e.status === 401 && this.state.sessionUserId) this.clear();
    this.emit();
    return { ok: false, error: e.message, ...(e.retryAfterSeconds ? { retryAfterMs: e.retryAfterSeconds * 1000 } : {}), locked: e.code === 'locked', exhausted: e.code === 'otp_exhausted' };
  }
  private async run<T>(fn: () => Promise<T>): Promise<Result<T>> {
    if (this.active) return { ok: false, error: 'Une action est déjà en cours.' };
    this.active = true; this.error = null; this.emit();
    try { return { ok: true, value: await fn() } as Result<T>; }
    catch (e) { return this.failure(e); }
    finally { this.active = false; this.emit(); }
  }
  private async mutate<T>(path: string, body?: unknown, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'): Promise<Result<T>> {
    return this.run(async () => {
      const value = await this.api<T>(path, { method, ...(body !== undefined ? { body } : {}) });
      await this.refresh();
      return value;
    });
  }
  async startOtp(country: CountryCode, local: string, purpose: 'signup' | 'pin_reset' | 'new_device' = 'signup'): Promise<Result<{ code: string }>> {
    const phone = normalizePhone(country, local);
    if (!phone) return { ok: false, error: `Numéro invalide. Exemple : ${COUNTRIES[country].nationalExample}` };
    return this.run(async () => {
      // Only the development server accepts this token; production startup is blocked there.
      // A real CAPTCHA widget/provider remains an explicit release dependency.
      await this.api('/v1/auth/otp/request', { method: 'POST', body: { country, phone: local, purpose, device: this.device(), captchaToken: 'development-only' } });
      this.otp = { country, phone: local, purpose }; this.proof = null;
      return { code: '' }; // OTP is never returned to a real client.
    });
  }
  async verifyOtp(code: string): Promise<Result<{ next: 'pin_create' | 'logged_in' }>> {
    return this.run(async () => {
      if (!this.otp) throw new ApiError('validation', 'Demandez un code.', 400);
      const res = await this.api<{ kind: 'pin_required'; proof: string } | { kind: 'session'; otherDevices: RemoteStore['otherDevices'] }>('/v1/auth/otp/verify', { method: 'POST', body: { ...this.otp, code, device: this.device() } });
      if (res.kind === 'pin_required') { this.proof = res.proof; return { next: 'pin_create' as const }; }
      this.otherDevices = res.otherDevices; await this.refresh(); return { next: 'logged_in' as const };
    });
  }
  async createPin(pin: string): Promise<Result> {
    return this.run(async () => {
      if (!this.proof) throw new ApiError('validation', 'Validez votre numéro.', 400);
      await this.api('/v1/auth/pin/create', { method: 'POST', body: { otpProof: this.proof, pin, device: this.device() } });
      this.proof = null; await this.refresh();
    });
  }
  async loginPin(phone: string, pin: string): Promise<Result> {
    return this.run(async () => { await this.api('/v1/auth/pin/login', { method: 'POST', body: { phone, pin, device: this.device() } }); await this.refresh(); });
  }
  logout() { return this.run(async () => { await this.api('/v1/auth/logout', { method: 'POST' }); this.clear(); }); }
  logoutOtherDevices() { return this.run(async () => { await this.api('/v1/auth/devices/logout-others', { method: 'POST' }); this.otherDevices = []; }); }
  setProfile(name: string, referralCode?: string) { return this.mutate<void>('/v1/me/profile', { name, referralCode }, 'PUT'); }
  createBusiness(name: string, sector: Sector, stockEnabled: boolean) { return this.mutate<{ id: string }>('/v1/businesses', { name, sector, stockEnabled, country: this.user?.country }); }
  createRole(bid: string, name: string, level: PermissionLevel) { return this.mutate<{ id: string }>(`/v1/businesses/${bid}/roles`, { name, level }); }
  updateRole(bid: string, id: string, name: string, level: PermissionLevel) { return this.mutate<void>(`/v1/businesses/${bid}/roles/${id}`, { name, level }, 'PUT'); }
  archiveRole(bid: string, id: string) { return this.mutate<void>(`/v1/businesses/${bid}/roles/${id}`, undefined, 'DELETE'); }
  invite(bid: string, phone: string, roleId: string) {
    const b = this.business(bid); const normalized = b ? normalizePhone(b.country, phone) : null;
    if (!normalized) return Promise.resolve({ ok: false as const, error: 'Numéro WhatsApp invalide.' });
    return this.mutate<void>(`/v1/businesses/${bid}/invitations`, { phone: normalized, roleId });
  }
  removeMember(bid: string, id: string) { return this.mutate<void>(`/v1/businesses/${bid}/members/${id}`, undefined, 'DELETE'); }
  invitationsFor(userId: string) { return this.state.invitations.filter(i => i.phone === this.userById(userId)?.phone && i.status === 'pending'); }
  respondInvitation(id: string, accept: boolean) { return this.mutate<void>(`/v1/invitations/${id}/respond`, { accept }); }
  setReminder(bid: string, reminderTime: string) { return this.mutate<void>(`/v1/businesses/${bid}`, { reminderTime }, 'PATCH'); }
  addStockItem(bid: string, name: string, initialQuantity: number) { return this.mutate<void>(`/v1/businesses/${bid}/stock`, { name, initialQuantity }); }
  submitReport(bid: string, content: ReportContent, openingCash: number | null) {
    const serialized = JSON.stringify({ content, openingCash });
    let request = this.requestIds.get(bid);
    if (request?.content !== serialized) { request = { content: serialized, id: crypto.randomUUID() }; this.requestIds.set(bid, request); }
    const id = request.id;
    return this.run(async () => {
      const value = await this.api<{ id: string }>(`/v1/businesses/${bid}/reports`, { method: 'POST', body: { content, ...(openingCash !== null ? { openingCash } : {}), clientRequestId: id } });
      this.requestIds.delete(bid); await this.refresh(); return value;
    });
  }
  editReport(id: string, content: ReportContent) { return this.mutate<void>(`/v1/reports/${id}`, { content }, 'PUT'); }
  override stockLevelsOf(bid: string) { return this.workspaces.get(bid)?.stockLevels ?? []; }
  cashOf(bid: string) { return this.workspaces.get(bid)?.theoreticalCash ?? null; }
}

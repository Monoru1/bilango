/**
 * MODE DEMO — AUCUN appel réseau. Toutes les données vivent en mémoire et disparaissent au
 * rechargement. Les règles métier viennent de @gobilan/domain (les mêmes que celles du serveur).
 * Simulé ici (et NON réel) : WhatsApp/OTP (le code est affiché à l'écran), paiement FedaPay,
 * notifications push, anti-abus d'essai, parrainage.
 * L'intégration avec l'API réelle (packages/contracts) reste à brancher : voir docs/CODEX_HANDOFF.md.
 */
import { StoreView } from '../app/StoreView';
import type { Result } from '@gobilan/contracts';
export type { Result } from '@gobilan/contracts';
import {
  COUNTRIES, DAY_MS, INITIAL_PIN_STATE, OTP_MAX_ATTEMPTS, OTP_TTL_MS, PIN_LENGTH, SUBSCRIPTION_DAYS, SUBSCRIPTION_PRICE_FCFA, can, canEditReport, canManageMember,
  evaluateOtpIssue, extendedPaidUntil, finalizeContent, isPinLocked, normalizePhone, pinRetryAfterMs, registerPinFailure, registerPinSuccess, remainingStockExcluding,
  toDayKey, trialEndsAtFrom, validateDraft,
  type Business, type CountryCode, type DraftValidation, type Id, type Invitation, type Member, type PermissionLevel, type PinState, type Report,
  type ReportContent, type Role, type Sector, type StockItem, type Subscription, type User,
} from '@gobilan/domain';

export interface DemoUser extends User {
  country: CountryCode;
  pin: string | null;
  pinState: PinState;
  referralCode?: string;
}

export interface Draft {
  country: CountryCode | null;
  phone: string | null;
  otpCode: string | null;
  otpIssuedAt: number[];
  otpAttempts: number;
  otpVerified: boolean;
  otpPurpose: 'signup' | 'pin_reset' | 'new_device';
}

export interface DemoState {
  users: DemoUser[];
  businesses: Business[];
  roles: Role[];
  members: Member[];
  invitations: Invitation[];
  reports: Report[];
  stock: StockItem[];
  subs: Subscription[];
  sessionUserId: Id | null;
  draft: Draft;
  /** Décalage de l'horloge de démonstration, pour montrer les pop-ups J-3, grâce et blocage. */
  clockOffsetDays: number;
}

let seq = 0;
const nid = (p: string) => `${p}_${++seq}_${Math.random().toString(36).slice(2, 7)}`;
const cfg = (c: CountryCode) => COUNTRIES[c];
const emptyAmt = { total: 0, lines: [] };

export const DEMO_PERSONAS = { owner: 'u_owner', cashier: 'u_awa', manager: 'u_moussa' } as const;

function seedState(now: number): DemoState {
  const off = cfg('BJ').utcOffsetMinutes;
  const today = toDayKey(now, off);
  const day = (n: number) => toDayKey(now - n * DAY_MS, off);
  const at = (n: number, hh: number, mm: number) => new Date(Date.parse(`${day(n)}T00:00:00.000Z`) + (hh * 60 + mm) * 60_000 - off * 60_000).toISOString();
  const users: DemoUser[] = [
    { id: 'u_owner', phone: '+22997000001', name: 'Dossou Bio', country: 'BJ', pin: '1234', pinState: INITIAL_PIN_STATE },
    { id: 'u_awa', phone: '+22997000002', name: 'Awa Sanni', country: 'BJ', pin: '1234', pinState: INITIAL_PIN_STATE },
    { id: 'u_moussa', phone: '+22997000003', name: 'Moussa Adam', country: 'BJ', pin: '1234', pinState: INITIAL_PIN_STATE },
  ];
  const biz: Business = { id: 'b_etoile', ownerId: 'u_owner', name: 'Boutique Étoile', country: 'BJ', sector: 'boutique', stockEnabled: false, reminderTime: '20:00', openingCash: null, createdAt: at(30, 9, 0) };
  const roles: Role[] = [
    { id: 'r_cashier', businessId: biz.id, name: 'Caissière', level: 'entry' },
    { id: 'r_manager', businessId: biz.id, name: 'Gérant', level: 'full' },
  ];
  const members: Member[] = [
    { id: 'm_owner', businessId: biz.id, userId: 'u_owner', roleId: null, status: 'active', joinedAt: biz.createdAt },
    { id: 'm_awa', businessId: biz.id, userId: 'u_awa', roleId: 'r_cashier', status: 'active', joinedAt: biz.createdAt },
    { id: 'm_moussa', businessId: biz.id, userId: 'u_moussa', roleId: 'r_manager', status: 'active', joinedAt: biz.createdAt },
  ];
  // Historique : 7 jours précédents. La caisse de départ est calculée pour que la caisse de la veille vaille 377 000.
  const hist: [number, number, number][] = [[7, 38_400, 4_500], [6, 53_200, 7_000], [5, 41_800, 3_000], [4, 47_500, 6_200], [3, 44_900, 5_100], [2, 41_800, 2_500], [1, 59_100, 8_400]];
  const reports: Report[] = hist.map(([n, revenue, expenses], i) => ({
    id: `rep_${i}`, businessId: biz.id, day: day(n), authorId: 'u_awa', authorName: 'Awa Sanni', submittedAt: at(n, 19, 30 + (i % 20)),
    versions: [{ savedAt: at(n, 19, 30 + (i % 20)), content: { revenue: { total: revenue, lines: [] }, expenses: { total: expenses, lines: [] }, cashIn: emptyAmt, stockSales: [], note: '' } }],
  }));
  const net = hist.reduce((s, [, r, e]) => s + r - e, 0);
  biz.openingCash = { amount: 377_000 - net, day: day(7), declaredById: 'u_awa' };
  const subs: Subscription[] = [{ businessId: biz.id, trialEndsAt: trialEndsAtFrom(Date.parse(biz.createdAt) + 25 * DAY_MS), paidUntil: new Date(now + 24 * DAY_MS).toISOString(), payments: [{ id: 'p_demo1', paidAt: at(6, 10, 0), amount: SUBSCRIPTION_PRICE_FCFA, provider: 'MTN (DEMO)', reference: 'SUB-DEMO0001-2026-10' }] }];
  void today;
  return {
    users, businesses: [biz], roles, members, invitations: [], reports, stock: [], subs,
    sessionUserId: null, clockOffsetDays: 0,
    draft: { country: null, phone: null, otpCode: null, otpIssuedAt: [], otpAttempts: 0, otpVerified: false, otpPurpose: 'signup' },
  };
}

const fail = (error: string, extra: Partial<{ retryAfterMs: number; locked: boolean; exhausted: boolean }> = {}) => ({ ok: false as const, error, ...extra });

export class DemoStore extends StoreView<DemoState> {
  readonly mode = 'demo' as const;
  /** Dernier code « envoyé » : affiché à l'écran en mode démo, aucune vraie livraison WhatsApp. */
  lastDemoOtp: string | null = null;

  constructor(private readonly realNow: () => number = Date.now) {
    super(seedState(realNow()));
  }

  override now(): number {
    return this.realNow() + this.state.clockOffsetDays * DAY_MS;
  }
  reset() {
    seq = 0;
    this.state = seedState(this.realNow());
    this.lastDemoOtp = null;
    this.emit();
  }
  /** Avance l'horloge de démonstration pour illustrer J-3, grâce (1 à 3) et blocage (§8.3). */
  advanceDemoClock(days: number) {
    this.set((s) => {
      s.clockOffsetDays += days;
    });
  }

  // --- Connexion démo ---------------------------------------------------------------------------
  loginAsPersona(userId: Id) {
    this.set((s) => {
      s.sessionUserId = userId;
    });
  }
  logout() {
    this.set((s) => {
      s.sessionUserId = null;
    });
  }

  // --- Onboarding (§4.1) : OTP simulé --------------------------------------------------------------
  startOtp(country: CountryCode, localPhone: string, purpose: Draft['otpPurpose'] = 'signup'): Result<{ code: string }> {
    const phone = normalizePhone(country, localPhone);
    if (!phone) return fail(`Numéro invalide. Exemple : ${cfg(country).nationalExample}`);
    const now = this.now();
    const existing = this.state.users.find((u) => u.phone === phone);
    if (purpose === 'signup' && existing && existing.pin) purpose = 'new_device';
    const decision = evaluateOtpIssue(this.state.draft.otpIssuedAt, now);
    if (!decision.allowed) return fail('Vous avez atteint la limite de codes pour 24 heures. Contactez le support : contact@gobilan.com', { exhausted: true });
    const code = String(Math.floor(1000 + Math.random() * 9000));
    this.lastDemoOtp = code;
    this.set((s) => {
      s.draft = { ...s.draft, country, phone, otpCode: code, otpIssuedAt: [...s.draft.otpIssuedAt.filter((t) => t > now - DAY_MS), now], otpAttempts: 0, otpVerified: false, otpPurpose: purpose };
    });
    return { ok: true, value: { code } };
  }

  verifyOtp(code: string): Result<{ next: 'pin_create' | 'logged_in' }> {
    const d = this.state.draft;
    const now = this.now();
    if (!d.otpCode || !d.phone) return fail('Demandez un nouveau code.');
    const issued = d.otpIssuedAt[d.otpIssuedAt.length - 1] ?? 0;
    if (now - issued > OTP_TTL_MS) return fail('Ce code a expiré. Demandez-en un nouveau.');
    if (d.otpAttempts >= OTP_MAX_ATTEMPTS) return fail('Trop d’essais.', { exhausted: true });
    if (code !== d.otpCode) {
      const attempts = d.otpAttempts + 1;
      this.set((s) => {
        s.draft.otpAttempts = attempts;
      });
      return attempts >= OTP_MAX_ATTEMPTS ? fail('Trop d’essais.', { exhausted: true }) : fail(`Code incorrect. Il vous reste ${OTP_MAX_ATTEMPTS - attempts} essai${OTP_MAX_ATTEMPTS - attempts > 1 ? 's' : ''}.`);
    }
    this.set((s) => {
      s.draft.otpCode = null; // usage unique
      s.draft.otpVerified = true;
    });
    // Compte existant sur un nouvel appareil : accès direct après OTP (§4.3), sauf réinitialisation de PIN.
    const existing = this.state.users.find((u) => u.phone === d.phone);
    if (existing && d.otpPurpose === 'new_device' && existing.pin) {
      this.loginAsPersona(existing.id);
      return { ok: true, value: { next: 'logged_in' } };
    }
    return { ok: true, value: { next: 'pin_create' } };
  }

  createPin(pin: string): Result {
    const d = this.state.draft;
    if (!d.otpVerified || !d.phone || !d.country) return fail('Validez d’abord votre numéro.');
    if (!/^\d{4}$/.test(pin)) return fail(`Le PIN contient ${PIN_LENGTH} chiffres.`);
    this.set((s) => {
      const u = s.users.find((x) => x.phone === d.phone);
      if (u) {
        u.pin = pin;
        u.pinState = registerPinSuccess();
        s.sessionUserId = u.id;
      } else {
        const user: DemoUser = { id: nid('u'), phone: d.phone as string, name: '', country: d.country as CountryCode, pin, pinState: INITIAL_PIN_STATE };
        s.users.push(user);
        s.sessionUserId = user.id;
      }
    });
    return { ok: true };
  }

  loginPin(userId: Id, pin: string): Result {
    const u = this.userById(userId);
    if (!u?.pin) return fail('Compte introuvable.');
    const now = this.now();
    if (isPinLocked(u.pinState, now)) return fail('Trop d’erreurs.', { locked: true, retryAfterMs: pinRetryAfterMs(u.pinState, now) });
    if (u.pin === pin) {
      this.set((s) => {
        const x = s.users.find((y) => y.id === userId);
        if (x) x.pinState = registerPinSuccess();
        s.sessionUserId = userId;
      });
      return { ok: true };
    }
    const next = registerPinFailure(u.pinState, now);
    this.set((s) => {
      const x = s.users.find((y) => y.id === userId);
      if (x) x.pinState = next;
    });
    if (isPinLocked(next, now)) return fail('Trop d’erreurs.', { locked: true, retryAfterMs: pinRetryAfterMs(next, now) });
    return fail('PIN incorrect.');
  }

  setProfile(name: string, referralCode?: string): Result {
    const u = this.user;
    if (!u) return fail('Session expirée.');
    const n = name.trim();
    if (!n) return fail('Entrez votre nom.');
    this.set((s) => {
      const x = s.users.find((y) => y.id === u.id);
      if (x) {
        x.name = n;
        if (referralCode?.trim()) x.referralCode = referralCode.trim().toUpperCase();
      }
      // Invitations en attente adressées à ce numéro : liaison automatique (§4.5).
    });
    return { ok: true };
  }

  createBusiness(name: string, sector: Sector, stockEnabled: boolean): Result<{ id: Id }> {
    const u = this.user;
    if (!u) return fail('Session expirée.');
    const n = name.trim();
    if (!n) return fail('Entrez le nom du business.');
    const id = nid('b');
    const now = this.now();
    // Essai de 7 jours UNE seule fois par numéro (anti-abus, §8.1) — simulé ici.
    const hadTrial = this.state.businesses.some((b) => b.ownerId === u.id);
    this.set((s) => {
      s.businesses.push({ id, ownerId: u.id, name: n, country: u.country, sector, stockEnabled, reminderTime: '20:00', openingCash: null, createdAt: new Date(now).toISOString() });
      s.members.push({ id: nid('m'), businessId: id, userId: u.id, roleId: null, status: 'active', joinedAt: new Date(now).toISOString() });
      s.subs.push({ businessId: id, trialEndsAt: hadTrial ? null : trialEndsAtFrom(now), paidUntil: null, payments: [] });
    });
    return { ok: true, value: { id } };
  }

  // --- Invitations / équipe --------------------------------------------------------------------
  invitationsFor(userId: Id): Invitation[] {
    const u = this.userById(userId);
    return u ? this.state.invitations.filter((i) => i.phone === u.phone && i.status === 'pending') : [];
  }
  respondInvitation(id: Id, accept: boolean): Result {
    const u = this.user;
    const inv = this.state.invitations.find((i) => i.id === id && i.phone === u?.phone && i.status === 'pending');
    if (!u || !inv) return fail('Invitation introuvable.');
    this.set((s) => {
      const i = s.invitations.find((x) => x.id === id);
      if (!i) return;
      i.status = accept ? 'accepted' : 'declined';
      if (accept) s.members.push({ id: nid('m'), businessId: i.businessId, userId: u.id, roleId: i.roleId, status: 'active', joinedAt: new Date(this.now()).toISOString() });
    });
    return { ok: true };
  }
  createRole(businessId: Id, name: string, level: PermissionLevel): Result<{ id: Id }> {
    const a = this.user && this.accessOf(this.user.id, businessId);
    if (!a || !can(a, 'createRoles')) return fail('Action non autorisée.');
    if (!name.trim()) return fail('Donnez un nom au rôle.');
    const id = nid('r');
    this.set((s) => void s.roles.push({ id, businessId, name: name.trim(), level }));
    return { ok: true, value: { id } };
  }
  updateRole(businessId: Id, roleId: Id, name: string, level: PermissionLevel): Result {
    const access = this.user && this.accessOf(this.user.id, businessId);
    if (!access || !can(access, 'createRoles')) return fail('Action non autorisée.');
    const role = this.state.roles.find(r => r.id === roleId && r.businessId === businessId);
    if (!role || !name.trim()) return fail('Rôle ou nom invalide.');
    this.set(() => { role.name = name.trim(); role.level = level; }); return { ok: true };
  }
  archiveRole(businessId: Id, roleId: Id): Result {
    const access = this.user && this.accessOf(this.user.id, businessId);
    if (!access || !can(access, 'createRoles')) return fail('Action non autorisée.');
    if (this.state.members.some(m => m.roleId === roleId && m.status === 'active') || this.state.invitations.some(i => i.roleId === roleId && i.status === 'pending')) return fail('Ce rôle est attribué ou proposé dans une invitation.');
    this.set(s => { s.roles = s.roles.filter(r => !(r.businessId === businessId && r.id === roleId)); }); return { ok: true };
  }
  invite(businessId: Id, localPhone: string, roleId: Id): Result {
    const u = this.user;
    const a = u && this.accessOf(u.id, businessId);
    const b = this.business(businessId);
    const role = this.state.roles.find((r) => r.id === roleId && r.businessId === businessId);
    if (!u || !a || !b || !role || !can(a, 'manageTeam')) return fail('Action non autorisée.');
    const phone = normalizePhone(b.country, localPhone);
    if (!phone) return fail('Numéro WhatsApp invalide pour ce pays.');
    if (this.state.invitations.some((i) => i.businessId === businessId && i.phone === phone && i.status === 'pending')) return fail('Une invitation est déjà en attente pour ce numéro.');
    this.set((s) =>
      void s.invitations.push({ id: nid('i'), businessId, businessName: b.name, phone, roleId, roleName: role.name, level: role.level, invitedById: u.id, invitedByName: u.name, status: 'pending', createdAt: new Date(this.now()).toISOString() }),
    );
    return { ok: true };
  }
  removeMember(businessId: Id, memberId: Id): Result {
    const u = this.user;
    const a = u && this.accessOf(u.id, businessId);
    const m = this.state.members.find((x) => x.id === memberId && x.businessId === businessId && x.status === 'active');
    if (!u || !a || !m) return fail('Action non autorisée.');
    const target = this.accessOf(m.userId, businessId);
    if (!target || !canManageMember(a, target)) return fail('Vous ne pouvez pas retirer cette personne.');
    this.set((s) => {
      const x = s.members.find((y) => y.id === memberId);
      if (x) {
        x.status = 'removed'; // suppression logique : ses bilans restent, avec son nom (§5.4)
        x.removedAt = new Date(this.now()).toISOString();
      }
    });
    return { ok: true };
  }

  // --- Bilans (§6) ----------------------------------------------------------------------------
  validate(businessId: Id, content: ReportContent, openingCash: number | null, excludeReportId?: Id): DraftValidation {
    const b = this.business(businessId);
    if (!b) return { ok: false, errors: {} };
    const remaining = b.stockEnabled ? remainingStockExcluding(this.stockOf(businessId), this.reportsOf(businessId), businessId, excludeReportId) : undefined;
    return validateDraft(content, { openingCashRequired: b.openingCash === null, openingCash, ...(remaining ? { remainingStock: remaining } : {}) });
  }

  submitReport(businessId: Id, content: ReportContent, openingCash: number | null): Result<{ id: Id }> {
    const u = this.user;
    const b = this.business(businessId);
    const a = u && this.accessOf(u.id, businessId);
    if (!u || !b || !a || !can(a, 'submitReport')) return fail('Action non autorisée.');
    const check = this.validate(businessId, content, openingCash);
    if (!check.ok) return fail(Object.values(check.errors)[0] ?? 'Bilan invalide.');
    const id = nid('rep');
    const now = this.now();
    const iso = new Date(now).toISOString();
    const final = finalizeContent(content);
    this.set((s) => {
      const biz = s.businesses.find((x) => x.id === businessId);
      if (biz && biz.openingCash === null && openingCash !== null) biz.openingCash = { amount: openingCash, day: toDayKey(now, this.offsetOf(b)), declaredById: u.id };
      s.reports.push({ id, businessId, day: toDayKey(now, this.offsetOf(b)), authorId: u.id, authorName: u.name, submittedAt: iso, versions: [{ content: final, savedAt: iso }] });
    });
    return { ok: true, value: { id } };
  }

  editReport(reportId: Id, content: ReportContent): Result {
    const u = this.user;
    const r = this.state.reports.find((x) => x.id === reportId);
    const a = u && r && this.accessOf(u.id, r.businessId);
    if (!u || !r || !a) return fail('Bilan introuvable.');
    if (!canEditReport(a, r, u.id, this.now())) return fail('Ce bilan ne peut plus être modifié (24 h maximum après l’envoi).');
    const check = this.validate(r.businessId, content, null, reportId);
    if (!check.ok && !(Object.keys(check.errors).length === 1 && check.errors.openingCash)) return fail(Object.values(check.errors)[0] ?? 'Bilan invalide.');
    this.set((s) => void s.reports.find((x) => x.id === reportId)?.versions.push({ content: finalizeContent(content), savedAt: new Date(this.now()).toISOString() }));
    return { ok: true };
  }

  setReminder(businessId: Id, hhmm: string): Result {
    const a = this.user && this.accessOf(this.user.id, businessId);
    if (!a?.isOwner || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)) return fail('Heure invalide.');
    this.set((s) => {
      const b = s.businesses.find((x) => x.id === businessId);
      if (b) b.reminderTime = hhmm;
    });
    return { ok: true };
  }

  addStockItem(businessId: Id, name: string, initialQuantity: number): Result {
    const a = this.user && this.accessOf(this.user.id, businessId);
    if (!a || !can(a, 'manageStock')) return fail('Action non autorisée.');
    if (!name.trim() || !Number.isInteger(initialQuantity) || initialQuantity < 0) return fail('Article ou quantité invalide.');
    this.set((s) => void s.stock.push({ id: nid('s'), businessId, name: name.trim(), initialQuantity }));
    return { ok: true };
  }

  // --- Abonnement : paiement FedaPay SIMULÉ ---------------------------------------------------------
  /** DEMO : aucun argent ne circule. Applique la règle réelle de prolongation (§8.1). */
  simulatePayment(businessId: Id): Result {
    const a = this.user && this.accessOf(this.user.id, businessId);
    if (!a?.isOwner) return fail('Seul le propriétaire peut renouveler.');
    const now = this.now();
    this.set((s) => {
      const sub = s.subs.find((x) => x.businessId === businessId);
      if (!sub) return;
      sub.paidUntil = extendedPaidUntil(sub, now);
      sub.payments.push({ id: nid('p'), paidAt: new Date(now).toISOString(), amount: SUBSCRIPTION_PRICE_FCFA, provider: 'DEMO (aucun paiement réel)', reference: `SUB-DEMO${String(s.subs.length).padStart(4, '0')}-${new Date(now).toISOString().slice(0, 7)}` });
    });
    return { ok: true };
  }
}

export const SUBSCRIPTION_DAYS_LABEL = `${SUBSCRIPTION_DAYS} jours`;

import { toDayKey } from '@/domain/dates';
import { normalizeBeninPhone } from '@/domain/money';
import {
  can,
  canEditReport,
  canGrantLevel,
  canManageMember,
  canViewReport,
} from '@/domain/permissions';
import {
  buildHeadline,
  finalizeContent,
  latestReportDay,
  remainingStockExcluding,
  reportsOfDay,
  stockLevels,
  theoreticalCash,
  totalsOfDay,
  totalsOfPeriod,
  validateDraft,
} from '@/domain/reports';
import { daysRemaining, subscriptionEnd, subscriptionStatus } from '@/domain/subscription';
import type { Access, Id, Invitation, Member, Report, ReportContent, User } from '@/domain/types';
import {
  ServiceError,
  type DashboardData,
  type DayView,
  type ManagerHome,
  type MemberView,
  type Services,
} from '../types';
import { buildSeed, DEMO_OTP_CODE, type MockDb } from './seed';

export const MOCK_OTP_COOLDOWN_SECONDS = 30;
const OTP_MAX_PER_DAY = 5;
const NAME_MAX = 40;

export interface MockOptions {
  now?: () => number;
  /** Latence simulée en ms (0 dans les tests). */
  latencyMs?: number;
}

/**
 * Implémentation en mémoire du contrat `Services`, pour la démonstration et les tests.
 * Elle applique les mêmes règles de permission que le futur serveur, mais n'offre aucune
 * sécurité réelle : tout s'exécute sur l'appareil. Le code OTP de démo est `123456`.
 */
export function createMockServices(options: MockOptions = {}): Services & { db: () => MockDb } {
  const now = options.now ?? Date.now;
  const latency = options.latencyMs ?? 250;
  let db = buildSeed(now());
  const listeners = new Set<() => void>();
  let counter = 0;
  const uid = (prefix: string) => `${prefix}-${now().toString(36)}-${++counter}`;
  const otpRequests = new Map<string, number[]>();

  const wait = () => (latency > 0 ? new Promise<void>((r) => setTimeout(r, latency)) : Promise.resolve());
  const notify = () => listeners.forEach((l) => l());

  async function read<T>(fn: () => T): Promise<T> {
    await wait();
    return fn();
  }

  async function write<T>(fn: () => T): Promise<T> {
    await wait();
    const result = fn();
    notify();
    return result;
  }

  // --- Résolution des droits -----------------------------------------------------

  function accessOf(businessId: Id, userId: Id): Access {
    const business = db.businesses.find((b) => b.id === businessId);
    if (!business) throw new ServiceError('NOT_FOUND', 'Business introuvable.');
    const m = db.members.find((x) => x.businessId === businessId && x.userId === userId && x.status === 'active');
    if (!m) throw new ServiceError('FORBIDDEN', "Vous n'avez pas accès à ce business.");
    const role = m.roleId ? (db.roles.find((r) => r.id === m.roleId) ?? null) : null;
    return { businessId, userId, isOwner: business.ownerId === userId, role };
  }

  function requireCapability(access: Access, capability: Parameters<typeof can>[1], message?: string) {
    if (!can(access, capability)) {
      throw new ServiceError('FORBIDDEN', message ?? "Votre rôle ne permet pas cette action.");
    }
  }

  function userById(id: Id): User {
    const u = db.users.find((x) => x.id === id);
    if (!u) throw new ServiceError('NOT_FOUND', 'Utilisateur introuvable.');
    return u;
  }

  function businessReports(businessId: Id): Report[] {
    return db.reports.filter((r) => r.businessId === businessId);
  }

  function visibleReports(access: Access, userId: Id): Report[] {
    return businessReports(access.businessId).filter((r) => canViewReport(access, r, userId));
  }

  function cashFor(businessId: Id, day: string) {
    const business = db.businesses.find((b) => b.id === businessId)!;
    return theoreticalCash(business, businessReports(businessId), day);
  }

  // --- Auth ----------------------------------------------------------------------

  const auth: Services['auth'] = {
    requestOtp: (phone) =>
      write(() => {
        if (!normalizeBeninPhone(phone)) throw new ServiceError('VALIDATION', 'Numéro de téléphone invalide.');
        const t = now();
        const recent = (otpRequests.get(phone) ?? []).filter((x) => t - x < 24 * 3600_000);
        const last = recent[recent.length - 1];
        if (last !== undefined && t - last < MOCK_OTP_COOLDOWN_SECONDS * 1000) {
          const seconds = Math.ceil((MOCK_OTP_COOLDOWN_SECONDS * 1000 - (t - last)) / 1000);
          throw new ServiceError('RATE_LIMITED', `Patientez ${seconds} s avant de demander un nouveau code.`);
        }
        if (recent.length >= OTP_MAX_PER_DAY) {
          throw new ServiceError('RATE_LIMITED', 'Trop de codes demandés aujourd’hui. Réessayez demain.');
        }
        otpRequests.set(phone, [...recent, t]);
        return { retryAfterSeconds: MOCK_OTP_COOLDOWN_SECONDS };
      }),

    verifyOtp: (phone, code) =>
      write(() => {
        if (code !== DEMO_OTP_CODE) throw new ServiceError('INVALID_OTP', 'Code incorrect. Vérifiez le code reçu.');
        let user = db.users.find((u) => u.phone === phone);
        if (!user) {
          user = { id: uid('u'), phone, name: '' };
          db = { ...db, users: [...db.users, user] };
        }
        return { token: `mock-token:${user.id}`, user };
      }),

    restoreSession: (token) =>
      read(() => {
        const id = token.startsWith('mock-token:') ? token.slice('mock-token:'.length) : null;
        return db.users.find((u) => u.id === id) ?? null;
      }),

    updateName: (userId, name) =>
      write(() => {
        const trimmed = name.trim();
        if (trimmed.length < 2) throw new ServiceError('VALIDATION', 'Indiquez votre nom (2 caractères minimum).');
        if (trimmed.length > NAME_MAX) throw new ServiceError('VALIDATION', `Le nom est limité à ${NAME_MAX} caractères.`);
        const updated = { ...userById(userId), name: trimmed };
        db = { ...db, users: db.users.map((u) => (u.id === userId ? updated : u)) };
        return updated;
      }),
  };

  // --- Businesses ----------------------------------------------------------------

  const businesses: Services['businesses'] = {
    listMine: (userId) =>
      read(() => {
        const today = toDayKey(now());
        return db.members
          .filter((m) => m.userId === userId && m.status === 'active')
          .map((m) => {
            const access = accessOf(m.businessId, userId);
            const business = db.businesses.find((b) => b.id === m.businessId)!;
            const totals = totalsOfDay(businessReports(business.id), business.id, today);
            const visible = can(access, 'viewDashboard') && totals.reportCount > 0;
            return { business, access, todayRevenue: visible ? totals.revenue : null };
          })
          .sort((a, b) => Number(b.access.isOwner) - Number(a.access.isOwner) || a.business.name.localeCompare(b.business.name));
      }),

    getAccess: (businessId, userId) =>
      read(() => ({
        business: db.businesses.find((b) => b.id === businessId)!,
        access: accessOf(businessId, userId),
      })),

    create: (userId, input) =>
      write(() => {
        const name = input.name.trim();
        if (name.length < 2) throw new ServiceError('VALIDATION', 'Indiquez le nom du business.');
        if (name.length > 50) throw new ServiceError('VALIDATION', 'Le nom est limité à 50 caractères.');
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.reminderTime)) {
          throw new ServiceError('VALIDATION', "Heure de rappel invalide (format HH:mm).");
        }
        const business = {
          id: uid('b'),
          ownerId: userId,
          name,
          sector: input.sector,
          stockEnabled: input.stockEnabled,
          reminderTime: input.reminderTime,
          openingCash: null,
          createdAt: new Date(now()).toISOString(),
        };
        const ownerMember: Member = {
          id: uid('m'),
          businessId: business.id,
          userId,
          roleId: null,
          status: 'active',
          joinedAt: business.createdAt,
        };
        // Suggestions de rôles pré-remplies selon le secteur (cahier §4.1), modifiables ensuite.
        const suggestions: Record<string, [string, 'entry' | 'full' | 'readonly'][]> = {
          bar_restaurant: [['Gérant', 'full'], ['Serveur', 'entry'], ['Caissier', 'entry']],
          boutique: [['Gérant', 'full'], ['Vendeur', 'entry']],
          ecommerce: [['Livreur', 'entry'], ['Closer', 'entry']],
          other: [['Responsable', 'full'], ['Employé', 'entry']],
        };
        const roles = suggestions[input.sector].map(([roleName, level]) => ({
          id: uid('r'),
          businessId: business.id,
          name: roleName,
          level,
        }));
        const trialEnd = new Date(now() + 7 * 24 * 3600_000).toISOString();
        db = {
          ...db,
          businesses: [...db.businesses, business],
          members: [...db.members, ownerMember],
          roles: [...db.roles, ...roles],
          subscriptions: [...db.subscriptions, { businessId: business.id, trialEndsAt: trialEnd, paidUntil: null, payments: [] }],
        };
        return business;
      }),

    updateReminderTime: (businessId, userId, reminderTime) =>
      write(() => {
        const access = accessOf(businessId, userId);
        if (!access.isOwner) throw new ServiceError('FORBIDDEN', "Seul le propriétaire fixe l'heure de rappel.");
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) {
          throw new ServiceError('VALIDATION', 'Heure invalide (format HH:mm).');
        }
        const updated = { ...db.businesses.find((b) => b.id === businessId)!, reminderTime };
        db = { ...db, businesses: db.businesses.map((b) => (b.id === businessId ? updated : b)) };
        return updated;
      }),
  };

  // --- Bilans --------------------------------------------------------------------

  const reports: Services['reports'] = {
    dashboard: (businessId, userId, periodDays) =>
      read((): DashboardData => {
        const access = accessOf(businessId, userId);
        requireCapability(access, 'viewDashboard');
        const today = toDayKey(now());
        const all = businessReports(businessId);
        const business = db.businesses.find((b) => b.id === businessId)!;
        const headline = buildHeadline(all, businessId, today);
        return {
          headline,
          headlineTotals: headline.day ? totalsOfDay(all, businessId, headline.day) : null,
          period: totalsOfPeriod(all, businessId, today, periodDays),
          periodDays,
          cash: theoreticalCash(business, all, today),
          openingCashMissing: business.openingCash === null,
          reportsToday: totalsOfDay(all, businessId, today).reportCount,
          isFirstUse: all.length === 0,
        };
      }),

    managerHome: (businessId, userId) =>
      read((): ManagerHome => {
        const access = accessOf(businessId, userId);
        const business = db.businesses.find((b) => b.id === businessId)!;
        const today = toDayKey(now());
        const mine = businessReports(businessId).filter((r) => r.authorId === userId);
        return {
          cash: cashFor(businessId, today),
          openingCashMissing: business.openingCash === null && can(access, 'submitReport'),
          myReportToday: mine.find((r) => r.day === today) ?? null,
          lastDayWithReport: latestReportDay(mine, businessId, today),
        };
      }),

    list: (businessId, userId, opts) =>
      read(() => {
        const access = accessOf(businessId, userId);
        const list = opts?.mineOnly
          ? businessReports(businessId).filter((r) => r.authorId === userId)
          : visibleReports(access, userId);
        return [...list].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      }),

    get: (reportId, userId) =>
      read(() => {
        const report = db.reports.find((r) => r.id === reportId);
        if (!report) throw new ServiceError('NOT_FOUND', 'Bilan introuvable.');
        const access = accessOf(report.businessId, userId);
        if (!canViewReport(access, report, userId)) {
          throw new ServiceError('FORBIDDEN', "Vous ne pouvez consulter que vos propres bilans.");
        }
        return report;
      }),

    dayView: (businessId, userId, day) =>
      read((): DayView => {
        const access = accessOf(businessId, userId);
        const visible = reportsOfDay(visibleReports(access, userId), businessId, day);
        return { day, reports: visible, totals: totalsOfDay(visible, businessId, day), cash: cashFor(businessId, day) };
      }),

    submit: (businessId, userId, input) =>
      write(() => {
        const access = accessOf(businessId, userId);
        requireCapability(access, 'submitReport', "Votre rôle ne permet pas de saisir un bilan.");
        const business = db.businesses.find((b) => b.id === businessId)!;
        const today = toDayKey(now());
        if (businessReports(businessId).some((r) => r.authorId === userId && r.day === today)) {
          throw new ServiceError('CONFLICT', "Vous avez déjà envoyé votre bilan aujourd'hui. Utilisez « Modifier ».");
        }
        const needsOpening = business.openingCash === null;
        const check = validateDraft(input.content, {
          openingCashRequired: needsOpening,
          openingCash: input.openingCash ?? null,
          remainingStock: business.stockEnabled
            ? remainingStockExcluding(db.stockItems, db.reports, businessId)
            : undefined,
        });
        if (!check.ok) throw new ServiceError('VALIDATION', Object.values(check.errors)[0] ?? 'Bilan invalide.');

        const submittedAt = new Date(now()).toISOString();
        const report: Report = {
          id: uid('r'),
          businessId,
          day: today,
          authorId: userId,
          authorName: userById(userId).name,
          submittedAt,
          versions: [{ content: finalizeContent(input.content), savedAt: submittedAt }],
        };
        db = {
          ...db,
          reports: [...db.reports, report],
          businesses: needsOpening
            ? db.businesses.map((b) =>
                b.id === businessId
                  ? { ...b, openingCash: { amount: input.openingCash!, day: today, declaredById: userId } }
                  : b,
              )
            : db.businesses,
        };
        return report;
      }),

    edit: (reportId, userId, content: ReportContent) =>
      write(() => {
        const report = db.reports.find((r) => r.id === reportId);
        if (!report) throw new ServiceError('NOT_FOUND', 'Bilan introuvable.');
        const access = accessOf(report.businessId, userId);
        if (report.authorId !== userId) throw new ServiceError('FORBIDDEN', 'Seul l’auteur peut modifier son bilan.');
        if (!canEditReport(access, report, userId, now())) {
          throw new ServiceError('EDIT_WINDOW_CLOSED', 'Le délai de modification de 24 h est dépassé.');
        }
        const business = db.businesses.find((b) => b.id === report.businessId)!;
        const check = validateDraft(content, {
          remainingStock: business.stockEnabled
            ? remainingStockExcluding(db.stockItems, db.reports, business.id, report.id)
            : undefined,
        });
        if (!check.ok) throw new ServiceError('VALIDATION', Object.values(check.errors)[0] ?? 'Bilan invalide.');
        const updated: Report = {
          ...report,
          versions: [...report.versions, { content: finalizeContent(content), savedAt: new Date(now()).toISOString() }],
        };
        db = { ...db, reports: db.reports.map((r) => (r.id === reportId ? updated : r)) };
        return updated;
      }),
  };

  // --- Équipe --------------------------------------------------------------------

  const team: Services['team'] = {
    listMembers: (businessId, userId) =>
      read((): MemberView[] => {
        const access = accessOf(businessId, userId);
        requireCapability(access, 'viewTeam');
        const business = db.businesses.find((b) => b.id === businessId)!;
        return db.members
          .filter((m) => m.businessId === businessId)
          .map((m) => ({
            member: m,
            user: userById(m.userId),
            role: m.roleId ? (db.roles.find((r) => r.id === m.roleId) ?? null) : null,
            isOwner: m.userId === business.ownerId,
          }))
          .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.user.name.localeCompare(b.user.name));
      }),

    listRoles: (businessId, userId) =>
      read(() => {
        const access = accessOf(businessId, userId);
        requireCapability(access, 'viewTeam');
        return db.roles.filter((r) => r.businessId === businessId);
      }),

    createRole: (businessId, userId, input) =>
      write(() => {
        const access = accessOf(businessId, userId);
        requireCapability(access, 'createRoles', 'Seul le propriétaire crée des rôles.');
        const name = input.name.trim();
        if (name.length < 2 || name.length > 30) {
          throw new ServiceError('VALIDATION', 'Le nom du rôle doit faire entre 2 et 30 caractères.');
        }
        if (db.roles.some((r) => r.businessId === businessId && r.name.toLowerCase() === name.toLowerCase())) {
          throw new ServiceError('CONFLICT', 'Un rôle porte déjà ce nom.');
        }
        const role = { id: uid('r'), businessId, name, level: input.level };
        db = { ...db, roles: [...db.roles, role] };
        return role;
      }),

    listPendingInvitations: (businessId, userId) =>
      read(() => {
        requireCapability(accessOf(businessId, userId), 'manageTeam');
        return db.invitations.filter((i) => i.businessId === businessId && i.status === 'pending');
      }),

    invite: (businessId, userId, input) =>
      write(() => {
        const access = accessOf(businessId, userId);
        requireCapability(access, 'manageTeam');
        const phone = normalizeBeninPhone(input.phone);
        if (!phone) throw new ServiceError('VALIDATION', 'Numéro invalide (10 chiffres, ex. 01 97 00 00 01).');
        const role = db.roles.find((r) => r.id === input.roleId && r.businessId === businessId);
        if (!role) throw new ServiceError('NOT_FOUND', 'Rôle introuvable.');
        if (!canGrantLevel(access, role.level)) {
          throw new ServiceError('FORBIDDEN', "Vous ne pouvez attribuer qu'un niveau inférieur au vôtre.");
        }
        const existingUser = db.users.find((u) => u.phone === phone);
        if (existingUser && db.members.some((m) => m.businessId === businessId && m.userId === existingUser.id && m.status === 'active')) {
          throw new ServiceError('CONFLICT', 'Cette personne fait déjà partie du business.');
        }
        if (db.invitations.some((i) => i.businessId === businessId && i.phone === phone && i.status === 'pending')) {
          throw new ServiceError('CONFLICT', 'Une invitation est déjà en attente pour ce numéro.');
        }
        const business = db.businesses.find((b) => b.id === businessId)!;
        const invitation: Invitation = {
          id: uid('inv'),
          businessId,
          businessName: business.name,
          phone,
          roleId: role.id,
          roleName: role.name,
          level: role.level,
          invitedById: userId,
          invitedByName: userById(userId).name,
          status: 'pending',
          createdAt: new Date(now()).toISOString(),
        };
        db = { ...db, invitations: [...db.invitations, invitation] };
        return invitation;
      }),

    cancelInvitation: (invitationId, userId) =>
      write(() => {
        const inv = db.invitations.find((i) => i.id === invitationId);
        if (!inv) throw new ServiceError('NOT_FOUND', 'Invitation introuvable.');
        const access = accessOf(inv.businessId, userId);
        requireCapability(access, 'manageTeam');
        if (!canGrantLevel(access, inv.level)) {
          throw new ServiceError('FORBIDDEN', "Vous ne pouvez pas annuler une invitation de niveau égal ou supérieur au vôtre.");
        }
        db = { ...db, invitations: db.invitations.map((i) => (i.id === invitationId ? { ...i, status: 'cancelled' } : i)) };
      }),

    removeMember: (memberId, userId) =>
      write(() => {
        const target = db.members.find((m) => m.id === memberId);
        if (!target || target.status !== 'active') throw new ServiceError('NOT_FOUND', 'Membre introuvable.');
        const actor = accessOf(target.businessId, userId);
        const targetAccess = accessOf(target.businessId, target.userId);
        if (!canManageMember(actor, targetAccess)) {
          throw new ServiceError('FORBIDDEN', "Vous ne pouvez pas retirer quelqu'un de rang égal ou supérieur.");
        }
        // Soft delete : seul l'accès futur disparaît, les bilans restent avec le nom de l'auteur.
        db = {
          ...db,
          members: db.members.map((m) =>
            m.id === memberId ? { ...m, status: 'removed', removedAt: new Date(now()).toISOString() } : m,
          ),
        };
      }),

    changeMemberRole: (memberId, roleId, userId) =>
      write(() => {
        const target = db.members.find((m) => m.id === memberId);
        if (!target || target.status !== 'active') throw new ServiceError('NOT_FOUND', 'Membre introuvable.');
        const actor = accessOf(target.businessId, userId);
        const targetAccess = accessOf(target.businessId, target.userId);
        const role = db.roles.find((r) => r.id === roleId && r.businessId === target.businessId);
        if (!role) throw new ServiceError('NOT_FOUND', 'Rôle introuvable.');
        if (!canManageMember(actor, targetAccess) || !canGrantLevel(actor, role.level)) {
          throw new ServiceError('FORBIDDEN', "Vous ne pouvez pas modifier ce rôle.");
        }
        db = { ...db, members: db.members.map((m) => (m.id === memberId ? { ...m, roleId } : m)) };
      }),

    listMyInvitations: (userId) =>
      read(() => {
        const phone = userById(userId).phone;
        return db.invitations
          .filter((i) => i.phone === phone && i.status === 'pending')
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }),

    respondToInvitation: (invitationId, userId, accept) =>
      write(() => {
        const inv = db.invitations.find((i) => i.id === invitationId);
        const user = userById(userId);
        if (!inv || inv.status !== 'pending' || inv.phone !== user.phone) {
          throw new ServiceError('NOT_FOUND', 'Invitation introuvable ou déjà traitée.');
        }
        let members = db.members;
        if (accept) {
          const previous = members.find((m) => m.businessId === inv.businessId && m.userId === userId);
          const joinedAt = new Date(now()).toISOString();
          members = previous
            ? members.map((m) =>
                m === previous ? { ...m, status: 'active', roleId: inv.roleId, joinedAt, removedAt: undefined } : m,
              )
            : [
                ...members,
                { id: uid('m'), businessId: inv.businessId, userId, roleId: inv.roleId, status: 'active', joinedAt },
              ];
        }
        db = {
          ...db,
          members,
          invitations: db.invitations.map((i) =>
            i.id === invitationId ? { ...i, status: accept ? 'accepted' : 'declined' } : i,
          ),
        };
      }),
  };

  // --- Stock ---------------------------------------------------------------------

  const stock: Services['stock'] = {
    list: (businessId, userId) =>
      read(() => {
        const access = accessOf(businessId, userId);
        requireCapability(access, 'viewStock');
        const business = db.businesses.find((b) => b.id === businessId)!;
        if (!business.stockEnabled) throw new ServiceError('NOT_FOUND', "Le module Stock n'est pas activé.");
        return stockLevels(db.stockItems, businessReports(businessId), businessId);
      }),

    forReport: (businessId, userId) =>
      read(() => {
        const access = accessOf(businessId, userId);
        requireCapability(access, 'submitReport');
        const business = db.businesses.find((b) => b.id === businessId)!;
        return business.stockEnabled ? stockLevels(db.stockItems, businessReports(businessId), businessId) : [];
      }),

    names: (businessId, userId) =>
      read(() => {
        accessOf(businessId, userId);
        return Object.fromEntries(db.stockItems.filter((i) => i.businessId === businessId).map((i) => [i.id, i.name]));
      }),

    addItem: (businessId, userId, input) =>
      write(() => {
        const access = accessOf(businessId, userId);
        requireCapability(access, 'manageStock');
        const business = db.businesses.find((b) => b.id === businessId)!;
        if (!business.stockEnabled) throw new ServiceError('NOT_FOUND', "Le module Stock n'est pas activé.");
        const name = input.name.trim();
        if (name.length < 2) throw new ServiceError('VALIDATION', "Indiquez le nom de l'article.");
        if (!Number.isInteger(input.initialQuantity) || input.initialQuantity < 0) {
          throw new ServiceError('VALIDATION', 'Quantité de départ invalide.');
        }
        db = {
          ...db,
          stockItems: [...db.stockItems, { id: uid('st'), businessId, name, initialQuantity: input.initialQuantity }],
        };
      }),
  };

  // --- Abonnement ----------------------------------------------------------------

  const subscriptions: Services['subscriptions'] = {
    get: (businessId, userId) =>
      read(() => {
        const access = accessOf(businessId, userId);
        const sub = db.subscriptions.find((s) => s.businessId === businessId);
        if (!sub) throw new ServiceError('NOT_FOUND', 'Abonnement introuvable.');
        const t = now();
        return {
          // Le détail des paiements est réservé au propriétaire.
          subscription: access.isOwner ? sub : { ...sub, payments: [] },
          status: subscriptionStatus(sub, t),
          daysRemaining: daysRemaining(sub, t),
          endsAt: subscriptionEnd(sub),
        };
      }),
  };

  return {
    auth,
    businesses,
    reports,
    team,
    stock,
    subscriptions,
    events: {
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    now,
    db: () => db,
  };
}

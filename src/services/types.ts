/**
 * Contrat des services de données de BilanGo.
 *
 * L'UI ne dépend que de ces interfaces. Aujourd'hui elles sont servies par une implémentation
 * mock en mémoire (`services/mock`), qui n'offre AUCUNE sécurité : la vérification stricte
 * des permissions et la protection anti-abus devront être refaites côté serveur (cahier §10).
 * Brancher le vrai backend = écrire une autre implémentation de `Services`.
 */
import type {
  Access,
  Business,
  CashDay,
  DayTotals,
  Headline,
  Id,
  Invitation,
  Member,
  PermissionLevel,
  Report,
  ReportContent,
  Role,
  Sector,
  StockLevel,
  Subscription,
  SubscriptionStatus,
  User,
  DayKey,
} from './reexports';

export type ServiceErrorCode =
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'INVALID_OTP'
  | 'RATE_LIMITED'
  | 'EDIT_WINDOW_CLOSED'
  | 'CONFLICT'
  | 'NETWORK';

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }
}

/** Message affichable à l'utilisateur, quelle que soit l'erreur reçue. */
export function errorMessage(error: unknown): string {
  if (error instanceof ServiceError) return error.message;
  return 'Une erreur est survenue. Réessayez dans un instant.';
}

// --- Auth ----------------------------------------------------------------------

export interface AuthService {
  /** Envoie un code OTP (WhatsApp en production). Soumis au rate limiting. */
  requestOtp(phone: string): Promise<{ retryAfterSeconds: number }>;
  verifyOtp(phone: string, code: string): Promise<{ token: string; user: User }>;
  /** Retrouve l'utilisateur d'un jeton de session persistant, `null` si invalide. */
  restoreSession(token: string): Promise<User | null>;
  updateName(userId: Id, name: string): Promise<User>;
}

// --- Business ------------------------------------------------------------------

export interface BusinessOverview {
  business: Business;
  access: Access;
  /** CA du jour (mini-indicateur du menu), `null` si pas encore de bilan ou non visible. */
  todayRevenue: number | null;
}

export interface CreateBusinessInput {
  name: string;
  sector: Sector;
  stockEnabled: boolean;
  /** "HH:mm" */
  reminderTime: string;
}

export interface BusinessService {
  listMine(userId: Id): Promise<BusinessOverview[]>;
  getAccess(businessId: Id, userId: Id): Promise<{ business: Business; access: Access }>;
  create(userId: Id, input: CreateBusinessInput): Promise<Business>;
  updateReminderTime(businessId: Id, userId: Id, reminderTime: string): Promise<Business>;
}

// --- Bilans --------------------------------------------------------------------

export interface DashboardData {
  headline: Headline;
  /** Totaux du jour mis en avant par `headline` (CA, dépenses, ajouts), `null` si aucun bilan. */
  headlineTotals: DayTotals | null;
  period: DayTotals;
  periodDays: 1 | 7 | 30;
  cash: CashDay | null;
  openingCashMissing: boolean;
  /** Nombre de bilans reçus aujourd'hui. */
  reportsToday: number;
  /** Aucun bilan n'a jamais été reçu (état vide rassurant du cahier §6.3). */
  isFirstUse: boolean;
}

export interface DayView {
  day: DayKey;
  reports: Report[];
  totals: DayTotals;
  cash: CashDay | null;
}

export interface ManagerHome {
  cash: CashDay | null;
  openingCashMissing: boolean;
  myReportToday: Report | null;
  lastDayWithReport: DayKey | null;
}

export interface SubmitReportInput {
  content: ReportContent;
  /** Obligatoire uniquement pour le tout premier bilan du business. */
  openingCash?: number;
}

export interface ReportService {
  dashboard(businessId: Id, userId: Id, periodDays: 1 | 7 | 30): Promise<DashboardData>;
  managerHome(businessId: Id, userId: Id): Promise<ManagerHome>;
  /** Liste filtrée selon la permission : "Saisie seule" ne voit que ses propres bilans. */
  list(businessId: Id, userId: Id, options?: { mineOnly?: boolean }): Promise<Report[]>;
  get(reportId: Id, userId: Id): Promise<Report>;
  dayView(businessId: Id, userId: Id, day: DayKey): Promise<DayView>;
  submit(businessId: Id, userId: Id, input: SubmitReportInput): Promise<Report>;
  edit(reportId: Id, userId: Id, content: ReportContent): Promise<Report>;
}

// --- Équipe --------------------------------------------------------------------

export interface MemberView {
  member: Member;
  user: User;
  role: Role | null;
  isOwner: boolean;
}

export interface InviteInput {
  phone: string;
  roleId: Id;
}

export interface CreateRoleInput {
  name: string;
  level: PermissionLevel;
}

export interface TeamService {
  listMembers(businessId: Id, userId: Id): Promise<MemberView[]>;
  listRoles(businessId: Id, userId: Id): Promise<Role[]>;
  createRole(businessId: Id, userId: Id, input: CreateRoleInput): Promise<Role>;
  listPendingInvitations(businessId: Id, userId: Id): Promise<Invitation[]>;
  invite(businessId: Id, userId: Id, input: InviteInput): Promise<Invitation>;
  cancelInvitation(invitationId: Id, userId: Id): Promise<void>;
  /** Soft delete : l'accès futur est retiré, les bilans passés sont conservés. */
  removeMember(memberId: Id, userId: Id): Promise<void>;
  changeMemberRole(memberId: Id, roleId: Id, userId: Id): Promise<void>;
  /** Invitations en attente adressées au numéro de l'utilisateur. */
  listMyInvitations(userId: Id): Promise<Invitation[]>;
  respondToInvitation(invitationId: Id, userId: Id, accept: boolean): Promise<void>;
}

// --- Stock ---------------------------------------------------------------------

export interface StockService {
  /** Vue complète du stock (permission : voir le stock). */
  list(businessId: Id, userId: Id): Promise<StockLevel[]>;
  /** Articles vendables à déclarer dans un bilan (permission : saisir un bilan). Vide si le module est désactivé. */
  forReport(businessId: Id, userId: Id): Promise<StockLevel[]>;
  /** Noms des articles, pour relire un bilan. Vide si le module est désactivé. */
  names(businessId: Id, userId: Id): Promise<Record<Id, string>>;
  addItem(businessId: Id, userId: Id, input: { name: string; initialQuantity: number }): Promise<void>;
}

// --- Abonnement (lecture seule : aucun parcours de paiement dans l'app, cahier §9.5) -----

export interface SubscriptionView {
  subscription: Subscription;
  status: SubscriptionStatus;
  daysRemaining: number;
  /** Fin de l'essai ou de la période payée. */
  endsAt: string | null;
}

export interface SubscriptionService {
  get(businessId: Id, userId: Id): Promise<SubscriptionView>;
}

// --- Conteneur -----------------------------------------------------------------

export interface DataEvents {
  /** Notifie après toute écriture, pour que l'UI recharge ses lectures. */
  subscribe(listener: () => void): () => void;
}

export interface Services {
  auth: AuthService;
  businesses: BusinessService;
  reports: ReportService;
  team: TeamService;
  stock: StockService;
  subscriptions: SubscriptionService;
  events: DataEvents;
  /** Horloge injectée (testable). */
  now: () => number;
}

/**
 * Modèle de domaine BilanGo (cf. docs/CAHIER_DES_CHARGES.md).
 * Aucune dépendance React / Expo : ces types sont partagés avec les règles métier
 * et avec le contrat des services.
 */

export type Id = string;
/** Instant ISO 8601 en UTC, ex. "2026-10-09T08:30:00.000Z". */
export type IsoDateTime = string;
/** Jour calendaire à Cotonou (UTC+1), ex. "2026-10-09". */
export type DayKey = string;

/** Niveaux de permission fixes d'un rôle (cahier §4.2). */
export type PermissionLevel = 'entry' | 'full' | 'readonly';

export type Sector = 'bar_restaurant' | 'boutique' | 'ecommerce' | 'other';

export interface User {
  id: Id;
  /** Format E.164, ex. "+22997000001". Identifiant principal du compte. */
  phone: string;
  /** Vide tant que le profil n'est pas complété après la première connexion. */
  name: string;
}

export interface OpeningCash {
  amount: number;
  /** Jour de la déclaration : la caisse théorique démarre ce jour-là. */
  day: DayKey;
  declaredById: Id;
}

export interface Business {
  id: Id;
  ownerId: Id;
  name: string;
  sector: Sector;
  stockEnabled: boolean;
  /** "HH:mm" (heure de Cotonou) du rappel de bilan, fixée par le propriétaire. */
  reminderTime: string;
  openingCash: OpeningCash | null;
  createdAt: IsoDateTime;
}

export interface Role {
  id: Id;
  businessId: Id;
  name: string;
  level: PermissionLevel;
}

export type MemberStatus = 'active' | 'removed';

export interface Member {
  id: Id;
  businessId: Id;
  userId: Id;
  /** `null` pour le propriétaire du business. */
  roleId: Id | null;
  /** Soft delete : un membre retiré perd l'accès mais ses bilans restent (cahier §4.4). */
  status: MemberStatus;
  joinedAt: IsoDateTime;
  removedAt?: IsoDateTime;
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface Invitation {
  id: Id;
  businessId: Id;
  businessName: string;
  /** Téléphone invité (E.164). */
  phone: string;
  roleId: Id;
  roleName: string;
  level: PermissionLevel;
  invitedById: Id;
  invitedByName: string;
  status: InvitationStatus;
  createdAt: IsoDateTime;
}

export interface ReportLine {
  id: Id;
  label: string;
  amount: number;
}

/** Montant d'une catégorie : global, avec détail optionnel. */
export interface ReportAmount {
  /** Si `lines` n'est pas vide, `total` vaut toujours la somme des lignes. */
  total: number;
  lines: ReportLine[];
}

export interface StockSale {
  itemId: Id;
  quantity: number;
}

export interface ReportContent {
  revenue: ReportAmount;
  expenses: ReportAmount;
  cashIn: ReportAmount;
  stockSales: StockSale[];
  note: string;
}

export interface ReportVersion {
  content: ReportContent;
  savedAt: IsoDateTime;
}

export interface Report {
  id: Id;
  businessId: Id;
  /** Jour de l'activité, dérivé de `submittedAt` (pas d'antidatage). */
  day: DayKey;
  authorId: Id;
  /** Nom conservé tel quel même si l'auteur est retiré (cahier §4.4). */
  authorName: string;
  submittedAt: IsoDateTime;
  /** Historique : [version originale, ...modifications]. Jamais vide. */
  versions: ReportVersion[];
}

export interface StockItem {
  id: Id;
  businessId: Id;
  name: string;
  /** Quantité de départ ; le restant se déduit des ventes déclarées dans les bilans. */
  initialQuantity: number;
}

export interface Payment {
  id: Id;
  paidAt: IsoDateTime;
  amount: number;
  provider: 'MTN Money' | 'Moov Money';
  reference: string;
}

export interface Subscription {
  businessId: Id;
  trialEndsAt: IsoDateTime | null;
  /** Fin de la période payée ; `null` si jamais payé. */
  paidUntil: IsoDateTime | null;
  payments: Payment[];
}

export type SubscriptionStatus = 'trial' | 'active' | 'expired';

/** Relation entre un utilisateur et un business : base de tous les contrôles de droits. */
export interface Access {
  businessId: Id;
  userId: Id;
  isOwner: boolean;
  /** `null` pour le propriétaire. */
  role: Role | null;
}

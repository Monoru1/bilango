import { HOUR_MS } from './dates';
import type { Access, Id, PermissionLevel, Report } from './types';

/** Fenêtre de modification d'un bilan après son envoi (cahier §5.5). */
export const EDIT_WINDOW_MS = 24 * HOUR_MS;

export type Capability =
  | 'submitReport'
  | 'viewDashboard'
  | 'viewAllReports'
  | 'viewStock'
  | 'manageStock'
  | 'viewTeam'
  | 'manageTeam'
  | 'createRoles'
  | 'viewSubscription'
  | 'deleteBusiness';

export const LEVEL_LABELS: Record<PermissionLevel, string> = {
  entry: 'Saisie seule',
  full: 'Gestion complète',
  readonly: 'Lecture seule',
};

export const LEVEL_DESCRIPTIONS: Record<PermissionLevel, string> = {
  entry: 'Peut uniquement remplir le bilan du jour et consulter ses propres bilans.',
  full: "Voit tout l'historique, gère le stock, invite et retire des personnes de niveau inférieur.",
  readonly: 'Consulte les bilans et le tableau de bord, sans aucune modification.',
};

/**
 * Rang hiérarchique : le propriétaire domine tout, "Gestion complète" domine les niveaux
 * restreints. "Saisie seule" et "Lecture seule" sont de rang égal : aucun ne gère l'autre.
 */
const LEVEL_RANK: Record<PermissionLevel, number> = { readonly: 1, entry: 1, full: 2 };
const OWNER_RANK = 3;

export function levelRank(level: PermissionLevel): number {
  return LEVEL_RANK[level];
}

export function accessRank(access: Pick<Access, 'isOwner' | 'role'>): number {
  if (access.isOwner) return OWNER_RANK;
  return access.role ? LEVEL_RANK[access.role.level] : 0;
}

export function accessLevel(access: Pick<Access, 'isOwner' | 'role'>): PermissionLevel | 'owner' | null {
  if (access.isOwner) return 'owner';
  return access.role?.level ?? null;
}

export function roleLabel(access: Pick<Access, 'isOwner' | 'role'>): string {
  return access.isOwner ? 'Propriétaire' : (access.role?.name ?? '');
}

const CAPABILITIES: Record<Capability, readonly (PermissionLevel | 'owner')[]> = {
  submitReport: ['owner', 'full', 'entry'],
  viewDashboard: ['owner', 'full', 'readonly'],
  viewAllReports: ['owner', 'full', 'readonly'],
  viewStock: ['owner', 'full', 'readonly'],
  manageStock: ['owner', 'full'],
  viewTeam: ['owner', 'full'],
  manageTeam: ['owner', 'full'],
  createRoles: ['owner'],
  viewSubscription: ['owner'],
  deleteBusiness: ['owner'],
};

export function can(access: Pick<Access, 'isOwner' | 'role'>, capability: Capability): boolean {
  const level = accessLevel(access);
  return level !== null && CAPABILITIES[capability].includes(level);
}

/**
 * Cahier §4.3 : personne ne retire ni ne modifie quelqu'un de rang égal ou supérieur ;
 * le propriétaire ne peut jamais être retiré.
 */
export function canManageMember(
  actor: Pick<Access, 'isOwner' | 'role'>,
  target: Pick<Access, 'isOwner' | 'role'>,
): boolean {
  if (target.isOwner) return false;
  return can(actor, 'manageTeam') && accessRank(actor) > accessRank(target);
}

/** On ne peut attribuer qu'un niveau strictement inférieur au sien (le propriétaire : tous). */
export function canGrantLevel(actor: Pick<Access, 'isOwner' | 'role'>, level: PermissionLevel): boolean {
  return can(actor, 'manageTeam') && accessRank(actor) > levelRank(level);
}

export function grantableLevels(actor: Pick<Access, 'isOwner' | 'role'>): PermissionLevel[] {
  return (['entry', 'readonly', 'full'] as const).filter((l) => canGrantLevel(actor, l));
}

export function canViewReport(access: Pick<Access, 'isOwner' | 'role'>, report: Report, userId: Id): boolean {
  return can(access, 'viewAllReports') || report.authorId === userId;
}

export function editWindowEnd(report: Pick<Report, 'submittedAt'>): number {
  return Date.parse(report.submittedAt) + EDIT_WINDOW_MS;
}

/**
 * Seul l'auteur peut modifier son bilan, pendant 24 h après l'envoi initial (les
 * modifications ne prolongent pas la fenêtre).
 */
export function canEditReport(
  access: Pick<Access, 'isOwner' | 'role'>,
  report: Pick<Report, 'authorId' | 'submittedAt'>,
  userId: Id,
  now: number,
): boolean {
  return can(access, 'submitReport') && report.authorId === userId && now < editWindowEnd(report);
}

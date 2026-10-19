import type { Business, CountryCode, Invitation, Member, Report, Role, StockItem, Subscription, User } from '@gobilan/domain';

export interface Workspace {
  business: Business;
  roles: Role[];
  members: Member[];
  users: (User & { country: CountryCode })[];
  invitations: Invitation[];
  reports: Report[];
  stock: StockItem[];
  subscription: Subscription;
  stockLevels: { item: StockItem; sold: number; remaining: number }[];
  theoreticalCash: number | null;
}
export interface ApplicationState {
  users: Workspace['users'];
  businesses: Business[];
  roles: Role[];
  members: Member[];
  invitations: Invitation[];
  reports: Report[];
  stock: StockItem[];
  subs: Subscription[];
  sessionUserId: string | null;
}
export type Result<T = void> = ({ ok: true } & (T extends void ? object : { value: T })) | { ok: false; error: string; retryAfterMs?: number; locked?: boolean; exhausted?: boolean };

import type { Clock } from './clock';
import type { Secrets } from './crypto';
import type { Db } from './db';
import type { Providers } from './providers';

export interface AppConfig {
  /** `sandbox` refuse tout webhook `live` et inversement. */
  fedapayMode: 'sandbox' | 'live';
  userSessionDays: number;
  partnerSessionHours: number;
  adminSessionMinutes: number;
  /** Origines autorisées par audience (contrôle CSRF + CORS). */
  origins: { pwa: string[]; partners: string[]; admin: string[] };
  partnersPortalUrl: string;
}

export interface Deps {
  db: Db;
  clock: Clock;
  secrets: Secrets;
  providers: Providers;
  config: AppConfig;
}

export const defaultConfig: AppConfig = {
  fedapayMode: 'sandbox',
  userSessionDays: 90,
  partnerSessionHours: 12,
  adminSessionMinutes: 120,
  origins: { pwa: ['http://localhost:5173'], partners: ['http://localhost:5174'], admin: ['http://localhost:5175'] },
  partnersPortalUrl: 'http://localhost:5174',
};

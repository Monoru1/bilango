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
  /**
   * Clé PUBLIQUE VAPID (base64url) servie à la PWA pour s'abonner au Web Push. `null` tant qu'aucune paire de
   * clés n'a été générée au nom de Novadis Digital : la PWA n'affiche alors aucune activation de notifications.
   */
  vapidPublicKey: string | null;
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
  vapidPublicKey: null,
};

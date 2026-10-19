/**
 * Détection de l'environnement d'ouverture (CDC §3). La page d'installation est une RÈGLE
 * D'AFFICHAGE, pas une protection : la sécurité repose sur le serveur (§13).
 */
export type InAppBrowser = 'tiktok' | 'instagram' | 'whatsapp' | 'facebook' | null;

export interface Env {
  standalone: boolean;
  platform: 'android' | 'ios' | 'other';
  /** iPhone avec Safari (seul cas où le guide d'installation manuelle s'affiche). */
  iosSafari: boolean;
  inAppBrowser: InAppBrowser;
}

export function detectInAppBrowser(ua: string): InAppBrowser {
  if (/musical_ly|BytedanceWebview|TikTok|Bytedance/i.test(ua)) return 'tiktok';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|FB4A|FBIOS/i.test(ua)) return 'facebook';
  if (/WhatsApp/i.test(ua)) return 'whatsapp';
  return null;
}

export function detectEnv(ua: string, standaloneFlags: { displayModeStandalone: boolean; navigatorStandalone: boolean }, maxTouchPoints = 0): Env {
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const inApp = detectInAppBrowser(ua);
  // Chrome/Firefox/Edge/Opera sur iOS portent « CriOS|FxiOS|EdgiOS|OPiOS » : ils ne peuvent pas installer.
  const safari = ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//i.test(ua) && inApp === null;
  return {
    standalone: standaloneFlags.displayModeStandalone || standaloneFlags.navigatorStandalone,
    platform: ios ? 'ios' : android ? 'android' : 'other',
    iosSafari: safari,
    inAppBrowser: inApp,
  };
}

export function currentEnv(): Env {
  const nav = navigator as Navigator & { standalone?: boolean };
  return detectEnv(
    navigator.userAgent,
    { displayModeStandalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false, navigatorStandalone: nav.standalone === true },
    navigator.maxTouchPoints,
  );
}

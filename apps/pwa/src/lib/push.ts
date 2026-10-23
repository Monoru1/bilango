/**
 * Web Push côté navigateur (cahier §9). Isolé derrière l'interface `BrowserPush` pour que le magasin HTTP
 * reste testable sans navigateur. Aucune permission n'est demandée ici : l'appelant décide du moment (§9.3).
 */
export type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface BrowserPush {
  permission(): PermissionState;
  request(): Promise<PermissionState>;
  /** Crée (ou récupère) l'abonnement push du navigateur pour la clé VAPID publique donnée. */
  subscribe(publicKey: string): Promise<BrowserSubscription>;
  /** Supprime l'abonnement du navigateur ; renvoie son point d'accès, ou null s'il n'y en avait pas. */
  unsubscribe(): Promise<string | null>;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function toBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function serialize(sub: PushSubscription): BrowserSubscription {
  return { endpoint: sub.endpoint, keys: { p256dh: toBase64Url(sub.getKey('p256dh')), auth: toBase64Url(sub.getKey('auth')) } };
}

export const browserPush: BrowserPush = {
  permission: () => (pushSupported() ? (Notification.permission as PermissionState) : 'unsupported'),
  async request() {
    if (!pushSupported()) return 'unsupported';
    return (await Notification.requestPermission()) as PermissionState;
  },
  async subscribe(publicKey) {
    const reg = await navigator.serviceWorker.ready;
    const applicationServerKey = urlBase64ToUint8Array(publicKey) as BufferSource;
    try {
      return serialize(await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }));
    } catch (e) {
      // Un abonnement existant créé avec une autre clé VAPID fait échouer subscribe() : on repart de zéro.
      if (e instanceof DOMException && e.name === 'InvalidStateError') {
        await (await reg.pushManager.getSubscription())?.unsubscribe();
        return serialize(await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }));
      }
      throw e;
    }
  },
  async unsubscribe() {
    if (!pushSupported()) return null;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return null;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    return endpoint;
  },
};

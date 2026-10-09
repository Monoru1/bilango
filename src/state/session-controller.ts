import { ServiceError, type AuthService } from '@/services/types';
import type { User } from '@/domain/types';
import type { KeyValueStore } from './storage';

export const PIN_MAX_ATTEMPTS = 5;

export type SessionState =
  | { status: 'booting' }
  | { status: 'signedOut' }
  | { status: 'locked'; user: User; attemptsLeft: number }
  | { status: 'onboarding'; user: User; step: 'name' | 'pin' }
  | { status: 'ready'; user: User };

export type UnlockResult = { ok: true } | { ok: false; attemptsLeft: number };

const K = {
  token: 'bilango.token',
  locked: 'bilango.locked',
  fails: 'bilango.pinfails',
  pin: (userId: string) => `bilango.pin.${userId}`,
};

/**
 * Session persistante + PIN local (cahier §3.2 et §5.0), indépendante de React pour être testable.
 *
 * - Après OTP : jeton de session conservé sur l'appareil, ouverture directe aux lancements suivants.
 * - Déconnexion volontaire = verrouillage : le jeton reste, l'accès se rouvre avec le PIN (sans nouvel OTP).
 * - PIN oublié / trop d'essais / autre numéro : l'appareil est oublié, un nouvel OTP est requis.
 *
 * Limite assumée du mock : le PIN est stocké en clair dans le SecureStore de l'appareil. En production,
 * le PIN ne doit être qu'un verrou local ; la session reste validée côté serveur.
 */
export function createSessionController(deps: { auth: AuthService; storage: KeyValueStore }) {
  const { auth, storage } = deps;
  let state: SessionState = { status: 'booting' };
  const listeners = new Set<() => void>();

  function set(next: SessionState) {
    state = next;
    listeners.forEach((l) => l());
  }

  async function afterAuthentication(user: User): Promise<void> {
    if (user.name.trim() === '') return set({ status: 'onboarding', user, step: 'name' });
    const pin = await storage.get(K.pin(user.id));
    if (!pin) return set({ status: 'onboarding', user, step: 'pin' });
    set({ status: 'ready', user });
  }

  async function failsLeft(): Promise<number> {
    return PIN_MAX_ATTEMPTS - Number((await storage.get(K.fails)) ?? '0');
  }

  const controller = {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async boot() {
      try {
        const token = await storage.get(K.token);
        const user = token ? await auth.restoreSession(token) : null;
        if (!token || !user) {
          if (token) await storage.remove(K.token);
          return set({ status: 'signedOut' });
        }
        if ((await storage.get(K.locked)) === '1' && (await storage.get(K.pin(user.id)))) {
          return set({ status: 'locked', user, attemptsLeft: await failsLeft() });
        }
        await afterAuthentication(user);
      } catch {
        // Hors-ligne ou erreur au démarrage : on retombe sur l'écran de connexion plutôt que de bloquer.
        set({ status: 'signedOut' });
      }
    },

    requestOtp: (phone: string) => auth.requestOtp(phone),

    async verifyOtp(phone: string, code: string) {
      const { token, user } = await auth.verifyOtp(phone, code);
      await storage.set(K.token, token);
      await storage.remove(K.locked);
      await storage.remove(K.fails);
      await afterAuthentication(user);
    },

    async saveName(name: string) {
      if (state.status !== 'onboarding') return;
      const user = await auth.updateName(state.user.id, name);
      await afterAuthentication(user);
    },

    async setPin(pin: string) {
      if (state.status !== 'onboarding') return;
      if (!/^\d{4}$/.test(pin)) throw new ServiceError('VALIDATION', 'Le code PIN doit contenir 4 chiffres.');
      await storage.set(K.pin(state.user.id), pin);
      set({ status: 'ready', user: state.user });
    },

    async unlock(pin: string): Promise<UnlockResult> {
      if (state.status !== 'locked') return { ok: false, attemptsLeft: 0 };
      const stored = await storage.get(K.pin(state.user.id));
      if (stored !== null && stored === pin) {
        await storage.remove(K.locked);
        await storage.remove(K.fails);
        set({ status: 'ready', user: state.user });
        return { ok: true };
      }
      const fails = Number((await storage.get(K.fails)) ?? '0') + 1;
      await storage.set(K.fails, String(fails));
      if (fails >= PIN_MAX_ATTEMPTS) {
        await controller.forgetDevice();
        return { ok: false, attemptsLeft: 0 };
      }
      const attemptsLeft = PIN_MAX_ATTEMPTS - fails;
      set({ status: 'locked', user: state.user, attemptsLeft });
      return { ok: false, attemptsLeft };
    },

    /** Déconnexion volontaire : verrouille, le PIN suffira pour revenir. */
    async lock() {
      if (state.status !== 'ready') return;
      await storage.set(K.locked, '1');
      set({ status: 'locked', user: state.user, attemptsLeft: await failsLeft() });
    },

    /** PIN oublié ou changement de numéro : on oublie l'appareil, un nouvel OTP sera demandé. */
    async forgetDevice() {
      const user = 'user' in state ? state.user : null;
      await storage.remove(K.token);
      await storage.remove(K.locked);
      await storage.remove(K.fails);
      if (user) await storage.remove(K.pin(user.id));
      set({ status: 'signedOut' });
    },
  };

  return controller;
}

export type SessionController = ReturnType<typeof createSessionController>;

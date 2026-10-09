import * as SecureStore from 'expo-secure-store';

/** Stockage clé/valeur local à l'appareil (jeton de session, PIN, dernier business). */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

// SecureStore n'accepte que [A-Za-z0-9._-] dans les clés.
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export const secureStorage: KeyValueStore = {
  get: (key) => SecureStore.getItemAsync(safe(key)),
  set: (key, value) => SecureStore.setItemAsync(safe(key), value),
  remove: (key) => SecureStore.deleteItemAsync(safe(key)),
};

export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(initial));
  return {
    get: async (key) => map.get(key) ?? null,
    set: async (key, value) => void map.set(key, value),
    remove: async (key) => void map.delete(key),
  };
}

import type { KeyValueStore } from './storage';

/** Adaptateur de démonstration Web, éphémère et sans prétention de sécurité. */
export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStore & { clear(): void } {
  const map = new Map(Object.entries(initial));
  return {
    get: async (key) => map.get(key) ?? null,
    set: async (key, value) => void map.set(key, value),
    remove: async (key) => void map.delete(key),
    clear: () => map.clear(),
  };
}

export const secureStorage = createMemoryStorage();

// Doubles de test communs : aucun module natif réel, services mock sans latence, stockage en mémoire.
// `require` est nécessaire dans les fabriques de jest.mock (imports hors portée interdits).
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('@/state/composition', () => ({
  createAppServices: () => require('@/services/mock').createMockServices({ latencyMs: 0 }),
}));

jest.mock('@/state/storage', () => {
  const actual = jest.requireActual('@/state/storage');
  return { ...actual, secureStorage: actual.createMemoryStorage() };
});

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: jest.fn(() => Promise.resolve(true)),
}));

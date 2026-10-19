import { useSyncExternalStore } from 'react';
import { DemoStore } from '../demo/store';

/** Instance unique du store DEMO (aucune persistance : tout disparaît au rechargement). */
export const store = new DemoStore();

export function useStore(): DemoStore {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}

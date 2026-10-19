import { useSyncExternalStore } from 'react';
import { DemoStore } from '../demo/store';
import { RemoteStore } from './RemoteStore';

export function demoEnabled(): boolean {
  if (import.meta.env.VITE_ALLOW_DEMO_BYPASS === '0') return false;
  try {
    const value = new URLSearchParams(window.location.search).get('demo');
    if (value === '0') sessionStorage.removeItem('gb-demo');
    if (value === '1') sessionStorage.setItem('gb-demo', '1');
    return sessionStorage.getItem('gb-demo') === '1';
  } catch { return false; }
}
export const store = demoEnabled() ? new DemoStore() : new RemoteStore();
export function useStore() {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}

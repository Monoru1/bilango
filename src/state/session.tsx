import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import { createSessionController, type SessionController, type SessionState } from './session-controller';
import { useServices } from './services';
import { secureStorage, type KeyValueStore } from './storage';

const SessionContext = createContext<SessionController | null>(null);

export function SessionProvider({ children, storage = secureStorage }: { children: ReactNode; storage?: KeyValueStore }) {
  const services = useServices();
  const controller = useMemo(() => createSessionController({ auth: services.auth, storage }), [services, storage]);
  useEffect(() => {
    controller.boot();
  }, [controller]);
  return <SessionContext.Provider value={controller}>{children}</SessionContext.Provider>;
}

export function useSessionController(): SessionController {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSessionController doit être utilisé dans un <SessionProvider>.');
  return ctx;
}

export function useSessionState(): SessionState {
  const controller = useSessionController();
  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
}

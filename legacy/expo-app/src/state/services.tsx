import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { nextBusinessDayAt } from '@/domain/dates';
import type { Services } from '@/services/types';
import { createAppServices } from './composition';

const ServicesContext = createContext<Services | null>(null);

/** Fournit les services à l'arbre React ; l'implémentation vient de `composition.ts`. */
export function ServicesProvider({ children, services }: { children: ReactNode; services?: Services }) {
  const value = useMemo(() => services ?? createAppServices(), [services]);
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices doit être utilisé dans un <ServicesProvider>.');
  return ctx;
}

/** Réévalue les droits à leur échéance et au retour de veille, sans polling. */
export function useDeadlineClock(deadlines: readonly number[]): number {
  const services = useServices();
  const [revision, refresh] = useState(0);
  const now = services.now();
  const next = Math.min(...deadlines.filter((deadline) => deadline > now));
  useEffect(() => {
    const update = () => refresh((value) => value + 1);
    const timer = Number.isFinite(next) ? setTimeout(update, Math.max(0, next - services.now())) : undefined;
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      listener.remove();
    };
  }, [next, services, revision]);
  return now;
}

export interface QueryResult<T> {
  data: T | undefined;
  error: unknown;
  /** `true` pendant un chargement ou un rechargement. */
  loading: boolean;
  reload: () => void;
}

interface Settled<T> {
  /** Clé de requête dont proviennent ces données. */
  key: string;
  /** Identifiant (clé + rechargement) de la dernière requête terminée. */
  requestId: string;
  data?: T;
  error?: unknown;
}

/**
 * Lecture asynchrone avec états de chargement / erreur. Se recharge automatiquement quand
 * `key` change ou après toute écriture signalée par `services.events` ; à rechargement
 * identique (même clé), les données précédentes restent affichées (pas de clignotement),
 * mais jamais celles d'une autre clé (ex. un autre business).
 */
export function useQuery<T>(key: readonly unknown[], fetcher: () => Promise<T>, enabled = true): QueryResult<T> {
  const services = useServices();
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [tick, setTick] = useState(0);
  const latest = useRef(fetcher);
  const serializedKey = JSON.stringify(key);
  const requestId = `${serializedKey}#${tick}`;

  useEffect(() => {
    latest.current = fetcher;
  });

  useEffect(() => services.events.subscribe(() => setTick((t) => t + 1)), [services]);

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => setTick((t) => t + 1);
    const timer = setTimeout(refresh, nextBusinessDayAt(services.now()) - services.now());
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      listener.remove();
    };
  }, [services, enabled, requestId]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    latest
      .current()
      .then((data) => {
        if (!cancelled) setSettled({ key: serializedKey, requestId, data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setSettled((prev) => ({ key: serializedKey, requestId, data: prev?.key === serializedKey ? prev.data : undefined, error }));
      });
    return () => {
      cancelled = true;
    };
  }, [serializedKey, requestId, enabled]);

  const sameKey = settled?.key === serializedKey;
  return {
    data: sameKey ? settled?.data : undefined,
    error: sameKey ? settled?.error : undefined,
    loading: enabled && settled?.requestId !== requestId,
    reload: () => setTick((t) => t + 1),
  };
}

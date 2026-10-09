import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { User } from '@/domain/types';
import type { DashboardPeriod } from '@/domain/dates';
import type { BusinessOverview } from '@/services/types';
import { useQuery, useServices } from './services';
import { secureStorage, type KeyValueStore } from './storage';

interface BusinessContextValue {
  user: User;
  overviews: BusinessOverview[] | undefined;
  loading: boolean;
  error: unknown;
  reload: () => void;
  /** Business affiché (menu multi-business, cahier §4.5). `null` si le compte n'en a aucun. */
  current: BusinessOverview | null;
  select: (businessId: string) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  dashboardPeriod: DashboardPeriod;
  setDashboardPeriod: (period: DashboardPeriod) => void;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({
  user,
  children,
  storage = secureStorage,
}: {
  user: User;
  children: ReactNode;
  storage?: KeyValueStore;
}) {
  const services = useServices();
  const query = useQuery(['businesses', user.id], () => services.businesses.listMine(user.id));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [periods, setPeriods] = useState<Record<string, DashboardPeriod>>({});
  const storageKey = `bilango.business.${user.id}`;

  useEffect(() => {
    storage
      .get(storageKey)
      .then((id) => id && setSelectedId(id))
      .catch(() => undefined);
  }, [storage, storageKey]);

  const select = useCallback(
    (businessId: string) => {
      setSelectedId(businessId);
      storage.set(storageKey, businessId).catch(() => undefined);
    },
    [storage, storageKey],
  );

  const current = useMemo(() => {
    const list = query.data ?? [];
    return list.find((o) => o.business.id === selectedId) ?? list[0] ?? null;
  }, [query.data, selectedId]);

  const value = useMemo<BusinessContextValue>(
    () => ({
      user,
      overviews: query.data,
      loading: query.loading,
      error: query.error,
      reload: query.reload,
      current,
      select,
      menuOpen,
      setMenuOpen,
      dashboardPeriod: current ? periods[current.business.id] ?? 1 : 1,
      setDashboardPeriod: (period) => {
        if (current) setPeriods(previous => ({ ...previous, [current.business.id]: period }));
      },
    }),
    [user, query.data, query.loading, query.error, query.reload, current, select, menuOpen, periods],
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness(): BusinessContextValue {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness doit être utilisé dans un <BusinessProvider>.');
  return ctx;
}

/** Business courant garanti non nul (écrans réservés aux comptes ayant au moins un business). */
export function useCurrentBusiness(): { user: User; overview: BusinessOverview } {
  const { user, current } = useBusiness();
  if (!current) throw new Error('Aucun business sélectionné.');
  return { user, overview: current };
}

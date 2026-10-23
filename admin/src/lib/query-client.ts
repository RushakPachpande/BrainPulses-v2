import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { adminPersistKey, GC_MS, STALE_MS, adminQueryKeys } from '@/lib/query-keys';

let appQueryClient: QueryClient | null = null;

export function createAdminQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_MS,
        gcTime: GC_MS,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export function setAppQueryClient(client: QueryClient | null) {
  appQueryClient = client;
}

export function getAppQueryClient() {
  return appQueryClient;
}

export function createAdminPersister(orgId: string) {
  return createSyncStoragePersister({
    storage: window.sessionStorage,
    key: adminPersistKey(orgId),
  });
}

export function clearAdminQueryCache(orgId?: string | null) {
  appQueryClient?.clear();
  if (orgId) {
    try {
      sessionStorage.removeItem(adminPersistKey(orgId));
    } catch {
      /* ignore */
    }
  }
}

/** Invalidate domains after successful mutations. */
export function invalidateAdmin(domains: Array<keyof typeof adminQueryKeys | 'all'>) {
  const qc = appQueryClient;
  if (!qc) return;
  for (const domain of domains) {
    if (domain === 'all') {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.all });
      continue;
    }
    if (domain === 'dashboard') {
      void qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    } else if (domain === 'students') {
      void qc.invalidateQueries({ queryKey: ['admin', 'students'] });
    } else if (domain === 'users') {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    } else if (domain === 'activities') {
      void qc.invalidateQueries({ queryKey: ['admin', 'activities'] });
    } else if (domain === 'banks') {
      void qc.invalidateQueries({ queryKey: ['admin', 'banks'] });
    } else if (domain === 'registrations') {
      void qc.invalidateQueries({ queryKey: ['admin', 'registrations'] });
    } else if (domain === 'results' || domain === 'resultsSummary') {
      void qc.invalidateQueries({ queryKey: ['admin', 'results'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'results-summary'] });
    }
  }
}

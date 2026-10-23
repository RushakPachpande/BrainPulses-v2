import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { clientPersistKey, clientQueryKeys, GC_MS, STALE_MS } from './query-keys';

let appQueryClient: QueryClient | null = null;

export function createClientQueryClient() {
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

export function createClientPersister(studentId: string) {
  return createSyncStoragePersister({
    storage: window.sessionStorage,
    key: clientPersistKey(studentId),
  });
}

export function clearClientQueryCache(studentId?: string | null) {
  appQueryClient?.clear();
  if (studentId) {
    try {
      sessionStorage.removeItem(clientPersistKey(studentId));
    } catch {
      /* ignore */
    }
  }
}

export function invalidateClient(domains: Array<'activities' | 'results' | 'dashboard' | 'all'>) {
  const qc = appQueryClient;
  if (!qc) return;
  for (const domain of domains) {
    if (domain === 'all') {
      void qc.invalidateQueries({ queryKey: clientQueryKeys.all });
    } else if (domain === 'activities') {
      void qc.invalidateQueries({ queryKey: ['client', 'activities'] });
    } else if (domain === 'results') {
      void qc.invalidateQueries({ queryKey: ['client', 'results'] });
    } else if (domain === 'dashboard') {
      void qc.invalidateQueries({ queryKey: ['client', 'dashboard'] });
    }
  }
}

import { QueryClient } from '@tanstack/react-query';
import {
  CLIENT_PERSIST_PREFIX,
  clientPersistKey,
  clientQueryKeys,
  GC_MS,
  STALE_MS,
} from './query-keys';

let appQueryClient: QueryClient | null = null;

export function createClientQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_MS,
        gcTime: GC_MS,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 1,
      },
    },
  });
}

export function setAppQueryClient(client: QueryClient | null) {
  appQueryClient = client;
}

function removeSessionKeysWithPrefix(prefix: string) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    /* Storage can be disabled by browser policy. */
  }
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
  removeSessionKeysWithPrefix(CLIENT_PERSIST_PREFIX);
}

/** Call once on app boot so hard-reloads never revive stale list data. */
export function purgeLegacyClientQueryPersistence() {
  removeSessionKeysWithPrefix(CLIENT_PERSIST_PREFIX);
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

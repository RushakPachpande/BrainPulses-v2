import { QueryClient } from '@tanstack/react-query';
import {
  ADMIN_PERSIST_PREFIX,
  GC_MS,
  STALE_MS,
  adminPersistKey,
  adminQueryKeys,
} from '@/lib/query-keys';

let appQueryClient: QueryClient | null = null;

export function createAdminQueryClient() {
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

export function getAppQueryClient() {
  return appQueryClient;
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

/** Drop in-memory queries and any legacy persisted query blobs. */
export function clearAdminQueryCache(orgId?: string | null) {
  appQueryClient?.clear();
  if (orgId) {
    try {
      sessionStorage.removeItem(adminPersistKey(orgId));
    } catch {
      /* ignore */
    }
  }
  removeSessionKeysWithPrefix(ADMIN_PERSIST_PREFIX);
}

/** Call once on app boot so hard-reloads never revive stale list data. */
export function purgeLegacyAdminQueryPersistence() {
  removeSessionKeysWithPrefix(ADMIN_PERSIST_PREFIX);
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
    } else if (domain === 'sponsors') {
      void qc.invalidateQueries({ queryKey: ['admin', 'sponsors'] });
    } else if (domain === 'contests') {
      void qc.invalidateQueries({ queryKey: ['admin', 'contests'] });
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
    } else if (domain === 'imageLibrary') {
      void qc.invalidateQueries({ queryKey: ['admin', 'image-library'] });
    }
  }
}

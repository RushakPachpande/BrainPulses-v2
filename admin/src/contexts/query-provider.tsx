import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useAuth } from '@/contexts/auth-context';
import {
  clearAdminQueryCache,
  createAdminPersister,
  createAdminQueryClient,
  setAppQueryClient,
} from '@/lib/query-client';
import { GC_MS } from '@/lib/query-keys';

export function AdminQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createAdminQueryClient());

  useEffect(() => {
    setAppQueryClient(client);
    return () => setAppQueryClient(null);
  }, [client]);

  return <AdminQueryPersist client={client}>{children}</AdminQueryPersist>;
}

function AdminQueryPersist({
  client,
  children,
}: {
  client: ReturnType<typeof createAdminQueryClient>;
  children: ReactNode;
}) {
  const auth = useAuth();
  const orgId = auth.status === 'authenticated' ? auth.organization.id : null;
  const prevOrgRef = useMemo(() => ({ id: null as string | null }), []);

  useEffect(() => {
    if (prevOrgRef.id && prevOrgRef.id !== orgId) {
      clearAdminQueryCache(prevOrgRef.id);
    }
    prevOrgRef.id = orgId;
  }, [orgId, prevOrgRef]);

  const persister = useMemo(() => (orgId ? createAdminPersister(orgId) : null), [orgId]);

  if (!persister) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: GC_MS,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === 'success',
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

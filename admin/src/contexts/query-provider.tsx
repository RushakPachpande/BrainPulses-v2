import { useEffect, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import {
  clearAdminQueryCache,
  createAdminQueryClient,
  purgeLegacyAdminQueryPersistence,
  setAppQueryClient,
} from '@/lib/query-client';

export function AdminQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createAdminQueryClient());

  useEffect(() => {
    purgeLegacyAdminQueryPersistence();
    setAppQueryClient(client);
    return () => setAppQueryClient(null);
  }, [client]);

  return <AdminQueryScope client={client}>{children}</AdminQueryScope>;
}

function AdminQueryScope({
  client,
  children,
}: {
  client: ReturnType<typeof createAdminQueryClient>;
  children: ReactNode;
}) {
  const auth = useAuth();
  const orgId = auth.status === 'authenticated' ? auth.organization.id : null;

  useEffect(() => {
    // Org switch / logout: never keep another tenant's list data in memory.
    clearAdminQueryCache(orgId);
  }, [orgId]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

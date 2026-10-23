import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useAuth } from './auth-context';
import {
  clearClientQueryCache,
  createClientPersister,
  createClientQueryClient,
  setAppQueryClient,
} from '../lib/query-client';
import { GC_MS } from '../lib/query-keys';

export function ClientQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createClientQueryClient());

  useEffect(() => {
    setAppQueryClient(client);
    return () => setAppQueryClient(null);
  }, [client]);

  return <ClientQueryPersist client={client}>{children}</ClientQueryPersist>;
}

function ClientQueryPersist({
  client,
  children,
}: {
  client: ReturnType<typeof createClientQueryClient>;
  children: ReactNode;
}) {
  const { student } = useAuth();
  const studentId = student?.id ?? null;
  const prevRef = useMemo(() => ({ id: null as string | null }), []);

  useEffect(() => {
    if (prevRef.id && prevRef.id !== studentId) {
      clearClientQueryCache(prevRef.id);
    }
    prevRef.id = studentId;
  }, [studentId, prevRef]);

  const persister = useMemo(
    () => (studentId ? createClientPersister(studentId) : null),
    [studentId],
  );

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

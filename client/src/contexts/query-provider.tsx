import { useEffect, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './auth-context';
import {
  clearClientQueryCache,
  createClientQueryClient,
  purgeLegacyClientQueryPersistence,
  setAppQueryClient,
} from '../lib/query-client';

export function ClientQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createClientQueryClient());

  useEffect(() => {
    purgeLegacyClientQueryPersistence();
    setAppQueryClient(client);
    return () => setAppQueryClient(null);
  }, [client]);

  return <ClientQueryScope client={client}>{children}</ClientQueryScope>;
}

function ClientQueryScope({
  client,
  children,
}: {
  client: ReturnType<typeof createClientQueryClient>;
  children: ReactNode;
}) {
  const { student } = useAuth();
  const studentId = student?.id ?? null;

  useEffect(() => {
    // Student switch / logout: never keep another user's list data in memory.
    clearClientQueryCache(studentId);
  }, [studentId]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

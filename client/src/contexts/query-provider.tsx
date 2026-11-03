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
  const { participant } = useAuth();
  const participantId = participant?.id ?? null;

  useEffect(() => {
    // Participant switch / logout: never keep another user's list data in memory.
    clearClientQueryCache(participantId);
  }, [participantId]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

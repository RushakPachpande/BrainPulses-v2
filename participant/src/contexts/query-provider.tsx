import { useEffect, useRef, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './auth-context';
import {
  clearClientQueryCache,
  createClientQueryClient,
  purgeLegacyClientQueryPersistence,
  setAppQueryClient,
} from '../lib/query-client';
import { purgeDurableClientPrefs } from '../storage';

export function ClientQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createClientQueryClient());

  useEffect(() => {
    purgeDurableClientPrefs();
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
  const previousIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const previous = previousIdRef.current;
    previousIdRef.current = participantId;
    // Skip the first hydration (undefined → id|null). Clear only on logout or account switch.
    if (previous === undefined) return;
    if (previous && previous !== participantId) {
      clearClientQueryCache(previous);
    }
  }, [participantId]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

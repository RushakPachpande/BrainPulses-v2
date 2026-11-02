import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/auth-context';
import { clientQueryKeys } from '../lib/query-keys';
import { getParticipantPages } from '../services/api';

export function useParticipantPages() {
  const { participant } = useAuth();
  const participantId = participant?.id ?? '';
  return useQuery({
    queryKey: clientQueryKeys.pages(participantId),
    queryFn: getParticipantPages,
    enabled: Boolean(participantId),
  });
}

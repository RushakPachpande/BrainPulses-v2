import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/auth-context';
import { clientQueryKeys } from '../lib/query-keys';
import { listActivities } from '../services/api';

export function useAllotment() {
  const { participant } = useAuth();
  const participantId = participant?.id ?? '';
  const enabled = Boolean(participantId);
  const quizzes = useQuery({
    queryKey: clientQueryKeys.activities(participantId, 'quiz'),
    queryFn: ({ signal }) => listActivities('quiz', signal),
    enabled,
  });
  const assessments = useQuery({
    queryKey: clientQueryKeys.activities(participantId, 'assessment'),
    queryFn: ({ signal }) => listActivities('assessment', signal),
    enabled,
  });

  return {
    pending: enabled && (quizzes.isPending || assessments.isPending),
    hasQuiz: (quizzes.data?.length ?? 0) > 0,
    hasAssessment: (assessments.data?.length ?? 0) > 0,
    quizCount: quizzes.data?.length ?? 0,
    assessmentCount: assessments.data?.length ?? 0,
  };
}

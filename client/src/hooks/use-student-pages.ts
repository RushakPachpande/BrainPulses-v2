import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/auth-context';
import { clientQueryKeys } from '../lib/query-keys';
import { getStudentPages } from '../services/api';

export function useStudentPages() {
  const { student } = useAuth();
  const studentId = student?.id ?? '';
  return useQuery({
    queryKey: clientQueryKeys.pages(studentId),
    queryFn: getStudentPages,
    enabled: Boolean(studentId),
  });
}

import { useAuth } from '@/contexts/auth-context';

/** Organization id when authenticated; empty string otherwise (disables queries). */
export function useOrgId() {
  const auth = useAuth();
  return auth.status === 'authenticated' ? auth.organization.id : '';
}

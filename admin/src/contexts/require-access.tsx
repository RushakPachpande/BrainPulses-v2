import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canEditKind,
  canManageUsersOrSettings,
  canMutateOrg,
  type ActivityKind,
} from '@/lib/access';

export type AccessGate =
  | { type: 'editKind'; kind: ActivityKind }
  | { type: 'mutateOrg' }
  | { type: 'manageUsersOrSettings' };

function allowed(membership: Parameters<typeof canEditKind>[0], gate: AccessGate): boolean {
  switch (gate.type) {
    case 'editKind':
      return canEditKind(membership, gate.kind);
    case 'mutateOrg':
      return canMutateOrg(membership);
    case 'manageUsersOrSettings':
      return canManageUsersOrSettings(membership);
  }
}

function fallbackPath(gate: AccessGate, pathname: string): string {
  if (gate.type === 'editKind') {
    if (pathname.includes('/banks')) return `/${gate.kind}s/banks`;
    if (pathname.includes('/registrations')) return `/${gate.kind}s/registrations`;
    return `/${gate.kind}s`;
  }
  if (gate.type === 'manageUsersOrSettings') {
    if (pathname.startsWith('/settings')) return '/settings';
    return '/users';
  }
  return '/students';
}

/** Blocks mutation routes when membership lacks the required access. */
export function RequireAccess({ gate }: { gate: AccessGate }) {
  const auth = useAuth();
  const location = useLocation();
  const denied = auth.status === 'authenticated' ? !allowed(auth.membership, gate) : false;
  const toastShown = useRef(false);

  useEffect(() => {
    if (!denied || toastShown.current) return;
    toastShown.current = true;
    toast.error('You do not have permission to perform this action.');
  }, [denied]);

  if (auth.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (denied) {
    return <Navigate to={fallbackPath(gate, location.pathname)} replace />;
  }

  return <Outlet />;
}

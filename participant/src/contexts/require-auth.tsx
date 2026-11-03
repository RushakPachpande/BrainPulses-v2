import { Navigate, Outlet, useLocation } from 'react-router';
import { PortalBackdrop } from '../components/portal-backdrop';
import { AuthSessionSkeleton } from '../components/skeletons';
import { useAuth } from './auth-context';

export function RequireAuth() {
  const { ready, participant } = useAuth();
  const location = useLocation();

  if (!ready) {
    return <AuthSessionSkeleton />;
  }

  if (!participant) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <>
      <PortalBackdrop />
      <Outlet />
    </>
  );
}

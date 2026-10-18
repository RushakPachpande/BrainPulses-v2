import { Navigate, Outlet, useLocation } from 'react-router';
import { AuthSessionSkeleton } from '../components/skeletons';
import { useAuth } from './auth-context';

export function RequireAuth() {
  const { ready, student } = useAuth();
  const location = useLocation();

  if (!ready) {
    return <AuthSessionSkeleton />;
  }

  if (!student) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

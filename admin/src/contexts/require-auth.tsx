import { Navigate, Outlet, useLocation } from 'react-router';
import { AuthLoadingSkeleton } from '@/components/loading-skeletons';
import { useAuth } from '@/contexts/auth-context';

export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') {
    return <AuthLoadingSkeleton />;
  }

  if (auth.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const mustChange = auth.user.mustChangePassword;
  const onChangePasswordPage = location.pathname === '/change-password';

  if (mustChange && !onChangePasswordPage) {
    return <Navigate to="/change-password" replace />;
  }

  if (!mustChange && onChangePasswordPage) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

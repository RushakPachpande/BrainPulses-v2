import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/contexts/auth-context';

export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (auth.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

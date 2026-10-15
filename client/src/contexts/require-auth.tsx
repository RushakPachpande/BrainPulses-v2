import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './auth';

export function RequireAuth() {
  const { ready, student } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ margin: 'auto' }}>
          Loading session…
        </div>
      </div>
    );
  }

  if (!student) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

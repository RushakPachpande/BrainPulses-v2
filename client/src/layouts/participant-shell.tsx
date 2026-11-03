import {
  BookOpen,
  CircleHelp,
  Home,
  LogOut,
  Menu,
  Target,
  Trophy,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { ThemeToggle } from '../components/theme-toggle';
import { useAuth } from '../contexts/auth-context';
import type { ParticipantPageKey, ParticipantPages } from '../lib/participant-pages';

const nav: {
  key: ParticipantPageKey;
  label: string;
  path: string;
  icon: typeof Home;
}[] = [
  { key: 'overview', label: 'Overview', path: '/dashboard', icon: Home },
  { key: 'quizzes', label: 'My quizzes', path: '/quizzes', icon: BookOpen },
  { key: 'assessments', label: 'Assessments', path: '/assessments', icon: Target },
  { key: 'results', label: 'My results', path: '/results', icon: Trophy },
];

export function ParticipantShell({
  title,
  pages,
  children,
}: {
  title: string;
  pages: ParticipantPages | null;
  children?: ReactNode;
}) {
  const { participant, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const name = participant?.name ?? 'Participant';
  const initials = name
    .split(' ')
    .map((x) => x[0])
    .slice(0, 2)
    .join('');

  useEffect(() => {
    setMobile(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <div className="brand-row">
          <img src="/brand.svg" alt="" />
          <span>BrainPulses</span>
          <button
            className="icon-btn close-nav"
            onClick={() => setMobile(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="side-nav">
          {nav
            .filter((item) => pages?.[item.key])
            .map((n) => {
              const Icon = n.icon;
              return (
                <NavLink
                  key={n.path}
                  to={n.path}
                  className={({ isActive }) =>
                    `nav-item ${isActive || (n.path === '/results' && location.pathname.startsWith('/results/')) ? 'active' : ''}`
                  }
                >
                  <Icon size={18} />
                  <span>{n.label}</span>
                </NavLink>
              );
            })}
        </nav>
        <div className="sidebar-bottom">
          {pages?.profile ? (
            <NavLink
              to="/profile"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <UserRound size={18} />
              <span>My profile</span>
            </NavLink>
          ) : null}
          {pages?.help ? (
            <NavLink
              to="/help"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <CircleHelp size={18} />
              <span>Help centre</span>
            </NavLink>
          ) : null}
          <div className="participant-mini">
            <div className="avatar" aria-hidden>
              {initials}
            </div>
            <div className="participant-mini-info">
              <b>{name}</b>
              <span>{participant?.organization.name ?? 'Participant account'}</span>
            </div>
            <div className="participant-mini-actions">
              <ThemeToggle />
              <button
                type="button"
                className="icon-btn"
                aria-label="Sign out"
                title="Sign out"
                onClick={() => setSignOutConfirm(true)}
              >
                <LogOut size={18} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="nav-scrim"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        />
      )}
      <header className="topbar">
        <button
          className="icon-btn mobile-menu"
          onClick={() => setMobile(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="topbar-title">
          <b>{title}</b>
        </div>
        <div className="topbar-actions">
          <ThemeToggle />
        </div>
      </header>
      <main className="main-content">
        <div className="page-enter" key={location.pathname}>
          {children ?? <Outlet />}
        </div>
      </main>
      <footer className="app-footer">
        <span>© 2026 BrainPulses</span>
        <span>Learn steadily. Grow confidently.</span>
      </footer>
      {signOutConfirm ? (
        <div className="modal-backdrop">
          <div className="confirm-modal" role="dialog" aria-labelledby="sign-out-title">
            <div className="modal-icon">
              <LogOut size={22} />
            </div>
            <button
              className="modal-close icon-btn"
              type="button"
              onClick={() => setSignOutConfirm(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <h2 id="sign-out-title">Sign out?</h2>
            <p>You will need to sign in again to continue.</p>
            <div className="modal-actions">
              <button
                className="btn outline"
                type="button"
                onClick={() => setSignOutConfirm(false)}
              >
                Stay signed in
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={() => {
                  setSignOutConfirm(false);
                  signOut();
                  navigate('/login', { replace: true });
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

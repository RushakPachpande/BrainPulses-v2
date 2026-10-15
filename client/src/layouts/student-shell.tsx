import {
  Bell,
  BookOpen,
  CalendarDays,
  CircleHelp,
  Home,
  Menu,
  Moon,
  Sun,
  Target,
  Trophy,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../contexts/auth';
import { readStorage, writeStorage } from '../storage';
import { formatDateLabel } from '../components/ui-bits';

const nav = [
  { label: 'Overview', path: '/dashboard', icon: Home },
  { label: 'My quizzes', path: '/quizzes', icon: BookOpen },
  { label: 'Assessments', path: '/assessments', icon: Target },
  { label: 'My results', path: '/results', icon: Trophy },
];

export function StudentShell({ title, children }: { title: string; children?: ReactNode }) {
  const { student, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => readStorage('brainpulses-client-theme') !== 'light');
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState('');
  const name = student?.name ?? 'Student';
  const initials = name
    .split(' ')
    .map((x) => x[0])
    .slice(0, 2)
    .join('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    writeStorage('brainpulses-client-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setMobile(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <div className="brand-row">
          <img src="/brand.svg" alt="" />
          <span>BrainPulses</span>
          <button className="icon-btn close-nav" onClick={() => setMobile(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <div className="workspace-label">STUDENT WORKSPACE</div>
        <nav className="side-nav">
          {nav.map((n) => {
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
          <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <UserRound size={18} />
            <span>My profile</span>
          </NavLink>
          <NavLink to="/help" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <CircleHelp size={18} />
            <span>Help centre</span>
          </NavLink>
          <div className="student-mini">
            <div className="avatar">{initials}</div>
            <div className="student-mini-info">
              <b>{name}</b>
              <span>{student?.organization.name ?? 'Student account'}</span>
            </div>
          </div>
          <button
            type="button"
            className="nav-item"
            onClick={() => {
              signOut();
              navigate('/login', { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      {mobile && (
        <button className="nav-scrim" onClick={() => setMobile(false)} aria-label="Close navigation" />
      )}
      <header className="topbar">
        <button className="icon-btn mobile-menu" onClick={() => setMobile(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <div className="topbar-title">
          <span className="crumb">Student portal</span>
          <span className="crumb-sep">/</span>
          <b>{title}</b>
        </div>
        <div className="topbar-actions">
          <div className="top-date">
            <CalendarDays size={15} />
            {formatDateLabel(new Date().toISOString())}
          </div>
          <button
            className="icon-btn"
            aria-label="Toggle theme"
            onClick={() => setDark((x) => !x)}
            type="button"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="icon-btn"
            aria-label="Notifications"
            type="button"
            onClick={() => setToast('You are all caught up.')}
          >
            <Bell size={18} />
          </button>
          <button
            className="top-avatar"
            onClick={() => navigate('/profile')}
            aria-label="Open profile"
            type="button"
          >
            {initials}
          </button>
        </div>
      </header>
      <main className="main-content">
        {children ?? <Outlet />}
        {toast && (
          <div className="toast">
            {toast}
            <button type="button" onClick={() => setToast('')} aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        )}
      </main>
      <footer className="app-footer">
        <span>© 2026 BrainPulses</span>
        <span>Learn steadily. Grow confidently.</span>
      </footer>
    </div>
  );
}

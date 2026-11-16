import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../contexts/auth-context';
import { useAllotment } from '../hooks/use-allotment';
import { allotmentLandingPath } from '../lib/allotment';
import { IconList, IconLogout, IconQuiz } from '../components/portal-icons';
import { PortalBrand } from '../components/portal-brand';
import { ThemeButton } from '../components/theme-button';

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ParticipantShell({ children }: { children?: ReactNode }) {
  const { participant, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const allotment = useAllotment();
  const menuId = useId();
  const accountRef = useRef<HTMLDivElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const name = participant?.name ?? 'Participant';
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  function goHome() {
    if (allotment.pending) {
      navigate('/');
      return;
    }
    navigate(allotmentLandingPath(allotment));
  }

  function logOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  useEffect(() => {
    setAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    function onPointer(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [accountOpen]);

  return (
    <>
      <header className="topbar">
        <PortalBrand onHome={goHome} />
        <nav className="topnav" aria-label="Portal">
          {allotment.hasQuiz ? (
            <NavLink
              to="/quizzes"
              className={({ isActive }) => (isActive ? 'on' : '')}
              aria-label={allotment.quizCount > 0 ? `Quizzes, ${allotment.quizCount}` : 'Quizzes'}
            >
              <IconQuiz />
              <span>Quizzes</span>
            </NavLink>
          ) : null}
          {allotment.hasAssessment ? (
            <NavLink
              to="/assessments"
              className={({ isActive }) => (isActive ? 'on' : '')}
              aria-label={
                allotment.assessmentCount > 0
                  ? `Assessments, ${allotment.assessmentCount}`
                  : 'Assessments'
              }
            >
              <IconList />
              <span>Assessments</span>
            </NavLink>
          ) : null}
        </nav>
        <div className="topbar-end">
          <ThemeButton className="thm topbar-theme" />
          <div className="account" ref={accountRef}>
            <button
              className="account-btn"
              type="button"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              aria-controls={menuId}
              onClick={() => setAccountOpen((open) => !open)}
            >
              <span className="av">{initials || 'BP'}</span>
              <Chevron />
              <span className="sr-only">{name}</span>
            </button>
            {accountOpen ? (
              <div className="account-menu" id={menuId} role="menu">
                <div className="account-id">
                  <b>{name}</b>
                  <small>{participant?.code ?? 'Participant'}</small>
                </div>
                <button className="lo" type="button" role="menuitem" onClick={logOut}>
                  <IconLogout />
                  <span>Log out</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <main className="main">{children}</main>
      <footer className="app-footer">
        <span>© 2026 BrainPulses</span>
        <span>Learn steadily. Grow confidently.</span>
      </footer>
    </>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../contexts/auth-context';
import { useAllotment } from '../hooks/use-allotment';
import { allotmentLandingPath } from '../lib/allotment';
import { IconList, IconLogout, IconPanel, IconQuiz } from '../components/portal-icons';
import { PortalBrand } from '../components/portal-brand';
import { ThemeButton } from '../components/theme-button';

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width:860px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width:860px)');
    const onChange = () => setNarrow(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

export function ParticipantShell({ children }: { children?: ReactNode }) {
  const { participant, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const narrow = useNarrow();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const allotment = useAllotment();
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

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('pc', collapsed && !narrow);
    document.body.classList.toggle('mx', mobileOpen && narrow);
    return () => {
      document.body.classList.remove('pc', 'mx');
    };
  }, [collapsed, mobileOpen, narrow]);

  function togglePanel() {
    if (narrow) setMobileOpen((open) => !open);
    else setCollapsed((value) => !value);
  }

  return (
    <>
      <button
        className="scrim"
        id="scrim"
        type="button"
        aria-label="Close menu"
        onClick={() => setMobileOpen(false)}
      />
      <aside className="side" aria-label="Menu">
        <div className="sh">
          <PortalBrand onHome={goHome} />
          <button
            className="tg"
            id="tgl"
            type="button"
            title="Hide panel"
            aria-label="Hide panel"
            onClick={togglePanel}
          >
            <IconPanel expanded />
          </button>
        </div>
        <nav className="nv">
          {allotment.hasQuiz ? (
            <NavLink to="/quizzes" className={({ isActive }) => (isActive ? 'on' : '')}>
              <IconQuiz />
              <span>Quizzes</span>
              <i>{allotment.quizCount}</i>
            </NavLink>
          ) : null}
          {allotment.hasAssessment ? (
            <NavLink to="/assessments" className={({ isActive }) => (isActive ? 'on' : '')}>
              <IconList />
              <span>Assessments</span>
              <i>{allotment.assessmentCount}</i>
            </NavLink>
          ) : null}
        </nav>
        <div className="sb">
          <div className="us">
            <div className="av">{initials || 'BP'}</div>
            <div>
              <b>{name}</b>
              <small>{participant?.code ?? 'Participant'}</small>
            </div>
          </div>
          <button
            className="lo"
            id="logout"
            type="button"
            onClick={() => {
              signOut();
              navigate('/login', { replace: true });
            }}
          >
            <IconLogout />
            <span>Log out</span>
          </button>
        </div>
      </aside>
      <div className="fb">
        <button
          className="tg"
          id="tgl2"
          type="button"
          title="Show panel"
          aria-label="Show panel"
          onClick={togglePanel}
        >
          <IconPanel expanded={false} />
        </button>
        <PortalBrand onHome={goHome} />
      </div>
      <ThemeButton />
      <main className="main">{children}</main>
      <footer className="app-footer">
        <span>© 2026 BrainPulses</span>
        <span>Learn steadily. Grow confidently.</span>
      </footer>
    </>
  );
}

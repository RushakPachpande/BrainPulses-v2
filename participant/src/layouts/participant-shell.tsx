import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/auth-context';
import type { ParticipantPages } from '../lib/participant-pages';
import { clientQueryKeys } from '../lib/query-keys';
import { listActivities } from '../services/api';
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

export function ParticipantShell({
  pages,
  children,
}: {
  pages: ParticipantPages | null;
  children?: ReactNode;
}) {
  const { participant, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const narrow = useNarrow();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const participantId = participant?.id ?? '';
  const name = participant?.name ?? 'Participant';
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const quizzes = useQuery({
    queryKey: clientQueryKeys.activities(participantId, 'quiz'),
    queryFn: () => listActivities('quiz'),
    enabled: Boolean(participantId) && (pages?.quizzes ?? true),
  });
  const assessments = useQuery({
    queryKey: clientQueryKeys.activities(participantId, 'assessment'),
    queryFn: () => listActivities('assessment'),
    enabled: Boolean(participantId) && (pages?.assessments ?? true),
  });

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
          <PortalBrand onHome={() => navigate('/dashboard')} />
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
          {pages?.quizzes !== false ? (
            <NavLink to="/quizzes" className={({ isActive }) => (isActive ? 'on' : '')}>
              <IconQuiz />
              <span>Quizzes</span>
              <i>{quizzes.data?.length ?? 0}</i>
            </NavLink>
          ) : null}
          {pages?.assessments ? (
            <NavLink to="/assessments" className={({ isActive }) => (isActive ? 'on' : '')}>
              <IconList />
              <span>Assessments</span>
              <i>{assessments.data?.length ?? 0}</i>
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
        <PortalBrand onHome={() => navigate('/dashboard')} />
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

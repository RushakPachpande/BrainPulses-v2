import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useParticipantPages } from '../hooks/use-participant-pages';
import {
  DEFAULT_PARTICIPANT_PAGES,
  firstEnabledParticipantPath,
  participantPageForPath,
} from '../lib/participant-pages';
import { ParticipantShell } from './participant-shell';

function titleForPath(pathname: string) {
  if (pathname.startsWith('/quizzes/')) return 'Quiz details';
  if (pathname.startsWith('/quizzes')) return 'My quizzes';
  if (pathname.startsWith('/assessments/')) return 'Assessment details';
  if (pathname.startsWith('/assessments')) return 'Assessments';
  if (pathname.startsWith('/results')) return 'My results';
  if (pathname.startsWith('/profile')) return 'My profile';
  if (pathname.startsWith('/help')) return 'Help centre';
  return 'Overview';
}

function PagesUnavailable() {
  return (
    <div className="empty-state" role="status">
      <b>No participant pages are available right now</b>
      <span>An administrator can turn pages back on from settings.</span>
    </div>
  );
}

export function ParticipantPageGuard({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const pagesQuery = useParticipantPages();
  const pages = pagesQuery.data ?? (pagesQuery.isError ? DEFAULT_PARTICIPANT_PAGES : null);
  const title = titleForPath(location.pathname);

  if (!pages) {
    return (
      <ParticipantShell title={title} pages={null}>
        <p className="sr-only">Loading page</p>
      </ParticipantShell>
    );
  }

  const dest = firstEnabledParticipantPath(pages);
  if (!dest) {
    return (
      <ParticipantShell title="Participant portal" pages={pages}>
        <PagesUnavailable />
      </ParticipantShell>
    );
  }

  const page = participantPageForPath(location.pathname);
  if (page && !pages[page]) {
    return <Navigate to={dest} replace />;
  }

  return (
    <ParticipantShell title={title} pages={pages}>
      {children}
    </ParticipantShell>
  );
}

export function EnabledHome() {
  const pagesQuery = useParticipantPages();
  const pages = pagesQuery.data ?? (pagesQuery.isError ? DEFAULT_PARTICIPANT_PAGES : null);
  if (!pages) return <p className="sr-only">Loading page</p>;
  const dest = firstEnabledParticipantPath(pages);
  if (!dest) return <PagesUnavailable />;
  return <Navigate to={dest} replace />;
}

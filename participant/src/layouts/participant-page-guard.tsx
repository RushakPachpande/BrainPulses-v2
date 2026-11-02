import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useParticipantPages } from '../hooks/use-participant-pages';
import {
  DEFAULT_PARTICIPANT_PAGES,
  firstEnabledParticipantPath,
  participantPageForPath,
} from '../lib/participant-pages';
import { ParticipantShell } from './participant-shell';

function PagesUnavailable() {
  return (
    <div className="empty-state" role="status">
      <b>No participant pages are available right now</b>
      <span>An administrator can turn pages back on from settings.</span>
    </div>
  );
}

export function ParticipantPageGuard({
  children,
  shell = true,
}: {
  children?: ReactNode;
  shell?: boolean;
}) {
  const location = useLocation();
  const pagesQuery = useParticipantPages();
  const pages = pagesQuery.data ?? (pagesQuery.isError ? DEFAULT_PARTICIPANT_PAGES : null);

  if (!pages) {
    return shell ? (
      <ParticipantShell pages={null}>
        <p className="sr-only">Loading page</p>
      </ParticipantShell>
    ) : (
      <p className="sr-only">Loading page</p>
    );
  }

  const dest = firstEnabledParticipantPath(pages);
  if (!dest) {
    return shell ? (
      <ParticipantShell pages={pages}>
        <PagesUnavailable />
      </ParticipantShell>
    ) : (
      <PagesUnavailable />
    );
  }

  const page = participantPageForPath(location.pathname);
  if (page && !pages[page]) {
    return <Navigate to={dest} replace />;
  }

  if (!shell) return children;
  return <ParticipantShell pages={pages}>{children}</ParticipantShell>;
}

export function EnabledHome() {
  const pagesQuery = useParticipantPages();
  const pages = pagesQuery.data ?? (pagesQuery.isError ? DEFAULT_PARTICIPANT_PAGES : null);
  if (!pages) return <p className="sr-only">Loading page</p>;
  const dest = firstEnabledParticipantPath(pages);
  if (!dest) return <PagesUnavailable />;
  return <Navigate to={dest} replace />;
}

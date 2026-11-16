import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { PageLoader } from '../components/loading-overlay';
import { useAllotment } from '../hooks/use-allotment';
import { allotmentAllowsPath, allotmentLandingPath } from '../lib/allotment';
import { ParticipantShell } from './participant-shell';

export function ParticipantPageGuard({
  children,
  shell = true,
}: {
  children?: ReactNode;
  shell?: boolean;
}) {
  const location = useLocation();
  const allotment = useAllotment();

  if (allotment.pending) {
    return shell ? (
      <ParticipantShell>
        <PageLoader />
      </ParticipantShell>
    ) : (
      <PageLoader />
    );
  }

  if (!allotmentAllowsPath(location.pathname, allotment)) {
    return <Navigate to={allotmentLandingPath(allotment)} replace />;
  }

  if (!shell) return children;
  return <ParticipantShell>{children}</ParticipantShell>;
}

export function EnabledHome() {
  const allotment = useAllotment();
  if (allotment.pending) return <PageLoader />;
  return <Navigate to={allotmentLandingPath(allotment)} replace />;
}

import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, useParams } from 'react-router';
import { RouteLoadingSkeleton } from '@/components/loading-skeletons';
import { RequireAccess } from '@/contexts/require-access';
import { RequireAuth } from '@/contexts/require-auth';
import { LoginPage } from '@/pages/login';

const AdminLayout = lazy(() =>
  import('@/layouts/admin-layout').then((m) => ({ default: m.AdminLayout })),
);
const DashboardPage = lazy(() =>
  import('@/pages/dashboard').then((m) => ({ default: m.DashboardPage })),
);
const ParticipantsPage = lazy(() =>
  import('@/pages/participants').then((m) => ({ default: m.ParticipantsPage })),
);
const SponsorsPage = lazy(() =>
  import('@/pages/sponsors').then((m) => ({ default: m.SponsorsPage })),
);
const ContestsPage = lazy(() =>
  import('@/pages/contests').then((m) => ({ default: m.ContestsPage })),
);
const UsersPage = lazy(() => import('@/pages/users').then((m) => ({ default: m.UsersPage })));
const ChangePasswordPage = lazy(() =>
  import('@/pages/change-password').then((m) => ({ default: m.ChangePasswordPage })),
);
const ActivityListPage = lazy(() =>
  import('@/pages/activity-list').then((m) => ({ default: m.ActivityListPage })),
);
const ActivityWizardPage = lazy(() =>
  import('@/pages/activity-wizard').then((m) => ({ default: m.ActivityWizardPage })),
);
const RegistrationsPage = lazy(() =>
  import('@/pages/registrations').then((m) => ({ default: m.RegistrationsPage })),
);
const AssignRegistrationPage = lazy(() =>
  import('@/pages/assign-registration').then((m) => ({ default: m.AssignRegistrationPage })),
);
const RegistrationDetailPage = lazy(() =>
  import('@/pages/registration-detail').then((m) => ({ default: m.RegistrationDetailPage })),
);
const ReportsPage = lazy(() => import('@/pages/reports').then((m) => ({ default: m.ReportsPage })));
const QuizReportsPage = lazy(() =>
  import('@/pages/quiz-reports').then((m) => ({ default: m.QuizReportsPage })),
);
const ResultDetailPage = lazy(() =>
  import('@/pages/result-detail').then((m) => ({ default: m.ResultDetailPage })),
);
const GeneralSettingsPage = lazy(() =>
  import('@/pages/settings-general').then((m) => ({ default: m.GeneralSettingsPage })),
);
const ParticipantPortalSettingsPage = lazy(() =>
  import('@/pages/settings-participant-portal').then((m) => ({
    default: m.ParticipantPortalSettingsPage,
  })),
);
const DesignSystemPage = lazy(() =>
  import('@/pages/design-system').then((m) => ({ default: m.DesignSystemPage })),
);

function SuspenseOutlet() {
  return (
    <Suspense fallback={<RouteLoadingSkeleton />}>
      <Outlet />
    </Suspense>
  );
}

function LegacyParticipantRoute({ edit }: { edit?: boolean }) {
  const { participantId = '' } = useParams();
  const target = edit
    ? `/participants?edit=${participantId}`
    : `/participants?view=${participantId}`;
  return <Navigate to={target} replace />;
}

function LegacyUserRoute({ edit }: { edit?: boolean }) {
  const { userId = '' } = useParams();
  const target = edit ? `/users?edit=${userId}` : `/users?view=${userId}`;
  return <Navigate to={target} replace />;
}

function LegacySponsorRoute({ edit }: { edit?: boolean }) {
  const { sponsorId = '' } = useParams();
  const target = edit ? `/sponsors?edit=${sponsorId}` : `/sponsors?view=${sponsorId}`;
  return <Navigate to={target} replace />;
}

function LegacyContestRoute({ edit }: { edit?: boolean }) {
  const { contestId = '' } = useParams();
  const target = edit ? `/contests?edit=${contestId}` : `/contests?view=${contestId}`;
  return <Navigate to={target} replace />;
}

export function AppRoutes() {
  return (
    <Route element={<SuspenseOutlet />}>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="participants" element={<ParticipantsPage />} />
          <Route path="students" element={<Navigate to="/participants" replace />} />
          <Route path="students/*" element={<Navigate to="/participants" replace />} />
          <Route element={<RequireAccess gate={{ type: 'mutateOrg' }} />}>
            <Route
              path="participants/new"
              element={<Navigate to="/participants?create=1" replace />}
            />
            <Route
              path="participants/:participantId/edit"
              element={<LegacyParticipantRoute edit />}
            />
          </Route>
          <Route path="participants/:participantId" element={<LegacyParticipantRoute />} />
          <Route path="sponsors" element={<SponsorsPage />} />
          <Route element={<RequireAccess gate={{ type: 'mutateOrg' }} />}>
            <Route path="sponsors/new" element={<Navigate to="/sponsors?create=1" replace />} />
            <Route path="sponsors/:sponsorId/edit" element={<LegacySponsorRoute edit />} />
          </Route>
          <Route path="sponsors/:sponsorId" element={<LegacySponsorRoute />} />
          <Route path="contests" element={<ContestsPage />} />
          <Route element={<RequireAccess gate={{ type: 'mutateOrg' }} />}>
            <Route path="contests/new" element={<Navigate to="/contests?create=1" replace />} />
            <Route path="contests/:contestId/edit" element={<LegacyContestRoute edit />} />
          </Route>
          <Route path="contests/:contestId" element={<LegacyContestRoute />} />
          <Route path="users" element={<UsersPage />} />
          <Route element={<RequireAccess gate={{ type: 'manageUsersOrSettings' }} />}>
            <Route path="users/new" element={<Navigate to="/users?create=1" replace />} />
            <Route path="users/:userId/edit" element={<LegacyUserRoute edit />} />
          </Route>
          <Route path="users/:userId" element={<LegacyUserRoute />} />

          <Route path="assessments" element={<ActivityListPage kind="assessment" />} />
          <Route
            path="assessments/registrations"
            element={<RegistrationsPage kind="assessment" />}
          />
          <Route
            path="assessments/registrations/:registrationId"
            element={<RegistrationDetailPage kind="assessment" mode="view" />}
          />
          <Route path="assessments/reports" element={<ReportsPage kind="assessment" />} />
          <Route
            path="assessments/reports/:resultId"
            element={<ResultDetailPage kind="assessment" />}
          />
          <Route
            path="assessments/:activityId"
            element={<ActivityWizardPage kind="assessment" mode="view" />}
          />
          <Route element={<RequireAccess gate={{ type: 'editKind', kind: 'assessment' }} />}>
            <Route
              path="assessments/new"
              element={<ActivityWizardPage kind="assessment" mode="create" />}
            />
            <Route
              path="assessments/:activityId/edit"
              element={<ActivityWizardPage kind="assessment" mode="edit" />}
            />
            <Route
              path="assessments/registrations/new"
              element={<AssignRegistrationPage kind="assessment" />}
            />
            <Route
              path="assessments/registrations/:registrationId/edit"
              element={<RegistrationDetailPage kind="assessment" mode="edit" />}
            />
          </Route>

          <Route path="quizzes" element={<ActivityListPage kind="quiz" />} />
          <Route path="quizzes/registrations" element={<RegistrationsPage kind="quiz" />} />
          <Route
            path="quizzes/registrations/:registrationId"
            element={<RegistrationDetailPage kind="quiz" mode="view" />}
          />
          <Route path="quizzes/reports" element={<QuizReportsPage />} />
          <Route path="quizzes/reports/:resultId" element={<ResultDetailPage kind="quiz" />} />
          <Route
            path="quizzes/:activityId"
            element={<ActivityWizardPage kind="quiz" mode="view" />}
          />
          <Route element={<RequireAccess gate={{ type: 'editKind', kind: 'quiz' }} />}>
            <Route path="quizzes/new" element={<ActivityWizardPage kind="quiz" mode="create" />} />
            <Route
              path="quizzes/:activityId/edit"
              element={<ActivityWizardPage kind="quiz" mode="edit" />}
            />
            <Route
              path="quizzes/registrations/new"
              element={<AssignRegistrationPage kind="quiz" />}
            />
            <Route
              path="quizzes/registrations/:registrationId/edit"
              element={<RegistrationDetailPage kind="quiz" mode="edit" />}
            />
          </Route>

          <Route path="settings" element={<GeneralSettingsPage />} />
          <Route path="settings/participant-portal" element={<ParticipantPortalSettingsPage />} />
          <Route
            path="settings/student-portal"
            element={<Navigate to="/settings/participant-portal" replace />}
          />
          <Route path="settings/design-system" element={<DesignSystemPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Route>
  );
}

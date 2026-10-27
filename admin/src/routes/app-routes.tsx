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
const StudentsPage = lazy(() =>
  import('@/pages/students').then((m) => ({ default: m.StudentsPage })),
);
const SponsorsPage = lazy(() =>
  import('@/pages/sponsors').then((m) => ({ default: m.SponsorsPage })),
);
const ContestsPage = lazy(() =>
  import('@/pages/contests').then((m) => ({ default: m.ContestsPage })),
);
const UsersPage = lazy(() => import('@/pages/users').then((m) => ({ default: m.UsersPage })));
const ActivityListPage = lazy(() =>
  import('@/pages/activity-list').then((m) => ({ default: m.ActivityListPage })),
);
const ActivityWizardPage = lazy(() =>
  import('@/pages/activity-wizard').then((m) => ({ default: m.ActivityWizardPage })),
);
const QuestionBanksPage = lazy(() =>
  import('@/pages/question-banks').then((m) => ({ default: m.QuestionBanksPage })),
);
const BankFormPage = lazy(() =>
  import('@/pages/bank-form').then((m) => ({ default: m.BankFormPage })),
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
const ResultDetailPage = lazy(() =>
  import('@/pages/result-detail').then((m) => ({ default: m.ResultDetailPage })),
);
const QuizLeaderboardPage = lazy(() =>
  import('@/pages/quiz-leaderboard').then((m) => ({ default: m.QuizLeaderboardPage })),
);
const AccessSettingsPage = lazy(() =>
  import('@/pages/settings-access').then((m) => ({ default: m.AccessSettingsPage })),
);
const GeneralSettingsPage = lazy(() =>
  import('@/pages/settings-general').then((m) => ({ default: m.GeneralSettingsPage })),
);
const NotificationSettingsPage = lazy(() =>
  import('@/pages/settings-notifications').then((m) => ({
    default: m.NotificationSettingsPage,
  })),
);
const DesignSystemPage = lazy(() =>
  import('@/pages/design-system').then((m) => ({ default: m.DesignSystemPage })),
);
const SystemSettingsPage = lazy(() =>
  import('@/pages/settings-system').then((m) => ({ default: m.SystemSettingsPage })),
);

function SuspenseOutlet() {
  return (
    <Suspense fallback={<RouteLoadingSkeleton />}>
      <Outlet />
    </Suspense>
  );
}

function LegacyStudentRoute({ edit }: { edit?: boolean }) {
  const { studentId = '' } = useParams();
  const target = edit ? `/students?edit=${studentId}` : `/students?view=${studentId}`;
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
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route element={<RequireAccess gate={{ type: 'mutateOrg' }} />}>
            <Route path="students/new" element={<Navigate to="/students?create=1" replace />} />
            <Route path="students/:studentId/edit" element={<LegacyStudentRoute edit />} />
          </Route>
          <Route path="students/:studentId" element={<LegacyStudentRoute />} />
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
          <Route path="assessments/banks" element={<QuestionBanksPage kind="assessment" />} />
          <Route
            path="assessments/banks/:bankId"
            element={<BankFormPage kind="assessment" mode="view" />}
          />
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
              path="assessments/banks/new"
              element={<BankFormPage kind="assessment" mode="create" />}
            />
            <Route
              path="assessments/banks/:bankId/edit"
              element={<BankFormPage kind="assessment" mode="edit" />}
            />
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
          <Route path="quizzes/banks" element={<QuestionBanksPage kind="quiz" />} />
          <Route path="quizzes/banks/:bankId" element={<BankFormPage kind="quiz" mode="view" />} />
          <Route path="quizzes/registrations" element={<RegistrationsPage kind="quiz" />} />
          <Route
            path="quizzes/registrations/:registrationId"
            element={<RegistrationDetailPage kind="quiz" mode="view" />}
          />
          <Route path="quizzes/reports" element={<ReportsPage kind="quiz" />} />
          <Route path="quizzes/reports/:resultId" element={<ResultDetailPage kind="quiz" />} />
          <Route path="quizzes/leaderboard" element={<QuizLeaderboardPage />} />
          <Route
            path="quizzes/:activityId"
            element={<ActivityWizardPage kind="quiz" mode="view" />}
          />
          <Route element={<RequireAccess gate={{ type: 'editKind', kind: 'quiz' }} />}>
            <Route path="quizzes/banks/new" element={<BankFormPage kind="quiz" mode="create" />} />
            <Route
              path="quizzes/banks/:bankId/edit"
              element={<BankFormPage kind="quiz" mode="edit" />}
            />
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
          <Route element={<RequireAccess gate={{ type: 'manageUsersOrSettings' }} />}>
            <Route path="settings/access" element={<AccessSettingsPage />} />
          </Route>
          <Route path="settings/notifications" element={<NotificationSettingsPage />} />
          <Route path="settings/system" element={<SystemSettingsPage />} />
          <Route path="settings/design-system" element={<DesignSystemPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Route>
  );
}

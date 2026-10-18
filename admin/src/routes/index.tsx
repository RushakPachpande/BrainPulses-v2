import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
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
const StudentFormPage = lazy(() =>
  import('@/pages/student-form').then((m) => ({ default: m.StudentFormPage })),
);
const UsersPage = lazy(() => import('@/pages/users').then((m) => ({ default: m.UsersPage })));
const UserFormPage = lazy(() =>
  import('@/pages/user-form').then((m) => ({ default: m.UserFormPage })),
);
const UserDetailPage = lazy(() =>
  import('@/pages/user-detail').then((m) => ({ default: m.UserDetailPage })),
);
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

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingSkeleton />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route element={<RequireAccess gate={{ type: 'mutateOrg' }} />}>
              <Route path="students/new" element={<StudentFormPage mode="create" />} />
              <Route path="students/:studentId/edit" element={<StudentFormPage mode="edit" />} />
            </Route>
            <Route path="students/:studentId" element={<StudentFormPage mode="view" />} />
            <Route path="users" element={<UsersPage />} />
            <Route element={<RequireAccess gate={{ type: 'manageUsersOrSettings' }} />}>
              <Route path="users/new" element={<UserFormPage />} />
              <Route path="users/:userId/edit" element={<UserDetailPage mode="edit" />} />
            </Route>
            <Route path="users/:userId" element={<UserDetailPage mode="view" />} />

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
            <Route
              path="quizzes/banks/:bankId"
              element={<BankFormPage kind="quiz" mode="view" />}
            />
            <Route path="quizzes/registrations" element={<RegistrationsPage kind="quiz" />} />
            <Route
              path="quizzes/registrations/:registrationId"
              element={<RegistrationDetailPage kind="quiz" mode="view" />}
            />
            <Route path="quizzes/reports" element={<ReportsPage kind="quiz" />} />
            <Route path="quizzes/reports/:resultId" element={<ResultDetailPage kind="quiz" />} />
            <Route
              path="quizzes/:activityId"
              element={<ActivityWizardPage kind="quiz" mode="view" />}
            />
            <Route element={<RequireAccess gate={{ type: 'editKind', kind: 'quiz' }} />}>
              <Route
                path="quizzes/banks/new"
                element={<BankFormPage kind="quiz" mode="create" />}
              />
              <Route
                path="quizzes/banks/:bankId/edit"
                element={<BankFormPage kind="quiz" mode="edit" />}
              />
              <Route
                path="quizzes/new"
                element={<ActivityWizardPage kind="quiz" mode="create" />}
              />
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
      </Routes>
    </Suspense>
  );
}

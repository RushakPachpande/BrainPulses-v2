import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
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
const UsersPage = lazy(() => import('@/pages/users').then((m) => ({ default: m.UsersPage })));
const ActivityListPage = lazy(() =>
  import('@/pages/activity-list').then((m) => ({ default: m.ActivityListPage })),
);
const CreateActivityPage = lazy(() =>
  import('@/pages/create-activity').then((m) => ({ default: m.CreateActivityPage })),
);
const QuestionBanksPage = lazy(() =>
  import('@/pages/question-banks').then((m) => ({ default: m.QuestionBanksPage })),
);
const RegistrationsPage = lazy(() =>
  import('@/pages/registrations').then((m) => ({ default: m.RegistrationsPage })),
);
const ReportsPage = lazy(() =>
  import('@/pages/reports').then((m) => ({ default: m.ReportsPage })),
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
const SystemSettingsPage = lazy(() =>
  import('@/pages/settings-system').then((m) => ({ default: m.SystemSettingsPage })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="assessments" element={<ActivityListPage kind="assessment" />} />
            <Route path="assessments/banks" element={<QuestionBanksPage kind="assessment" />} />
            <Route path="assessments/new" element={<CreateActivityPage kind="assessment" />} />
            <Route
              path="assessments/registrations"
              element={<RegistrationsPage kind="assessment" />}
            />
            <Route path="assessments/reports" element={<ReportsPage kind="assessment" />} />
            <Route path="quizzes" element={<ActivityListPage kind="quiz" />} />
            <Route path="quizzes/banks" element={<QuestionBanksPage kind="quiz" />} />
            <Route path="quizzes/new" element={<CreateActivityPage kind="quiz" />} />
            <Route path="quizzes/registrations" element={<RegistrationsPage kind="quiz" />} />
            <Route path="quizzes/reports" element={<ReportsPage kind="quiz" />} />
            <Route path="settings" element={<GeneralSettingsPage />} />
            <Route path="settings/access" element={<AccessSettingsPage />} />
            <Route path="settings/notifications" element={<NotificationSettingsPage />} />
            <Route path="settings/system" element={<SystemSettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

import { Navigate, Route, Routes } from 'react-router';
import { AdminLayout } from '@/layouts/admin-layout';
import { ActivityListPage } from '@/pages/activity-list';
import { CreateActivityPage } from '@/pages/create-activity';
import { DashboardPage } from '@/pages/dashboard';
import { QuestionBanksPage } from '@/pages/question-banks';
import { RegistrationsPage } from '@/pages/registrations';
import { ReportsPage } from '@/pages/reports';
import { AccessSettingsPage } from '@/pages/settings-access';
import { GeneralSettingsPage } from '@/pages/settings-general';
import { NotificationSettingsPage } from '@/pages/settings-notifications';
import { SystemSettingsPage } from '@/pages/settings-system';
import { StudentsPage } from '@/pages/students';
import { UsersPage } from '@/pages/users';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="assessments" element={<ActivityListPage kind="assessment" />} />
        <Route path="assessments/banks" element={<QuestionBanksPage kind="assessment" />} />
        <Route path="assessments/new" element={<CreateActivityPage kind="assessment" />} />
        <Route path="assessments/registrations" element={<RegistrationsPage kind="assessment" />} />
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
    </Routes>
  );
}

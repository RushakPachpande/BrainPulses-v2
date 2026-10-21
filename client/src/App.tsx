import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { AuthProvider } from './contexts/auth';
import { RequireAuth } from './contexts/require-auth';
import { StudentShell } from './layouts/student-shell';
import { ActivityDetailPage } from './pages/activity-detail';
import { AttemptPage } from './pages/attempt';
import { DashboardPage } from './pages/dashboard';
import { HelpPage } from './pages/help';
import { LeaderboardPage } from './pages/leaderboard';
import { LibraryPage } from './pages/library';
import { LoginPage } from './pages/login';
import { ProfilePage } from './pages/profile';
import { ResultDetailPage, ResultsPage } from './pages/results';

function titleForPath(pathname: string) {
  if (pathname.includes('/leaderboard')) return 'Leaderboard';
  if (pathname.startsWith('/quizzes/')) return 'Quiz details';
  if (pathname.startsWith('/quizzes')) return 'My quizzes';
  if (pathname.startsWith('/assessments/')) return 'Assessment details';
  if (pathname.startsWith('/assessments')) return 'Assessments';
  if (pathname.startsWith('/results')) return 'My results';
  if (pathname.startsWith('/profile')) return 'My profile';
  if (pathname.startsWith('/help')) return 'Help centre';
  return 'Overview';
}

function ShellLayout() {
  const location = useLocation();
  return (
    <StudentShell title={titleForPath(location.pathname)}>
      <Outlet />
    </StudentShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/attempt/start/:id" element={<AttemptPage mode="start" />} />
            <Route path="/attempt/:id" element={<AttemptPage mode="resume" />} />
            <Route element={<ShellLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/quizzes" element={<LibraryPage kind="quiz" />} />
              <Route path="/quizzes/:activityId/leaderboard" element={<LeaderboardPage />} />
              <Route path="/quizzes/:activityId" element={<ActivityDetailPage kind="quiz" />} />
              <Route path="/assessments" element={<LibraryPage kind="assessment" />} />
              <Route
                path="/assessments/:activityId"
                element={<ActivityDetailPage kind="assessment" />}
              />
              <Route path="/results" element={<ResultsPage />} />
              <Route path="/results/:id" element={<ResultDetailPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Outlet,
  Route,
  RouterProvider,
} from 'react-router';
import { ApiLoadingProvider } from './contexts/api-loading';
import { AuthProvider } from './contexts/auth';
import { ClientQueryProvider } from './contexts/query-provider';
import { RequireAuth } from './contexts/require-auth';
import { StudentPageGuard, EnabledHome } from './layouts/student-page-guard';
import { LoginPage } from './pages/login';

const ActivityDetailPage = lazy(() =>
  import('./pages/activity-detail').then((m) => ({ default: m.ActivityDetailPage })),
);
const AttemptPage = lazy(() => import('./pages/attempt').then((m) => ({ default: m.AttemptPage })));
const DashboardPage = lazy(() =>
  import('./pages/dashboard').then((m) => ({ default: m.DashboardPage })),
);
const HelpPage = lazy(() => import('./pages/help').then((m) => ({ default: m.HelpPage })));
const LibraryPage = lazy(() => import('./pages/library').then((m) => ({ default: m.LibraryPage })));
const ProfilePage = lazy(() => import('./pages/profile').then((m) => ({ default: m.ProfilePage })));
const ResultsPage = lazy(() => import('./pages/results').then((m) => ({ default: m.ResultsPage })));
const ResultDetailPage = lazy(() =>
  import('./pages/results').then((m) => ({ default: m.ResultDetailPage })),
);

function ShellLayout() {
  return (
    <StudentPageGuard>
      <Outlet />
    </StudentPageGuard>
  );
}

function LazyOutlet() {
  return (
    <Suspense fallback={<p className="sr-only">Loading page</p>}>
      <Outlet />
    </Suspense>
  );
}

const appRouter = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<LazyOutlet />}>
          <Route path="/attempt/start/:id" element={<AttemptPage mode="start" />} />
          <Route path="/attempt/:id" element={<AttemptPage mode="resume" />} />
          <Route element={<ShellLayout />}>
            <Route index element={<EnabledHome />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/quizzes" element={<LibraryPage kind="quiz" />} />
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
            <Route path="*" element={<EnabledHome />} />
          </Route>
        </Route>
      </Route>
    </Route>,
  ),
);

export default function App() {
  return (
    <ApiLoadingProvider>
      <AuthProvider>
        <ClientQueryProvider>
          <RouterProvider router={appRouter} />
        </ClientQueryProvider>
      </AuthProvider>
    </ApiLoadingProvider>
  );
}

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
import { PageLoader } from './components/loading-overlay';
import { ParticipantPageGuard, EnabledHome } from './layouts/participant-page-guard';
import { LoginPage } from './pages/login';
import { RegisterPage } from './pages/register';

const ActivityDetailPage = lazy(() =>
  import('./pages/activity-detail').then((m) => ({ default: m.ActivityDetailPage })),
);
const AttemptPage = lazy(() => import('./pages/attempt').then((m) => ({ default: m.AttemptPage })));
const LibraryPage = lazy(() => import('./pages/library').then((m) => ({ default: m.LibraryPage })));
const ResultDetailPage = lazy(() =>
  import('./pages/results').then((m) => ({ default: m.ResultDetailPage })),
);

function PlainLayout() {
  return (
    <ParticipantPageGuard shell={false}>
      <Outlet />
    </ParticipantPageGuard>
  );
}

function ShellLayout() {
  return (
    <ParticipantPageGuard>
      <Outlet />
    </ParticipantPageGuard>
  );
}

function LazyOutlet() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  );
}

const appRouter = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register/:slug" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<LazyOutlet />}>
          <Route path="/attempt/start/:id" element={<AttemptPage mode="start" />} />
          <Route path="/attempt/:id" element={<AttemptPage mode="resume" />} />
          <Route element={<PlainLayout />}>
            <Route path="/quizzes/:activityId" element={<ActivityDetailPage kind="quiz" />} />
            <Route
              path="/assessments/:activityId"
              element={<ActivityDetailPage kind="assessment" />}
            />
            <Route path="/results" element={<EnabledHome />} />
            <Route path="/results/:id" element={<ResultDetailPage />} />
          </Route>
          <Route element={<ShellLayout />}>
            <Route index element={<EnabledHome />} />
            <Route path="/dashboard" element={<LibraryPage kind="quiz" />} />
            <Route path="/quizzes" element={<LibraryPage kind="quiz" />} />
            <Route path="/assessments" element={<LibraryPage kind="assessment" />} />
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

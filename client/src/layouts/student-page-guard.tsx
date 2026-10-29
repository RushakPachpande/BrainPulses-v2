import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useStudentPages } from '../hooks/use-student-pages';
import {
  DEFAULT_STUDENT_PAGES,
  firstEnabledStudentPath,
  studentPageForPath,
} from '../lib/student-pages';
import { StudentShell } from './student-shell';

function titleForPath(pathname: string) {
  if (pathname.startsWith('/quizzes/')) return 'Quiz details';
  if (pathname.startsWith('/quizzes')) return 'My quizzes';
  if (pathname.startsWith('/assessments/')) return 'Assessment details';
  if (pathname.startsWith('/assessments')) return 'Assessments';
  if (pathname.startsWith('/results')) return 'My results';
  if (pathname.startsWith('/profile')) return 'My profile';
  if (pathname.startsWith('/help')) return 'Help centre';
  return 'Overview';
}

function PagesUnavailable() {
  return (
    <div className="empty-state" role="status">
      <b>No student pages are available right now</b>
      <span>An administrator can turn pages back on from settings.</span>
    </div>
  );
}

export function StudentPageGuard({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const pagesQuery = useStudentPages();
  const pages = pagesQuery.data ?? (pagesQuery.isError ? DEFAULT_STUDENT_PAGES : null);
  const title = titleForPath(location.pathname);

  if (!pages) {
    return (
      <StudentShell title={title} pages={null}>
        <p className="sr-only">Loading page</p>
      </StudentShell>
    );
  }

  const dest = firstEnabledStudentPath(pages);
  if (!dest) {
    return (
      <StudentShell title="Student portal" pages={pages}>
        <PagesUnavailable />
      </StudentShell>
    );
  }

  const page = studentPageForPath(location.pathname);
  if (page && !pages[page]) {
    return <Navigate to={dest} replace />;
  }

  return (
    <StudentShell title={title} pages={pages}>
      {children}
    </StudentShell>
  );
}

export function EnabledHome() {
  const pagesQuery = useStudentPages();
  const pages = pagesQuery.data ?? (pagesQuery.isError ? DEFAULT_STUDENT_PAGES : null);
  if (!pages) return <p className="sr-only">Loading page</p>;
  const dest = firstEnabledStudentPath(pages);
  if (!dest) return <PagesUnavailable />;
  return <Navigate to={dest} replace />;
}

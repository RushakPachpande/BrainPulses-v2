export type StudentPageKey =
  'overview' | 'quizzes' | 'assessments' | 'results' | 'profile' | 'help';

export type StudentPages = Record<StudentPageKey, boolean>;

export const DEFAULT_STUDENT_PAGES: StudentPages = {
  overview: true,
  quizzes: true,
  assessments: true,
  results: true,
  profile: true,
  help: true,
};

/** Matches the API forbidden message for a disabled student page. */
export const STUDENT_PAGE_OFF_MESSAGE = 'This student page is turned off.';

const PAGE_ORDER: { key: StudentPageKey; path: string }[] = [
  { key: 'overview', path: '/dashboard' },
  { key: 'quizzes', path: '/quizzes' },
  { key: 'assessments', path: '/assessments' },
  { key: 'results', path: '/results' },
  { key: 'profile', path: '/profile' },
  { key: 'help', path: '/help' },
];

export function studentPageForPath(pathname: string): StudentPageKey | null {
  if (pathname.startsWith('/dashboard')) return 'overview';
  if (pathname.startsWith('/quizzes')) return 'quizzes';
  if (pathname.startsWith('/assessments')) return 'assessments';
  if (pathname.startsWith('/results')) return 'results';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/help')) return 'help';
  return null;
}

export function firstEnabledStudentPath(pages: StudentPages): string | null {
  return PAGE_ORDER.find((item) => pages[item.key])?.path ?? null;
}

export function isStudentPageOffError(error: string) {
  return error.includes(STUDENT_PAGE_OFF_MESSAGE);
}

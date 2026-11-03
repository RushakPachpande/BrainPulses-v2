export type ParticipantPageKey =
  'overview' | 'quizzes' | 'assessments' | 'results' | 'profile' | 'help';

export type ParticipantPages = Record<ParticipantPageKey, boolean>;

export const DEFAULT_PARTICIPANT_PAGES: ParticipantPages = {
  overview: true,
  quizzes: true,
  assessments: true,
  results: true,
  profile: true,
  help: true,
};

/** Matches the API forbidden message for a disabled participant page. */
export const PARTICIPANT_PAGE_OFF_MESSAGE = 'This participant page is turned off.';

const PAGE_ORDER: { key: ParticipantPageKey; path: string }[] = [
  { key: 'overview', path: '/dashboard' },
  { key: 'quizzes', path: '/quizzes' },
  { key: 'assessments', path: '/assessments' },
];

export function participantPageForPath(pathname: string): ParticipantPageKey | null {
  if (pathname.startsWith('/dashboard')) return 'overview';
  if (pathname.startsWith('/quizzes')) return 'quizzes';
  if (pathname.startsWith('/assessments')) return 'assessments';
  if (pathname.startsWith('/results')) return 'results';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/help')) return 'help';
  return null;
}

export function firstEnabledParticipantPath(pages: ParticipantPages): string | null {
  return PAGE_ORDER.find((item) => pages[item.key])?.path ?? null;
}

export function isParticipantPageOffError(error: string) {
  return error.includes(PARTICIPANT_PAGE_OFF_MESSAGE);
}

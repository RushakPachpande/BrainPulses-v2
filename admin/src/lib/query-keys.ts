/** Lists are always treated as stale so mounts/focus refetch from the API. */
export const STALE_MS = 0;
/** Keep unused query results in memory briefly for back-navigation. */
export const GC_MS = 5 * 60_000;

export const adminQueryKeys = {
  all: ['admin'] as const,
  dashboard: (orgId: string) => ['admin', 'dashboard', orgId] as const,
  participants: (orgId: string) => ['admin', 'participants', orgId] as const,
  sponsors: (orgId: string) => ['admin', 'sponsors', orgId] as const,
  contests: (orgId: string) => ['admin', 'contests', orgId] as const,
  users: (orgId: string) => ['admin', 'users', orgId] as const,
  activities: (orgId: string, kind: string) => ['admin', 'activities', orgId, kind] as const,
  banks: (orgId: string, kind: string) => ['admin', 'banks', orgId, kind] as const,
  registrations: (orgId: string, kind: string) => ['admin', 'registrations', orgId, kind] as const,
  results: (orgId: string, kind: string) => ['admin', 'results', orgId, kind] as const,
  quizReports: (orgId: string, query: string) => ['admin', 'quiz-reports', orgId, query] as const,
  quizReportDetail: (orgId: string, registrationId: string, attemptId: string) =>
    ['admin', 'quiz-report-detail', orgId, registrationId, attemptId] as const,
  assessmentReports: (orgId: string, query: string) =>
    ['admin', 'assessment-reports', orgId, query] as const,
  assessmentReportDetail: (
    orgId: string,
    registrationId: string,
    roundId: string,
    attemptId: string,
  ) => ['admin', 'assessment-report-detail', orgId, registrationId, roundId, attemptId] as const,
  resultsSummary: (orgId: string, kind: string) =>
    ['admin', 'results-summary', orgId, kind] as const,
  imageLibrary: (orgId: string, purpose: string, q: string) =>
    ['admin', 'image-library', orgId, purpose, q] as const,
};

/** Legacy sessionStorage key prefix from PersistQueryClient (no longer written). */
export const ADMIN_PERSIST_PREFIX = 'bp-aq:';

export function adminPersistKey(orgId: string) {
  return `${ADMIN_PERSIST_PREFIX}${orgId}`;
}

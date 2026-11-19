/** In-memory freshness window — API remains source of truth; invalidate after mutations. */
export const STALE_MS = 30_000;
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
  activityDetail: (orgId: string, id: string) =>
    ['admin', 'activities', orgId, 'detail', id] as const,
  bank: (orgId: string, id: string) => ['admin', 'banks', orgId, id] as const,
  resultDetail: (orgId: string, id: string) => ['admin', 'results', orgId, 'detail', id] as const,
  registrationDetail: (orgId: string, kind: string, id: string) =>
    ['admin', 'registrations', orgId, kind, id] as const,
  settings: (orgId: string) => ['admin', 'settings', orgId, 'general'] as const,
  user: (orgId: string, id: string) => ['admin', 'users', orgId, id] as const,
  participant: (orgId: string, id: string) => ['admin', 'participants', orgId, id] as const,
  sponsor: (orgId: string, id: string) => ['admin', 'sponsors', orgId, id] as const,
  contest: (orgId: string, id: string) => ['admin', 'contests', orgId, id] as const,
};

/** Legacy sessionStorage key prefix from PersistQueryClient (no longer written). */
export const ADMIN_PERSIST_PREFIX = 'bp-aq:';

export function adminPersistKey(orgId: string) {
  return `${ADMIN_PERSIST_PREFIX}${orgId}`;
}

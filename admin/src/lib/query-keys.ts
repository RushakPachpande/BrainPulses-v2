export const STALE_MS = 5 * 60_000;
export const GC_MS = 30 * 60_000;

export const adminQueryKeys = {
  all: ['admin'] as const,
  dashboard: (orgId: string) => ['admin', 'dashboard', orgId] as const,
  students: (orgId: string) => ['admin', 'students', orgId] as const,
  users: (orgId: string) => ['admin', 'users', orgId] as const,
  activities: (orgId: string, kind: string) => ['admin', 'activities', orgId, kind] as const,
  banks: (orgId: string, kind: string) => ['admin', 'banks', orgId, kind] as const,
  registrations: (orgId: string, kind: string) => ['admin', 'registrations', orgId, kind] as const,
  results: (orgId: string, kind: string) => ['admin', 'results', orgId, kind] as const,
  resultsSummary: (orgId: string, kind: string) =>
    ['admin', 'results-summary', orgId, kind] as const,
};

export function adminPersistKey(orgId: string) {
  return `bp-aq:${orgId}`;
}

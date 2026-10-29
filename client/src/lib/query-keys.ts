/** Lists are always treated as stale so mounts/focus refetch from the API. */
export const STALE_MS = 0;
/** Keep unused query results in memory briefly for back-navigation. */
export const GC_MS = 5 * 60_000;

export const clientQueryKeys = {
  all: ['client'] as const,
  activities: (studentId: string, kind: string) =>
    ['client', 'activities', studentId, kind] as const,
  results: (studentId: string, kind: string) => ['client', 'results', studentId, kind] as const,
  dashboard: (studentId: string) => ['client', 'dashboard', studentId] as const,
  pages: (studentId: string) => ['client', 'pages', studentId] as const,
};

/** Legacy sessionStorage key prefix from PersistQueryClient (no longer written). */
export const CLIENT_PERSIST_PREFIX = 'bp-cq:';

export function clientPersistKey(studentId: string) {
  return `${CLIENT_PERSIST_PREFIX}${studentId}`;
}

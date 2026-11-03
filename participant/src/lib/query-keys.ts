/** Lists are always treated as stale so mounts/focus refetch from the API. */
export const STALE_MS = 0;
/** Keep unused query results in memory briefly for back-navigation. */
export const GC_MS = 5 * 60_000;

export const clientQueryKeys = {
  all: ['client'] as const,
  activities: (participantId: string, kind: string) =>
    ['client', 'activities', participantId, kind] as const,
  results: (participantId: string, kind: string) =>
    ['client', 'results', participantId, kind] as const,
  dashboard: (participantId: string) => ['client', 'dashboard', participantId] as const,
  pages: (participantId: string) => ['client', 'pages', participantId] as const,
};

/** Legacy sessionStorage key prefix from PersistQueryClient (no longer written). */
export const CLIENT_PERSIST_PREFIX = 'bp-cq:';

export function clientPersistKey(participantId: string) {
  return `${CLIENT_PERSIST_PREFIX}${participantId}`;
}

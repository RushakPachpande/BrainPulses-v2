export const STALE_MS = 5 * 60_000;
export const GC_MS = 30 * 60_000;

export const clientQueryKeys = {
  all: ['client'] as const,
  activities: (studentId: string, kind: string) =>
    ['client', 'activities', studentId, kind] as const,
  results: (studentId: string, kind: string) => ['client', 'results', studentId, kind] as const,
  dashboard: (studentId: string) => ['client', 'dashboard', studentId] as const,
};

export function clientPersistKey(studentId: string) {
  return `bp-cq:${studentId}`;
}

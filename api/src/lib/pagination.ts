import { z } from 'zod';

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().uuid().optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export type PageMeta = {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
};

export function listEnvelope<T>(data: T[], page: PageMeta) {
  return { data, page };
}

export function buildPage<T extends { id: string }>(
  rows: T[],
  limit: number,
  total: number,
): { items: T[]; page: PageMeta } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;
  return {
    items,
    page: { limit, nextCursor, hasMore, total },
  };
}

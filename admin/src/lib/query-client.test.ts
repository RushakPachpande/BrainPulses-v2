import { describe, expect, it } from 'vitest';
import { createAdminQueryClient } from '@/lib/query-client';
import { STALE_MS } from '@/lib/query-keys';

describe('admin page read cache', () => {
  it('treats a read as fresh for 30 seconds', async () => {
    expect(STALE_MS).toBe(30_000);
    const client = createAdminQueryClient();
    const defaults = client.getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(30_000);
    expect(defaults?.refetchOnMount).toBe(true);
    expect(defaults?.refetchOnWindowFocus).toBe(false);

    let calls = 0;
    const queryFn = async () => {
      calls += 1;
      return ['row'];
    };
    const queryKey = ['admin', 'users', 'org'] as const;
    await client.fetchQuery({ queryKey, queryFn });
    await client.fetchQuery({ queryKey, queryFn });
    expect(calls).toBe(1);

    await client.invalidateQueries({ queryKey: ['admin', 'users'] });
    await client.fetchQuery({ queryKey, queryFn });
    expect(calls).toBe(2);
  });
});

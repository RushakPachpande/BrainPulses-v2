import { describe, expect, it } from 'vitest';
import { createClientQueryClient } from './query-client';
import { STALE_MS } from './query-keys';

describe('participant page read cache', () => {
  it('treats a read as fresh for 30 seconds', async () => {
    expect(STALE_MS).toBe(30_000);
    const client = createClientQueryClient();
    const defaults = client.getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(30_000);
    expect(defaults?.refetchOnMount).toBe(true);
    expect(defaults?.refetchOnWindowFocus).toBe(false);

    let calls = 0;
    const queryFn = async () => {
      calls += 1;
      return ['row'];
    };
    const queryKey = ['client', 'activities', 'person', 'quiz'] as const;
    await client.fetchQuery({ queryKey, queryFn });
    await client.fetchQuery({ queryKey, queryFn });
    expect(calls).toBe(1);

    await client.invalidateQueries({ queryKey: ['client', 'activities'] });
    await client.fetchQuery({ queryKey, queryFn });
    expect(calls).toBe(2);
  });
});

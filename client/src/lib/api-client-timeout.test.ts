import { describe, expect, it } from 'vitest';
import { REQUEST_TIMEOUT_MS } from './api-client';

describe('client api timeout policy', () => {
  it('exposes a 30 second request timeout', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(30_000);
  });
});

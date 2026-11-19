import { describe, expect, it } from 'vitest';
import { isQueuedAck, JOB_POLL_INTERVAL_MS, JOB_POLL_MAX_ATTEMPTS } from '@/lib/jobs';

describe('isQueuedAck', () => {
  it('recognizes a queue acknowledgement', () => {
    expect(isQueuedAck({ jobId: 'abc', status: 'queued' })).toBe(true);
  });

  it('rejects import result payloads', () => {
    expect(isQueuedAck({ created: 2, issues: [] })).toBe(false);
  });

  it('rejects nullish values', () => {
    expect(isQueuedAck(null)).toBe(false);
    expect(isQueuedAck(undefined)).toBe(false);
  });

  it('polls long enough for the worker lock', () => {
    expect(JOB_POLL_INTERVAL_MS * JOB_POLL_MAX_ATTEMPTS).toBeGreaterThanOrEqual(135_000);
  });
});

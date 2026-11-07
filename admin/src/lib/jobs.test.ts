import { describe, expect, it } from 'vitest';
import { isQueuedAck } from '@/lib/jobs';

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
});

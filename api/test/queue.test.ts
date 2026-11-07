import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { describe, test } from 'node:test';
import { env } from '../src/config/env.js';
import { enqueueJob, getJobSnapshot, useInlineQueue } from '../src/lib/queue/queues.js';
import { writeImportTempFile } from '../src/lib/queue/processors.js';

describe('queue system', () => {
  test('test environment uses inline queue processing', () => {
    assert.equal(useInlineQueue(), true);
  });

  test('inline SMS job completes and is queryable by job id', async () => {
    const enqueued = await enqueueJob('sms.otp', {
      type: 'sms.otp',
      phone: '+15555550100',
      otp: '123456',
    });
    assert.equal(enqueued.status, 'completed');
    assert.ok(enqueued.jobId);
    const snap = await getJobSnapshot(enqueued.jobId);
    assert.equal(snap.status, 'completed');
    assert.equal(snap.result?.kind, 'sms');
  });

  test('writeImportTempFile stages under uploads/temporary/jobs', async () => {
    const tempPath = await writeImportTempFile('unit-test', 'sample.xlsx', Buffer.from('PK'));
    assert.match(tempPath, /temporary[\\/]+jobs/);
    await unlink(tempPath);
  });

  test('temporary jobs directory is creatable', async () => {
    const dir = path.resolve(env.UPLOAD_DIR, 'temporary', 'jobs');
    await mkdir(dir, { recursive: true });
    const marker = path.join(dir, `queue-test-${Date.now()}.txt`);
    await writeFile(marker, 'ok');
    await unlink(marker);
  });
});

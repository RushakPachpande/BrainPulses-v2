import { bankQuestionImportEnqueueOptions } from '../src/modules/banks/import-job.js';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

describe('bank question import job', () => {
  test('queues the import and keeps an idempotency key', () => {
    const withKey = bankQuestionImportEnqueueOptions('bank-1', 'idem-1');
    assert.equal(withKey.jobId, 'bank-import:bank-1:idem-1');
    assert.equal('forceInline' in withKey, false);

    const withoutKey = bankQuestionImportEnqueueOptions('bank-1', undefined);
    assert.equal(withoutKey.jobId, undefined);
    assert.equal('forceInline' in withoutKey, false);
  });
});

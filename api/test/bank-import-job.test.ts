import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { bankQuestionImportEnqueueOptions } from '../src/modules/banks/import-job.js';

describe('bank question import job', () => {
  test('finishes in the API process so Import does not wait on a worker', () => {
    const withKey = bankQuestionImportEnqueueOptions('bank-1', 'idem-1');
    assert.equal(withKey.forceInline, true);
    assert.equal(withKey.jobId, 'bank-import:bank-1:idem-1');

    const withoutKey = bankQuestionImportEnqueueOptions('bank-1', undefined);
    assert.equal(withoutKey.forceInline, true);
    assert.equal(withoutKey.jobId, undefined);
  });
});

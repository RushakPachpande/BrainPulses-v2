import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getTestApp, request } from './helpers.js';

describe('file download token', () => {
  it('rejects an unknown download token', async () => {
    const app = await getTestApp();
    const res = await request(app, 'GET', '/api/files/download?token=not-a-real-token');
    assert.equal(res.status, 403);
    const body = res.body as { error: { code: string; stack?: string } };
    assert.equal(body.error.code, 'FORBIDDEN');
    assert.equal(body.error.stack, undefined);
  });
});

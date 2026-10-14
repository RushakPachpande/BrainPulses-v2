import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { closeRedis } from '../src/lib/redis.js';
import { disconnectPrisma } from '../src/lib/prisma.js';
import { cookieHeader, getTestApp, request } from './helpers.js';

describe('auth', () => {
  after(async () => {
    await closeRedis();
    await disconnectPrisma();
  });

  it('rejects wrong password', async () => {
    const app = await getTestApp();
    const res = await request(app, 'POST', '/api/auth/sign-in', {
      body: { email: 'admin@brainpulses.com', password: 'wrong' },
    });
    assert.equal(res.status, 401);
    const body = res.body as { error: { code: string } };
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  it('signs in with multiple orgs and selects one', async () => {
    const app = await getTestApp();
    const res = await request(app, 'POST', '/api/auth/sign-in', {
      body: { email: 'admin@brainpulses.com', password: 'Password123!' },
    });
    assert.equal(res.status, 200);
    const body = res.body as {
      data: {
        status: string;
        selectionToken?: string;
        organizations?: { id: string }[];
        session?: { accessToken: string };
      };
    };

    if (body.data.status === 'select_organization') {
      assert.ok(body.data.selectionToken);
      assert.ok(body.data.organizations && body.data.organizations.length >= 2);
      const selected = await request(app, 'POST', '/api/auth/select-organization', {
        body: {
          selectionToken: body.data.selectionToken,
          organizationId: body.data.organizations[0]!.id,
        },
      });
      assert.equal(selected.status, 200);
      const session = (selected.body as { data: { session: { accessToken: string } } }).data
        .session;
      assert.ok(session.accessToken);
    } else {
      assert.equal(body.data.status, 'authenticated');
      assert.ok(body.data.session?.accessToken);
    }
  });

  it('revokes refresh family on reuse', async () => {
    const app = await getTestApp();
    const signIn = await request(app, 'POST', '/api/auth/sign-in', {
      body: { email: 'viewer@brainpulses.com', password: 'Password123!' },
    });
    assert.equal(signIn.status, 200);
    const cookies = cookieHeader(signIn.setCookie);
    assert.ok(cookies.includes('bp_refresh='));

    const refresh1 = await request(app, 'POST', '/api/auth/refresh', { cookies });
    assert.equal(refresh1.status, 200);
    const cookies2 = cookieHeader(refresh1.setCookie);

    const reuse = await request(app, 'POST', '/api/auth/refresh', { cookies });
    assert.equal(reuse.status, 401);

    const refresh2 = await request(app, 'POST', '/api/auth/refresh', { cookies: cookies2 });
    assert.equal(refresh2.status, 401);
  });
});

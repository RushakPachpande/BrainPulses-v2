import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cookieHeader, getTestApp, request } from './helpers.js';

describe('auth', () => {
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

  it('returns 204 when refresh cookie is absent', async () => {
    const app = await getTestApp();
    const res = await request(app, 'POST', '/api/auth/refresh');
    assert.equal(res.status, 204);
  });

  it('signs in student by Unique ID', async () => {
    const app = await getTestApp();
    const res = await request(app, 'POST', '/api/auth/student/sign-in-by-code', {
      body: { code: 'BP-24101', organizationSlug: 'demo' },
    });
    assert.equal(res.status, 200);
    const body = res.body as {
      data: { accessToken: string; student: { code: string } };
    };
    assert.ok(body.data.accessToken);
    assert.equal(body.data.student.code, 'BP-24101');
  });

  it('rejects unknown Unique ID', async () => {
    const app = await getTestApp();
    const res = await request(app, 'POST', '/api/auth/student/sign-in-by-code', {
      body: { code: 'BP-NOPE', organizationSlug: 'demo' },
    });
    assert.equal(res.status, 401);
  });

  it('rejects invalid Unique ID format on sign-in-by-code', async () => {
    const app = await getTestApp();
    const res = await request(app, 'POST', '/api/auth/student/sign-in-by-code', {
      body: { code: 'BP', organizationSlug: 'demo' },
    });
    assert.equal(res.status, 422);
    const body = res.body as { error: { code: string } };
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('rejects invalid phone on request-otp', async () => {
    const app = await getTestApp();
    const res = await request(app, 'POST', '/api/auth/student/request-otp', {
      body: {
        countryCode: '+91',
        mobileNumber: '5876510000',
        organizationSlug: 'demo',
      },
    });
    assert.equal(res.status, 422);
    const body = res.body as { error: { code: string } };
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('rejects unknown country dial on request-otp', async () => {
    const app = await getTestApp();
    const res = await request(app, 'POST', '/api/auth/student/request-otp', {
      body: {
        countryCode: '+999',
        mobileNumber: '9876510000',
        organizationSlug: 'demo',
      },
    });
    assert.equal(res.status, 422);
  });

  it('requests and verifies student phone OTP', async () => {
    const app = await getTestApp();
    const phoneBody = {
      countryCode: '+91',
      mobileNumber: '9876510000',
      organizationSlug: 'demo',
    };
    const requestRes = await request(app, 'POST', '/api/auth/student/request-otp', {
      body: phoneBody,
    });
    assert.equal(requestRes.status, 200);
    const requested = requestRes.body as { data: { ok: boolean; debugOtp?: string } };
    assert.equal(requested.data.ok, true);
    assert.ok(requested.data.debugOtp);

    const verifyRes = await request(app, 'POST', '/api/auth/student/verify-otp', {
      body: { ...phoneBody, otp: requested.data.debugOtp },
    });
    assert.equal(verifyRes.status, 200);
    const verified = verifyRes.body as {
      data: { accessToken: string; student: { code: string } };
    };
    assert.ok(verified.data.accessToken);
    assert.equal(verified.data.student.code, 'BP-24101');

    const bad = await request(app, 'POST', '/api/auth/student/verify-otp', {
      body: { ...phoneBody, otp: '999999' },
    });
    assert.equal(bad.status, 401);
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

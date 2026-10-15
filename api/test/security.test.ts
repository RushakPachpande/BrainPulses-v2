import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { getTestApp, request } from './helpers.js';

async function accessTokenFor(email: string, orgSlug: string) {
  const app = await getTestApp();
  const signIn = await request(app, 'POST', '/api/auth/sign-in', {
    body: { email, password: 'Password123!' },
  });
  const data = (signIn.body as { data: Record<string, unknown> }).data;

  if (data.status === 'authenticated') {
    return (data.session as { accessToken: string }).accessToken;
  }

  const orgs = data.organizations as { id: string; slug: string }[];
  const org = orgs.find((o) => o.slug === orgSlug) ?? orgs[0]!;
  const selected = await request(app, 'POST', '/api/auth/select-organization', {
    body: { selectionToken: data.selectionToken, organizationId: org.id },
  });
  return (selected.body as { data: { session: { accessToken: string } } }).data.session.accessToken;
}

describe('security hardening', () => {
  it('blocks view-only from bank create, student create, and settings patch', async () => {
    const app = await getTestApp();
    const token = await accessTokenFor('viewer@brainpulses.com', 'demo');
    const headers = { authorization: `Bearer ${token}` };

    const bank = await request(app, 'POST', '/api/banks', {
      headers,
      body: { kind: 'assessment', name: 'Nope' },
    });
    assert.equal(bank.status, 403);

    const student = await request(app, 'POST', '/api/students', {
      headers,
      body: { name: 'Nope', email: 'nope@example.com' },
    });
    assert.equal(student.status, 403);

    const settings = await request(app, 'PATCH', '/api/settings/general', {
      headers,
      body: { values: { orgName: 'Hacked' } },
    });
    assert.equal(settings.status, 403);
  });

  it('rejects unknown body fields (strict Zod)', async () => {
    const app = await getTestApp();
    const token = await accessTokenFor('admin@brainpulses.com', 'demo');
    const res = await request(app, 'POST', '/api/students', {
      headers: { authorization: `Bearer ${token}` },
      body: { name: 'Strict', email: 'strict-test@example.com', role: 'super_admin' },
    });
    assert.equal(res.status, 422);
  });

  it('rejects JWT with wrong audience', async () => {
    const app = await getTestApp();
    const bad = jwt.sign(
      {
        typ: 'access',
        sub: '00000000-0000-0000-0000-000000000001',
        organizationId: '00000000-0000-0000-0000-000000000002',
        membershipId: '00000000-0000-0000-0000-000000000003',
        role: 'admin',
        assessmentAccess: 'full',
        quizAccess: 'full',
      },
      env.JWT_SECRET,
      {
        algorithm: 'HS256',
        issuer: env.JWT_ISSUER,
        audience: 'wrong-audience',
        expiresIn: '5m',
      },
    );
    const res = await request(app, 'GET', '/api/students', {
      headers: { authorization: `Bearer ${bad}` },
    });
    assert.equal(res.status, 401);
  });

  it('rejects org_select token as Bearer access', async () => {
    const app = await getTestApp();
    const token = jwt.sign(
      { typ: 'org_select', sub: '00000000-0000-0000-0000-000000000001' },
      env.JWT_SECRET,
      {
        algorithm: 'HS256',
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        expiresIn: '5m',
      },
    );
    const res = await request(app, 'GET', '/api/students', {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 401);
  });

  it('rejects disallowed MIME on file initiate', async () => {
    const app = await getTestApp();
    const token = await accessTokenFor('admin@brainpulses.com', 'demo');
    const res = await request(app, 'POST', '/api/files/initiate', {
      headers: { authorization: `Bearer ${token}` },
      body: {
        originalName: 'evil.html',
        mimeType: 'text/html',
        sizeBytes: 100,
      },
    });
    assert.equal(res.status, 400);
  });

  it('returns 404 for cross-tenant bank and activity', async () => {
    const app = await getTestApp();
    const token = await accessTokenFor('admin@brainpulses.com', 'demo');
    const otherOrg = await prisma.organization.findFirst({ where: { slug: 'other' } });
    assert.ok(otherOrg);

    const foreignBank = await prisma.questionBank.create({
      data: {
        organizationId: otherOrg.id,
        kind: 'assessment',
        code: `QB-SEC-${Date.now()}`,
        name: 'Foreign',
        presentation: 'one_at_a_time',
      },
    });

    const bankRes = await request(app, 'GET', `/api/banks/${foreignBank.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(bankRes.status, 404);

    await prisma.questionBank.delete({ where: { id: foreignBank.id } });
  });

  it('error handler never includes stack in JSON', () => {
    const req = { requestId: 'test-req' } as Request;
    let statusCode = 0;
    let payload: unknown;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        payload = body;
        return this;
      },
    } as unknown as Response;

    const errSpy = console.error;
    console.error = () => undefined;
    try {
      errorHandler(new Error('boom secret'), req, res, (() => undefined) as NextFunction);
    } finally {
      console.error = errSpy;
    }
    assert.equal(statusCode, 500);
    const text = JSON.stringify(payload);
    assert.equal(text.includes('stack'), false);
    assert.equal(text.includes('boom secret'), false);
    assert.match(text, /INTERNAL_ERROR/);
  });
});

describe('auth rate limit', () => {
  it('returns 429 with Retry-After when auth flooded', async () => {
    process.env.ENABLE_RATE_LIMIT_IN_TEST = 'true';
    try {
      const { createApp } = await import('../src/app.js');
      const { initRedis } = await import('../src/lib/redis.js');
      await initRedis();
      const app = createApp();

      let saw429 = false;
      let retryAfter: string | null = null;
      const server = app.listen(0);
      try {
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('No address');
        const base = `http://127.0.0.1:${address.port}`;
        for (let i = 0; i < 30; i++) {
          const res = await fetch(`${base}/api/auth/sign-in`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: 'nobody@example.com', password: 'x' }),
          });
          if (res.status === 429) {
            saw429 = true;
            retryAfter = res.headers.get('retry-after');
            break;
          }
        }
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      assert.equal(saw429, true);
      assert.ok(retryAfter);
    } finally {
      delete process.env.ENABLE_RATE_LIMIT_IN_TEST;
    }
  });
});

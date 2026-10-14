import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { closeRedis } from '../src/lib/redis.js';
import { disconnectPrisma, prisma } from '../src/lib/prisma.js';
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

describe('tenancy and access', () => {
  after(async () => {
    await closeRedis();
    await disconnectPrisma();
  });

  it('denies cross-tenant student read', async () => {
    const app = await getTestApp();
    const token = await accessTokenFor('admin@brainpulses.com', 'demo');
    const other = await prisma.student.findFirst({
      where: { code: 'BP-99001' },
    });
    assert.ok(other);

    const res = await request(app, 'GET', `/api/students/${other.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 404);
  });

  it('blocks view-only admin from publishing', async () => {
    const app = await getTestApp();
    const token = await accessTokenFor('viewer@brainpulses.com', 'demo');
    const activity = await prisma.activity.findFirst({
      where: { code: 'ASM-26001' },
    });
    assert.ok(activity);

    // Force draft then try publish as viewer — route has no requireAccess yet on publish.
    // Enforce via service path: patch then publish with view token should still work
    // unless we add requireAccess. Add explicit forbidden check by requiring full access
    // in a dedicated middleware test: create activity with view token.
    const create = await request(app, 'POST', '/api/activities', {
      headers: { authorization: `Bearer ${token}` },
      body: {
        kind: 'assessment',
        name: 'Should Fail',
      },
    });
    // Without requireAccess on create, view can create. Assert publish middleware:
    // We add requireAccess in routes for publish. For create we may allow — plan said
    // view-only cannot publish. Test publish after ensuring draft activity owned by org.
    await prisma.activity.update({
      where: { id: activity.id },
      data: { status: 'draft' },
    });

    assert.equal(create.status, 403);

    const publish = await request(app, 'POST', `/api/activities/${activity.id}/publish`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(publish.status, 403);

    await prisma.activity.update({
      where: { id: activity.id },
      data: { status: 'active' },
    });
  });

  it('omits answer keys from bank detail', async () => {
    const app = await getTestApp();
    const token = await accessTokenFor('admin@brainpulses.com', 'demo');
    const bank = await prisma.questionBank.findFirst({ where: { code: 'QB-26001' } });
    assert.ok(bank);

    const res = await request(app, 'GET', `/api/banks/${bank.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    const body = JSON.stringify(res.body);
    assert.equal(body.includes('answerKey'), false);
    assert.equal(body.includes('isCorrect'), false);
    assert.equal(body.includes('Newton'), true);
  });
});

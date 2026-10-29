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
    const token = await accessTokenFor('admin@brainpulses.com', 'nextgeninnov8');
    const grey = await prisma.organization.findUniqueOrThrow({ where: { slug: 'greycaps' } });
    const other = await prisma.student.upsert({
      where: { organizationId_code: { organizationId: grey.id, code: 'BP-99001' } },
      update: { isActive: true },
      create: {
        organizationId: grey.id,
        code: 'BP-99001',
        name: 'Other Student',
        email: 'other.student@greycaps.com',
      },
    });
    assert.ok(other);

    const res = await request(app, 'GET', `/api/students/${other.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 404);
  });

  it('blocks view-only admin from publishing', async () => {
    const app = await getTestApp();
    const token = await accessTokenFor('viewer@brainpulses.com', 'nextgeninnov8');
    const activity = await prisma.activity.findFirst({
      where: { code: 'QZ-26001' },
    });
    assert.ok(activity);

    const create = await request(app, 'POST', '/api/activities', {
      headers: { authorization: `Bearer ${token}` },
      body: {
        kind: 'assessment',
        name: 'Should Fail',
      },
    });
    const originalStatus = activity.status;
    try {
      await prisma.activity.update({
        where: { id: activity.id },
        data: { status: 'draft' },
      });

      assert.equal(create.status, 403);

      const publish = await request(app, 'POST', `/api/activities/${activity.id}/publish`, {
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(publish.status, 403);
    } finally {
      await prisma.activity.update({
        where: { id: activity.id },
        data: { status: originalStatus },
      });
    }
  });

  it('exposes option correctness on admin bank detail without raw answerKey', async () => {
    const app = await getTestApp();
    const token = await accessTokenFor('admin@brainpulses.com', 'nextgeninnov8');
    const bank = await prisma.questionBank.findFirst({ where: { code: 'QB-26001' } });
    assert.ok(bank);

    const res = await request(app, 'GET', `/api/banks/${bank.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    const body = JSON.stringify(res.body);
    assert.equal(body.includes('answerKey'), false);
    assert.equal(body.includes('isCorrect'), true);
    assert.equal(body.includes('Newton'), true);
    const data = res.body as {
      data: { items: { options: { isCorrect: boolean }[]; correctLabels: string[] }[] };
    };
    assert.ok(data.data.items.length > 0);
    assert.ok(data.data.items[0]!.options.some((o) => o.isCorrect));
    assert.ok(data.data.items[0]!.correctLabels.length > 0);
  });
});

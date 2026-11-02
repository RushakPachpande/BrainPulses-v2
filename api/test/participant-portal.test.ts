import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prisma } from '../src/lib/prisma.js';
import { getTestApp, request } from './helpers.js';

async function participantToken(code = 'BP-24101') {
  const app = await getTestApp();
  const res = await request(app, 'POST', '/api/auth/participant/sign-in-by-code', {
    body: {
      code,
      organizationSlug: 'nextgeninnov8',
      replaceSession: true,
    },
  });
  assert.equal(res.status, 200);
  return (res.body as { data: { accessToken: string } }).data.accessToken;
}

describe('participant portal', () => {
  it('returns me and assigned activities for the signed-in participant', async () => {
    const app = await getTestApp();
    const token = await participantToken();

    const me = await request(app, 'GET', '/api/participant/me', {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(me.status, 200);
    const profile = (me.body as { data: { email: string; name: string } }).data;
    assert.equal(profile.email, 'participant1@mail.com');
    assert.ok(profile.name);

    const activities = await request(app, 'GET', '/api/participant/activities?limit=50', {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(activities.status, 200);
    const list = (activities.body as { data: { activityId: string; code: string }[] }).data;
    assert.ok(list.some((a) => a.code === 'QZ-26001'));
  });

  it('does not allow a participant to read another participant result', async () => {
    const app = await getTestApp();
    const token1 = await participantToken('BP-24101');
    const token2 = await participantToken('BP-24102');

    const activity = await prisma.activity.findFirst({ where: { code: 'QZ-26001' } });
    assert.ok(activity);
    const participant1 = await prisma.participant.findFirst({
      where: { email: 'participant1@mail.com' },
    });
    assert.ok(participant1);

    await prisma.reattemptGrant.deleteMany({
      where: { participantId: participant1.id, activityId: activity.id },
    });
    await prisma.attemptResponse.deleteMany({
      where: { attempt: { participantId: participant1.id, activityId: activity.id } },
    });
    await prisma.result.deleteMany({
      where: { participantId: participant1.id, activityId: activity.id },
    });
    await prisma.attempt.deleteMany({
      where: { participantId: participant1.id, activityId: activity.id },
    });

    const start = await request(app, 'POST', '/api/attempts/start', {
      headers: { authorization: `Bearer ${token1}` },
      body: { activityId: activity.id },
    });
    assert.equal(start.status, 201);
    const started = (
      start.body as {
        data: {
          attempt: { id: string; revision: number };
          questions: { questionVersionId: string }[];
        };
      }
    ).data;

    await request(app, 'POST', `/api/attempts/${started.attempt.id}/save`, {
      headers: { authorization: `Bearer ${token1}` },
      body: {
        revision: started.attempt.revision,
        responses: [
          {
            questionVersionId: started.questions[0]!.questionVersionId,
            answer: { label: 'B' },
          },
        ],
      },
    });

    const submit = await request(app, 'POST', `/api/attempts/${started.attempt.id}/submit`, {
      headers: {
        authorization: `Bearer ${token1}`,
        'idempotency-key': `portal-${started.attempt.id}`,
      },
    });
    assert.equal(submit.status, 200);
    const resultId = (submit.body as { data: { result: { id: string } } }).data.result.id;

    const own = await request(app, 'GET', `/api/participant/results/${resultId}`, {
      headers: { authorization: `Bearer ${token1}` },
    });
    assert.equal(own.status, 200);

    const other = await request(app, 'GET', `/api/participant/results/${resultId}`, {
      headers: { authorization: `Bearer ${token2}` },
    });
    assert.equal(other.status, 404);
  });

  it('turns a participant page off for lists and attempt start', async () => {
    const app = await getTestApp();
    const token = await participantToken();
    const signIn = await request(app, 'POST', '/api/auth/sign-in', {
      body: { email: 'admin@brainpulses.com', password: 'Password123!' },
    });
    const data = (signIn.body as { data: Record<string, unknown> }).data;
    let admin: string;
    if (data.status === 'authenticated') {
      admin = (data.session as { accessToken: string }).accessToken;
    } else {
      const orgs = data.organizations as { id: string; slug: string }[];
      const org = orgs.find((item) => item.slug === 'nextgeninnov8') ?? orgs[0]!;
      const selected = await request(app, 'POST', '/api/auth/select-organization', {
        body: { selectionToken: data.selectionToken, organizationId: org.id },
      });
      admin = (selected.body as { data: { session: { accessToken: string } } }).data.session
        .accessToken;
    }

    const before = await request(app, 'GET', '/api/participant/pages', {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(before.status, 200);
    assert.equal((before.body as { data: { quizzes: boolean } }).data.quizzes, true);

    try {
      const patched = await request(app, 'PATCH', '/api/settings/general', {
        headers: { authorization: `Bearer ${admin}` },
        body: { values: { participantPageQuizzes: false } },
      });
      assert.equal(patched.status, 200);

      const pages = await request(app, 'GET', '/api/participant/pages', {
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(pages.status, 200);
      const flags = (pages.body as { data: { quizzes: boolean; overview: boolean } }).data;
      assert.equal(flags.quizzes, false);
      assert.equal(flags.overview, true);

      const quizzes = await request(app, 'GET', '/api/participant/activities?kind=quiz&limit=50', {
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(quizzes.status, 403);

      const all = await request(app, 'GET', '/api/participant/activities?kind=all&limit=50', {
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(all.status, 200);
      const list = (all.body as { data: { kind: string }[] }).data;
      assert.ok(list.every((item) => item.kind !== 'quiz'));

      const activity = await prisma.activity.findFirst({ where: { code: 'QZ-26001' } });
      assert.ok(activity);
      const start = await request(app, 'POST', '/api/attempts/start', {
        headers: { authorization: `Bearer ${token}` },
        body: { activityId: activity.id },
      });
      assert.equal(start.status, 403);
    } finally {
      await request(app, 'PATCH', '/api/settings/general', {
        headers: { authorization: `Bearer ${admin}` },
        body: { values: { participantPageQuizzes: true } },
      });
    }
  });
});

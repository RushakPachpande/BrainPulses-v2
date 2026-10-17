import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prisma } from '../src/lib/prisma.js';
import { getTestApp, request } from './helpers.js';

async function studentToken(email = 'student1@mail.com') {
  const app = await getTestApp();
  const res = await request(app, 'POST', '/api/auth/student/sign-in', {
    body: {
      email,
      password: 'Student123!',
      organizationSlug: 'demo',
      replaceSession: true,
    },
  });
  assert.equal(res.status, 200);
  return (res.body as { data: { accessToken: string } }).data.accessToken;
}

describe('student portal', () => {
  it('returns me and assigned activities for the signed-in student', async () => {
    const app = await getTestApp();
    const token = await studentToken();

    const me = await request(app, 'GET', '/api/student/me', {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(me.status, 200);
    const profile = (me.body as { data: { email: string; name: string } }).data;
    assert.equal(profile.email, 'student1@mail.com');
    assert.ok(profile.name);

    const activities = await request(app, 'GET', '/api/student/activities?limit=50', {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(activities.status, 200);
    const list = (activities.body as { data: { activityId: string; code: string }[] }).data;
    assert.ok(list.length >= 2);
    assert.ok(list.some((a) => a.code === 'ASM-26001'));
    assert.ok(list.some((a) => a.code === 'QZ-26001'));
  });

  it('does not allow a student to read another student result', async () => {
    const app = await getTestApp();
    const token1 = await studentToken('student1@mail.com');
    const token2 = await studentToken('student2@mail.com');

    const activity = await prisma.activity.findFirst({ where: { code: 'QZ-26002' } });
    assert.ok(activity);
    const student1 = await prisma.student.findFirst({ where: { email: 'student1@mail.com' } });
    assert.ok(student1);

    await prisma.attemptResponse.deleteMany({
      where: { attempt: { studentId: student1.id, activityId: activity.id } },
    });
    await prisma.result.deleteMany({
      where: { studentId: student1.id, activityId: activity.id },
    });
    await prisma.attempt.deleteMany({
      where: { studentId: student1.id, activityId: activity.id },
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

    const own = await request(app, 'GET', `/api/student/results/${resultId}`, {
      headers: { authorization: `Bearer ${token1}` },
    });
    assert.equal(own.status, 200);

    const other = await request(app, 'GET', `/api/student/results/${resultId}`, {
      headers: { authorization: `Bearer ${token2}` },
    });
    assert.equal(other.status, 404);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prisma } from '../src/lib/prisma.js';
import { getTestApp, request } from './helpers.js';

async function studentToken() {
  const app = await getTestApp();
  const res = await request(app, 'POST', '/api/auth/student/sign-in-by-code', {
    body: {
      code: 'BP-24101',
      organizationSlug: 'demo',
      replaceSession: true,
    },
  });
  assert.equal(res.status, 200);
  return (res.body as { data: { accessToken: string } }).data.accessToken;
}

describe('attempts', () => {
  it('rejects stale revision and accepts idempotent submit', async () => {
    const app = await getTestApp();
    const token = await studentToken();
    const activity = await prisma.activity.findFirst({
      where: { code: 'ASM-26001' },
      include: { rounds: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    });
    assert.ok(activity);
    const round = activity.rounds[0];
    assert.ok(round, 'assessment seed should include Round 1');

    // Clear prior open attempts for this student/activity
    const student = await prisma.student.findFirst({
      where: { email: 'student1@mail.com' },
    });
    assert.ok(student);
    await prisma.attemptResponse.deleteMany({
      where: { attempt: { studentId: student.id, activityId: activity.id } },
    });
    await prisma.result.deleteMany({
      where: { studentId: student.id, activityId: activity.id },
    });
    await prisma.attempt.deleteMany({
      where: { studentId: student.id, activityId: activity.id },
    });

    const start = await request(app, 'POST', '/api/attempts/start', {
      headers: { authorization: `Bearer ${token}` },
      body: { activityId: activity.id, roundId: round.id },
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
    assert.ok(started.questions[0]);
    const firstVersion = await prisma.questionVersion.findFirst({
      where: { id: started.questions[0].questionVersionId },
      include: { options: true },
    });
    assert.ok(firstVersion);
    const correctLabel =
      firstVersion.options.find((o) => o.isCorrect)?.label ??
      ((firstVersion.answerKey as { correctLabels?: string[] })?.correctLabels?.[0] as string);
    assert.ok(correctLabel);

    const stale = await request(app, 'POST', `/api/attempts/${started.attempt.id}/save`, {
      headers: { authorization: `Bearer ${token}` },
      body: {
        revision: started.attempt.revision + 5,
        responses: [
          {
            questionVersionId: started.questions[0].questionVersionId,
            answer: { label: correctLabel },
          },
        ],
      },
    });
    assert.equal(stale.status, 409);

    const save = await request(app, 'POST', `/api/attempts/${started.attempt.id}/save`, {
      headers: { authorization: `Bearer ${token}` },
      body: {
        revision: started.attempt.revision,
        responses: [
          {
            questionVersionId: started.questions[0].questionVersionId,
            answer: { label: correctLabel },
          },
        ],
      },
    });
    assert.equal(save.status, 200);

    const key = `submit-${started.attempt.id}`;
    const submit1 = await request(app, 'POST', `/api/attempts/${started.attempt.id}/submit`, {
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': key,
      },
    });
    assert.equal(submit1.status, 200);
    const result1 = (submit1.body as { data: { result: { id: string } } }).data.result;

    const submit2 = await request(app, 'POST', `/api/attempts/${started.attempt.id}/submit`, {
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': key,
      },
    });
    assert.equal(submit2.status, 200);
    const result2 = (submit2.body as { data: { result: { id: string } } }).data.result;
    assert.equal(result1.id, result2.id);

    const stored = await prisma.result.findFirst({ where: { id: result1.id } });
    assert.ok(stored);
    assert.equal(Number(stored.score), Number(stored.maxScore) > 0 ? Number(firstVersion.points) : 0);
  });

  it('resumes an in-progress attempt with saved answers and remaining deadline', async () => {
    const app = await getTestApp();
    const token = await studentToken();
    const activity = await prisma.activity.findFirst({ where: { code: 'QZ-26001' } });
    assert.ok(activity);
    const student = await prisma.student.findFirst({
      where: { email: 'student1@mail.com' },
    });
    assert.ok(student);
    await prisma.attemptResponse.deleteMany({
      where: { attempt: { studentId: student.id, activityId: activity.id } },
    });
    await prisma.result.deleteMany({
      where: { studentId: student.id, activityId: activity.id },
    });
    await prisma.attempt.deleteMany({
      where: { studentId: student.id, activityId: activity.id },
    });

    const start = await request(app, 'POST', '/api/attempts/start', {
      headers: { authorization: `Bearer ${token}` },
      body: { activityId: activity.id },
    });
    assert.equal(start.status, 201);
    const started = (
      start.body as {
        data: {
          attempt: { id: string; revision: number; deadlineAt: string };
          questions: { questionVersionId: string }[];
        };
      }
    ).data;

    await request(app, 'POST', `/api/attempts/${started.attempt.id}/save`, {
      headers: { authorization: `Bearer ${token}` },
      body: {
        revision: started.attempt.revision,
        responses: [
          {
            questionVersionId: started.questions[0]!.questionVersionId,
            answer: { label: 'A' },
          },
        ],
      },
    });

    const resume = await request(app, 'GET', `/api/attempts/${started.attempt.id}/resume`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(resume.status, 200);
    const resumed = (
      resume.body as {
        data: {
          attempt: {
            id: string;
            status: string;
            deadlineAt: string;
            responses: { questionVersionId: string; answer: { label?: string } }[];
          };
          questions: unknown[];
        };
      }
    ).data;
    assert.equal(resumed.attempt.id, started.attempt.id);
    assert.equal(resumed.attempt.status, 'in_progress');
    assert.ok(resumed.questions.length >= 1);
    assert.ok(
      resumed.attempt.responses.some(
        (r) =>
          r.questionVersionId === started.questions[0]!.questionVersionId &&
          r.answer?.label === 'A',
      ),
    );
    assert.ok(new Date(resumed.attempt.deadlineAt).getTime() > Date.now());
  });
});

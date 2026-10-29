import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prisma } from '../src/lib/prisma.js';
import { parseQuizSettings } from '../src/lib/quiz-settings.js';
import { attemptDurationMs } from '../src/modules/attempts/service.js';
import { getTestApp, request } from './helpers.js';

async function studentToken(code = 'BP-24101') {
  const app = await getTestApp();
  const res = await request(app, 'POST', '/api/auth/student/sign-in-by-code', {
    body: {
      code,
      organizationSlug: 'nextgeninnov8',
      replaceSession: true,
    },
  });
  assert.equal(res.status, 200);
  return (res.body as { data: { accessToken: string } }).data.accessToken;
}

async function adminToken() {
  const app = await getTestApp();
  const signIn = await request(app, 'POST', '/api/auth/sign-in', {
    body: { email: 'admin@brainpulses.com', password: 'Password123!' },
  });
  const data = (signIn.body as { data: Record<string, unknown> }).data;
  if (data.status === 'authenticated') {
    return (data.session as { accessToken: string }).accessToken;
  }
  const orgs = data.organizations as { id: string; slug: string }[];
  const org = orgs.find((o) => o.slug === 'nextgeninnov8') ?? orgs[0]!;
  const selected = await request(app, 'POST', '/api/auth/select-organization', {
    body: { selectionToken: data.selectionToken, organizationId: org.id },
  });
  return (selected.body as { data: { session: { accessToken: string } } }).data.session.accessToken;
}

async function clearQuizAttempts(studentId: string, activityId: string) {
  await prisma.reattemptGrant.deleteMany({ where: { studentId, activityId } });
  await prisma.attemptResponse.deleteMany({
    where: { attempt: { studentId, activityId } },
  });
  await prisma.result.deleteMany({ where: { studentId, activityId } });
  await prisma.attempt.deleteMany({ where: { studentId, activityId } });
}

describe('quiz ops', () => {
  it('parses quiz settings defaults and overrides', () => {
    const defaults = parseQuizSettings(null);
    assert.equal(defaults.shuffleQuestions, true);
    assert.equal(defaults.scoreRelease, 'after_submit');
    assert.equal(defaults.maxAttempts, 1);
    assert.equal(defaults.showQuestionPanel, true);
    assert.equal(defaults.questionsCompulsory, true);

    const custom = parseQuizSettings({
      quiz: {
        shuffleQuestions: false,
        scoreVisibleToStudent: true,
        answersVisibleToStudent: true,
        showQuestionPanel: false,
        maxAttempts: null,
      },
    });
    assert.equal(custom.shuffleQuestions, false);
    assert.equal(custom.scoreRelease, 'after_publish');
    assert.equal(custom.answersVisibleToStudent, true);
    assert.equal(custom.showQuestionPanel, false);
    assert.equal(custom.maxAttempts, null);
  });

  it('uses one question window for per-question duration', () => {
    const ms = attemptDurationMs(
      {
        kind: 'quiz',
        durationMode: 'per_question',
        durationMinutes: null,
        perQuestionSeconds: 30,
      },
      20,
      60,
    );
    assert.equal(ms, 30_000);

    const overall = attemptDurationMs(
      {
        kind: 'quiz',
        durationMode: 'overall',
        durationMinutes: 60,
        perQuestionSeconds: null,
      },
      20,
      60,
    );
    assert.equal(overall, 60 * 60_000);
  });

  it('freezes question order across resume and allows a granted reattempt', async () => {
    const app = await getTestApp();
    const token = await studentToken();
    const admin = await adminToken();
    const adminHeaders = { authorization: `Bearer ${admin}` };

    const activity = await prisma.activity.findFirst({ where: { code: 'QZ-26001' } });
    assert.ok(activity);
    const student = await prisma.student.findFirst({ where: { email: 'student1@mail.com' } });
    assert.ok(student);

    await clearQuizAttempts(student.id, activity.id);

    await prisma.activity.update({
      where: { id: activity.id },
      data: {
        settings: {
          quiz: {
            shuffleQuestions: true,
            shuffleOptions: true,
            scoreRelease: 'after_submit',
            answersVisibleToStudent: true,
            maxAttempts: 1,
          },
        },
      },
    });

    const start = await request(app, 'POST', '/api/attempts/start', {
      headers: { authorization: `Bearer ${token}` },
      body: { activityId: activity.id },
    });
    assert.equal(start.status, 201);
    const started = (
      start.body as {
        data: {
          attempt: { id: string; softProctoring: boolean };
          questions: { questionVersionId: string }[];
        };
      }
    ).data;
    assert.equal(started.attempt.softProctoring, true);
    assert.ok(started.questions.length > 0);
    const order = started.questions.map((q) => q.questionVersionId);

    const resume = await request(app, 'GET', `/api/attempts/${started.attempt.id}/resume`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(resume.status, 200);
    const resumed = (resume.body as { data: { questions: { questionVersionId: string }[] } }).data;
    assert.deepEqual(
      resumed.questions.map((q) => q.questionVersionId),
      order,
    );

    const firstVersion = await prisma.questionVersion.findFirst({
      where: { id: order[0]! },
      include: { options: true },
    });
    assert.ok(firstVersion);
    const correctLabel =
      firstVersion.options.find((o) => o.isCorrect)?.label ??
      ((firstVersion.answerKey as { correctLabels?: string[] })?.correctLabels?.[0] as string);
    assert.ok(correctLabel);

    const save = await request(app, 'POST', `/api/attempts/${started.attempt.id}/save`, {
      headers: { authorization: `Bearer ${token}` },
      body: {
        revision: 0,
        responses: [{ questionVersionId: order[0]!, answer: { label: correctLabel } }],
      },
    });
    assert.equal(save.status, 200);

    const submit = await request(app, 'POST', `/api/attempts/${started.attempt.id}/submit`, {
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `quiz-ops-${started.attempt.id}`,
      },
    });
    assert.equal(submit.status, 200);

    const blocked = await request(app, 'POST', '/api/attempts/start', {
      headers: { authorization: `Bearer ${token}` },
      body: { activityId: activity.id },
    });
    assert.equal(blocked.status, 409);

    const dq = await request(app, 'POST', `/api/admin/attempts/${started.attempt.id}/disqualify`, {
      headers: adminHeaders,
      body: { note: 'test dq' },
    });
    assert.equal(dq.status, 200);
    const disqualified = await prisma.attempt.findFirst({ where: { id: started.attempt.id } });
    assert.equal(disqualified?.disqualified, true);
    assert.equal(disqualified?.isAuthoritative, false);

    const grant = await request(app, 'POST', `/api/activities/${activity.id}/reattempts`, {
      headers: adminHeaders,
      body: { studentId: student.id, mode: 'restart', note: 'retry' },
    });
    assert.equal(grant.status, 201);

    const restart = await request(app, 'POST', '/api/attempts/start', {
      headers: { authorization: `Bearer ${token}` },
      body: { activityId: activity.id },
    });
    assert.equal(restart.status, 201);
  });
});

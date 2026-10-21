import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prisma } from '../src/lib/prisma.js';
import { parseQuizSettings } from '../src/lib/quiz-settings.js';
import { getTestApp, request } from './helpers.js';

async function studentToken(code = 'BP-24101') {
  const app = await getTestApp();
  const res = await request(app, 'POST', '/api/auth/student/sign-in-by-code', {
    body: {
      code,
      organizationSlug: 'demo',
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
  const org = orgs.find((o) => o.slug === 'demo') ?? orgs[0]!;
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
    assert.equal(defaults.scoreVisibleToStudent, false);

    const custom = parseQuizSettings({
      quiz: {
        shuffleQuestions: false,
        scoreVisibleToStudent: true,
        answersVisibleToStudent: true,
      },
    });
    assert.equal(custom.shuffleQuestions, false);
    assert.equal(custom.scoreVisibleToStudent, true);
    assert.equal(custom.answersVisibleToStudent, true);
  });

  it('freezes question order across resume and excludes disqualified from boards', async () => {
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
            scoreVisibleToStudent: true,
            answersVisibleToStudent: true,
            dailyLeaderboardVisible: true,
            overallLeaderboardVisible: true,
            dailyGroupLeaderboardVisible: true,
            overallGroupLeaderboardVisible: true,
            countsForGroupLeaderboard: true,
            leaderboardReleasedAt: null,
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

    const boardBefore = await request(
      app,
      'GET',
      `/api/leaderboards/activities/${activity.id}?scope=overall&kind=individual`,
      { headers: adminHeaders },
    );
    assert.equal(boardBefore.status, 200);
    const beforeEntries = (boardBefore.body as { data: { entries: { studentCode: string }[] } })
      .data.entries;
    assert.ok(beforeEntries.some((e) => e.studentCode === student.code));

    const dq = await request(app, 'POST', `/api/admin/attempts/${started.attempt.id}/disqualify`, {
      headers: adminHeaders,
      body: { note: 'test dq' },
    });
    assert.equal(dq.status, 200);

    const boardAfter = await request(
      app,
      'GET',
      `/api/leaderboards/activities/${activity.id}?scope=overall&kind=individual`,
      { headers: adminHeaders },
    );
    assert.equal(boardAfter.status, 200);
    const afterEntries = (boardAfter.body as { data: { entries: { studentCode: string }[] } }).data
      .entries;
    assert.ok(!afterEntries.some((e) => e.studentCode === student.code));

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

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prisma } from '../src/lib/prisma.js';
import { ensureRoundAssessment } from './fixtures.js';
import { getTestApp, request } from './helpers.js';

function forbidKeys(value: unknown, banned: readonly string[], path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => forbidKeys(item, banned, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    assert.equal(banned.includes(key), false, `${path}.${key} must not be sent to the participant`);
    forbidKeys(child, banned, `${path}.${key}`);
  }
}

async function participantToken() {
  const app = await getTestApp();
  const res = await request(app, 'POST', '/api/auth/participant/sign-in-by-code', {
    body: {
      code: 'BP-24101',
      organizationSlug: 'nextgeninnov8',
      replaceSession: true,
    },
  });
  assert.equal(res.status, 200);
  return (res.body as { data: { accessToken: string } }).data.accessToken;
}

describe('participant attempt payloads', () => {
  it('omits isCorrect and answerKey on start and resume', async () => {
    const app = await getTestApp();
    const token = await participantToken();
    const headers = { authorization: `Bearer ${token}` };
    const { activity, round } = await ensureRoundAssessment();
    const participant = await prisma.participant.findFirst({
      where: { email: 'participant1@mail.com' },
    });
    assert.ok(participant);
    await prisma.attemptResponse.deleteMany({
      where: { attempt: { participantId: participant.id, activityId: activity.id } },
    });
    await prisma.result.deleteMany({
      where: { participantId: participant.id, activityId: activity.id },
    });
    await prisma.attempt.deleteMany({
      where: { participantId: participant.id, activityId: activity.id },
    });

    const start = await request(app, 'POST', '/api/attempts/start', {
      headers,
      body: { activityId: activity.id, roundId: round.id },
    });
    assert.equal(start.status, 201);
    const started = (
      start.body as {
        data: {
          attempt: { id: string };
          questions: { questionVersionId: string; options: unknown[] }[];
        };
      }
    ).data;
    assert.ok(started.questions.length > 0);

    const versions = await prisma.questionVersion.findMany({
      where: { id: { in: started.questions.map((q) => q.questionVersionId) } },
      include: { options: true },
    });
    assert.ok(
      versions.some((v) => v.options.some((o) => o.isCorrect)),
      'seed questions must store isCorrect so the test can prove it was withheld',
    );
    assert.ok(
      versions.some((v) => v.answerKey && typeof v.answerKey === 'object'),
      'seed questions must store answerKey so the test can prove it was withheld',
    );

    forbidKeys(start.body, ['isCorrect', 'answerKey']);

    const resume = await request(app, 'GET', `/api/attempts/${started.attempt.id}/resume`, {
      headers,
    });
    assert.equal(resume.status, 200);
    const resumed = (resume.body as { data: { questions: unknown[] } }).data;
    assert.ok(resumed.questions.length > 0);
    forbidKeys(resume.body, ['isCorrect', 'answerKey']);
  });
});

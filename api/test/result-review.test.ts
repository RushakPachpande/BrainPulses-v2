import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ensureReviewResults } from './fixtures.js';
import { getTestApp, request } from './helpers.js';

type ResultRow = { id: string; kind: string; activityCode: string };
type ReviewOption = { isCorrect?: boolean };
type ReviewItem = { options?: ReviewOption[]; correctLabels?: string[] };
type ResultDetail = {
  kind: string;
  answersVisible: boolean;
  review: ReviewItem[];
};

function forbidKey(value: unknown, banned: string) {
  if (Array.isArray(value)) {
    for (const item of value) forbidKey(item, banned);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    assert.notEqual(key, banned);
    forbidKey(child, banned);
  }
}

async function studentToken(code: string) {
  const app = await getTestApp();
  const res = await request(app, 'POST', '/api/auth/student/sign-in-by-code', {
    body: { code, organizationSlug: 'nextgeninnov8', replaceSession: true },
  });
  assert.equal(res.status, 200);
  return (res.body as { data: { accessToken: string } }).data.accessToken;
}

describe('published result review policy', () => {
  it('shows assessment review keys and hides quiz answers when the flag is false', async () => {
    const app = await getTestApp();
    const token = await studentToken('BP-24102');
    await ensureReviewResults();
    const headers = { authorization: `Bearer ${token}` };

    const list = await request(app, 'GET', '/api/student/results?limit=50', { headers });
    assert.equal(list.status, 200);
    const rows = (list.body as { data: ResultRow[] }).data;

    const assessment = rows.find((row) => row.activityCode === 'ASM-ROUND');
    const hiddenQuiz = rows.find((row) => row.activityCode === 'QZ-HIDDEN');
    assert.ok(assessment, 'seed should publish an assessment result for BP-24102');
    assert.ok(hiddenQuiz, 'fixture should publish QZ-HIDDEN with answers hidden');

    const assessmentRes = await request(app, 'GET', `/api/student/results/${assessment.id}`, {
      headers,
    });
    assert.equal(assessmentRes.status, 200);
    const assessmentBody = (assessmentRes.body as { data: ResultDetail }).data;
    assert.equal(assessmentBody.kind, 'assessment');
    assert.equal(assessmentBody.answersVisible, true);
    assert.ok(
      assessmentBody.review.some(
        (item) =>
          (item.correctLabels?.length ?? 0) > 0 || item.options?.some((option) => option.isCorrect),
      ),
    );
    forbidKey(assessmentRes.body, 'answerKey');

    const quizRes = await request(app, 'GET', `/api/student/results/${hiddenQuiz.id}`, {
      headers,
    });
    assert.equal(quizRes.status, 200);
    const quizBody = (quizRes.body as { data: ResultDetail }).data;
    assert.equal(quizBody.kind, 'quiz');
    assert.equal(quizBody.answersVisible, false);
    assert.deepEqual(quizBody.review, []);
    forbidKey(quizRes.body, 'answerKey');
    forbidKey(quizRes.body, 'isCorrect');
  });
});

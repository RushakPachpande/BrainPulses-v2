import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultRoundSettings } from '../src/lib/round-settings.js';
import {
  buildAssessmentRow,
  type AssessmentSource,
} from '../src/modules/assessment-reports/rows.js';
import type { AttemptSnapshot } from '../src/modules/quiz-reports/rows.js';

function attempt(
  partial: Partial<AttemptSnapshot> & Pick<AttemptSnapshot, 'id' | 'score'>,
): AttemptSnapshot {
  return {
    status: 'submitted',
    startedAt: '2026-11-01T10:00:00.000Z',
    submittedAt: '2026-11-01T10:10:00.000Z',
    createdAt: '2026-11-01T10:00:00.000Z',
    disqualified: false,
    autoSubmitReason: null,
    maxScore: 30,
    questionCount: 10,
    resultId: `${partial.id}-result`,
    ...partial,
  };
}

function source(
  settings: Partial<AssessmentSource['roundSettings']>,
  attempts: AttemptSnapshot[],
): AssessmentSource {
  return {
    registrationId: 'reg',
    roundId: 'round',
    roundName: 'Round 1',
    roundOrder: 1,
    registeredAt: '2026-10-01T00:00:00.000Z',
    code: 'BP-1',
    name: 'Ada',
    email: 'ada@example.com',
    phone: null,
    activityId: 'assessment',
    assessmentName: 'Induction',
    displayStatus: 'Active',
    roundSettings: { ...defaultRoundSettings, ...settings },
    resultsPublishedAt: null,
    questionCount: 10,
    maxScore: 30,
    attempts,
  };
}

describe('assessment report rows', () => {
  it('passes on a score rule even when the percent is under a percent line', () => {
    const row = buildAssessmentRow(
      source({ passMode: 'score', passingScore: 18, passingPercent: 80 }, [
        attempt({ id: 'a', score: 19 }),
      ]),
    );
    assert.equal(row.result, 'pass');
    assert.equal(row.percent, 63);
    assert.equal(row.passLinePercent, 60);
  });

  it('fails a percent rule using the rounded percent', () => {
    const row = buildAssessmentRow(
      source({ passMode: 'percent', passingPercent: 70 }, [attempt({ id: 'a', score: 19 })]),
    );
    assert.equal(row.result, 'fail');
  });

  it('picks the best attempt inside the round', () => {
    const row = buildAssessmentRow(
      source({ passMode: 'percent', passingPercent: 50 }, [
        attempt({ id: 'low', score: 10 }),
        attempt({ id: 'high', score: 24, submittedAt: '2026-11-02T10:00:00.000Z' }),
      ]),
    );
    assert.equal(row.bestAttemptId, 'high');
    assert.equal(row.result, 'pass');
  });
});

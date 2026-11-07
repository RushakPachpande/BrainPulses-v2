import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildReportRow,
  classifyAttemptStatus,
  filterReportRows,
  pickBestAttempt,
  sortReportRows,
  summarizeReportRows,
  wholePercent,
  type AttemptSnapshot,
  type ReportSource,
} from '../src/modules/quiz-reports/rows.js';

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
    questionCount: 15,
    resultId: `${partial.id}-result`,
    ...partial,
  };
}

function source(attempts: AttemptSnapshot[], overrides: Partial<ReportSource> = {}): ReportSource {
  return {
    registrationId: 'reg-1',
    registeredAt: '2026-10-01T00:00:00.000Z',
    code: 'BP-1',
    name: 'Ada',
    email: 'ada@example.com',
    phone: null,
    activityId: 'quiz-1',
    quizName: 'Weekly',
    contestId: null,
    contestName: null,
    displayStatus: 'Active',
    passingPercent: 60,
    scoreRelease: 'after_submit',
    resultsPublishedAt: null,
    maxAttempts: 3,
    grantCount: 0,
    quizQuestionCount: 15,
    quizMaxScore: 30,
    attempts,
    ...overrides,
  };
}

describe('quiz report rows', () => {
  it('picks the highest score and the earlier attempt on a tie', () => {
    const best = pickBestAttempt([
      attempt({ id: 'late', score: 19, submittedAt: '2026-11-02T10:00:00.000Z' }),
      attempt({ id: 'early', score: 19, submittedAt: '2026-11-01T10:00:00.000Z' }),
      attempt({ id: 'low', score: 11, submittedAt: '2026-10-31T10:00:00.000Z' }),
    ]);
    assert.equal(best?.id, 'early');
  });

  it('ignores a disqualified attempt when choosing the best score', () => {
    const best = pickBestAttempt([
      attempt({ id: 'out', score: 30, disqualified: true }),
      attempt({ id: 'kept', score: 12 }),
    ]);
    assert.equal(best?.id, 'kept');
  });

  it('keeps a retry in progress as completed', () => {
    const status = classifyAttemptStatus(
      [
        attempt({ id: 'done', score: 10 }),
        attempt({
          id: 'open',
          score: null,
          status: 'in_progress',
          submittedAt: null,
          maxScore: null,
        }),
      ],
      true,
    );
    assert.equal(status, 'completed');
  });

  it('shows in progress only while the quiz is active', () => {
    const open = [
      attempt({
        id: 'open',
        score: null,
        status: 'in_progress',
        submittedAt: null,
        maxScore: null,
      }),
    ];
    assert.equal(classifyAttemptStatus(open, true), 'in_progress');
    assert.equal(classifyAttemptStatus(open, false), 'not_started');
    assert.equal(classifyAttemptStatus([], true), 'not_started');
  });

  it('rounds percent and passes on the displayed number', () => {
    assert.equal(wholePercent(19, 30), 63);
    const row = buildReportRow(source([attempt({ id: 'a', score: 19 })]));
    assert.equal(row.percent, 63);
    assert.equal(row.result, 'pass');
    assert.equal(row.autoSubmitted, false);
  });

  it('sorts empty scores last in both directions', () => {
    const scored = buildReportRow(
      source([attempt({ id: 'a', score: 10 })], {
        registrationId: 'scored',
        name: 'Ada',
        code: 'A',
      }),
    );
    const empty = buildReportRow(source([], { registrationId: 'empty', name: 'Bea', code: 'B' }));
    const asc = sortReportRows([empty, scored], 'score', 'asc').map((row) => row.registrationId);
    const desc = sortReportRows([scored, empty], 'score', 'desc').map((row) => row.registrationId);
    assert.deepEqual(asc, ['scored', 'empty']);
    assert.deepEqual(desc, ['scored', 'empty']);
  });

  it('averages and pass rate use completed rows only', () => {
    const passed = buildReportRow(source([attempt({ id: 'a', score: 19 })]));
    const failed = buildReportRow(
      source([attempt({ id: 'b', score: 3 })], {
        registrationId: 'reg-2',
        name: 'Bea',
        code: 'BP-2',
      }),
    );
    const fresh = buildReportRow(source([], { registrationId: 'reg-3', name: 'Cy', code: 'BP-3' }));
    const summary = summarizeReportRows([passed, failed, fresh]);
    assert.equal(summary.registered, 3);
    assert.equal(summary.completed, 2);
    assert.equal(summary.notStarted, 1);
    assert.equal(summary.passRate, 50);
    const filtered = filterReportRows([passed, failed, fresh], {
      q: 'bea',
      quizStatus: 'any',
      attemptStatus: 'any',
      autoSubmitted: 'any',
      sort: 'submitted',
      dir: 'desc',
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.code, 'BP-2');
  });
});

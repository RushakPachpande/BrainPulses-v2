import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Worksheet } from 'exceljs';
import { loadWorkbook } from '../src/lib/excel-workbook.js';
import type { ExportQuestion } from '../src/lib/report-workbook.js';
import {
  assessmentFileBase,
  buildAssessmentWorkbook,
  type AssessmentExportContext,
} from '../src/modules/assessment-reports/export.js';
import type { AssessmentReportRow } from '../src/modules/assessment-reports/rows.js';
import {
  buildReportWorkbook,
  reportFileBase,
  type QuizExportContext,
} from '../src/modules/quiz-reports/export.js';
import type { ReportRow } from '../src/modules/quiz-reports/rows.js';

const STARTED = '2026-11-01T10:00:00.000Z';
const SUBMITTED = '2026-11-01T10:10:00.000Z';

const alpha: ExportQuestion = {
  id: 'va',
  sortOrder: 1,
  code: 'a',
  question: 'Alpha',
  type: 'mcq',
  points: 2,
  answerKey: { correctLabels: ['A'] },
  options: [
    { label: 'A', body: 'Yes', isCorrect: true },
    { label: 'B', body: 'No', isCorrect: false },
  ],
};

const beta: ExportQuestion = {
  id: 'vb',
  sortOrder: 1,
  code: 'b',
  question: 'Beta',
  type: 'mcq',
  points: 1,
  answerKey: { correctLabels: ['A'] },
  options: [{ label: 'A', body: 'True', isCorrect: true }],
};

const explain: ExportQuestion = {
  id: 'vc',
  sortOrder: 2,
  code: 'c',
  question: 'Explain',
  type: 'short_text',
  points: 5,
  answerKey: {},
  options: [],
};

function questions(): Map<string, ExportQuestion> {
  return new Map([
    [alpha.id, alpha],
    [beta.id, beta],
    [explain.id, explain],
  ]);
}

function assessmentRow(overrides: Partial<AssessmentReportRow>): AssessmentReportRow {
  return {
    id: 'reg:round',
    registrationId: 'reg-ada',
    roundId: 'english-6',
    roundName: 'English',
    roundOrder: 1,
    registeredAt: '2026-10-01T00:00:00.000Z',
    code: 'BP-1',
    name: 'Ada',
    email: 'ada@example.com',
    phone: null,
    activityId: 'grade-6',
    assessmentName: 'Grade 6',
    activityStatus: 'active',
    displayStatus: 'Active',
    passMode: 'percent',
    passingPercent: 40,
    passingScore: null,
    passLinePercent: 40,
    scoreRelease: 'after_submit',
    resultsPublishedAt: null,
    attemptStatus: 'completed',
    attemptsStarted: 1,
    attemptsAllowed: 1,
    bestAttemptId: 'attempt-ada',
    resultId: 'result-ada',
    score: 2,
    maxScore: 3,
    percent: 67,
    result: 'pass',
    questionCount: 3,
    correct: 1,
    skipped: 1,
    negative: 0,
    timeTakenSeconds: 600,
    submittedAt: SUBMITTED,
    autoSubmitted: true,
    autoSubmitReason: 'timer',
    ...overrides,
  };
}

function quizRow(overrides: Partial<ReportRow>): ReportRow {
  return {
    registrationId: 'reg-ada',
    registeredAt: '2026-10-01T00:00:00.000Z',
    code: 'BP-1',
    name: 'Ada',
    email: 'ada@example.com',
    phone: null,
    activityId: 'quiz-north',
    quizName: 'Weekly',
    contestId: 'north',
    contestName: 'North',
    quizStatus: 'active',
    displayStatus: 'Active',
    passingPercent: 40,
    scoreRelease: 'after_submit',
    resultsPublishedAt: null,
    attemptStatus: 'completed',
    attemptsStarted: 1,
    attemptsAllowed: 2,
    bestAttemptId: 'attempt-ada',
    resultId: 'result-ada',
    score: 2,
    maxScore: 3,
    percent: 67,
    result: 'pass',
    questionCount: 2,
    correct: 1,
    skipped: 1,
    negative: 0,
    timeTakenSeconds: 600,
    submittedAt: SUBMITTED,
    autoSubmitted: false,
    autoSubmitReason: null,
    ...overrides,
  };
}

function headersOf(sheet: Worksheet): string[] {
  const headers: string[] = [];
  const row = sheet.getRow(1);
  for (let column = 1; column <= sheet.columnCount; column += 1) {
    const value = row.getCell(column).value;
    if (value == null || value === '') break;
    headers.push(String(value));
  }
  return headers;
}

function cell(sheet: Worksheet, rowNumber: number, header: string): string {
  const headers = headersOf(sheet);
  const index = headers.indexOf(header);
  assert.notEqual(index, -1, header);
  const value = sheet.getRow(rowNumber).getCell(index + 1).value;
  return value == null ? '' : String(value);
}

describe('report file names', () => {
  it('uses the activity kind, the activity name, and report', () => {
    assert.equal(assessmentFileBase('Science G5'), 'assessment-science-g5-report');
    assert.equal(assessmentFileBase(null), 'assessment-report');
    assert.equal(reportFileBase('Weekly Quiz'), 'quiz-weekly-quiz-report');
    assert.equal(reportFileBase(''), 'quiz-report');
  });
});

describe('question-level report workbooks', () => {
  it('puts each assessment round on its own sheet with aligned question columns', async () => {
    const context: AssessmentExportContext = {
      profiles: new Map([['reg-ada', { course: 'BSc', cohort: '2026', city: 'Pune' }]]),
      attempts: new Map([
        [
          'attempt-ada',
          {
            startedAt: STARTED,
            disqualified: false,
            questionIds: ['vb', 'va', 'vc'],
            answers: new Map<string, unknown>([
              ['va', { label: 'A' }],
              ['vc', { text: 'hello' }],
            ]),
          },
        ],
        [
          'attempt-cody',
          {
            startedAt: STARTED,
            disqualified: false,
            questionIds: ['va'],
            answers: new Map<string, unknown>([['va', { label: 'B' }]]),
          },
        ],
        [
          'attempt-nia',
          {
            startedAt: STARTED,
            disqualified: false,
            questionIds: ['va'],
            answers: new Map<string, unknown>([['va', { label: 'A' }]]),
          },
        ],
      ]),
      questions: questions(),
      rounds: new Map([
        [
          'english-6',
          {
            timing: { durationMode: 'overall', durationMinutes: 45, perQuestionSeconds: null },
            negative: { enabled: false, penalty: 0 },
          },
        ],
        [
          'maths-6',
          {
            timing: { durationMode: 'overall', durationMinutes: 30, perQuestionSeconds: null },
            negative: { enabled: true, penalty: 0.5 },
          },
        ],
        [
          'english-7',
          {
            timing: { durationMode: 'per_question', durationMinutes: null, perQuestionSeconds: 20 },
            negative: { enabled: false, penalty: 0 },
          },
        ],
      ]),
    };

    const buffer = await buildAssessmentWorkbook(
      [
        assessmentRow({}),
        assessmentRow({
          id: 'reg-bea:english-6',
          registrationId: 'reg-bea',
          code: 'BP-2',
          name: 'Bea',
          email: 'bea@example.com',
          attemptStatus: 'not_started',
          attemptsStarted: 0,
          bestAttemptId: null,
          resultId: null,
          score: null,
          percent: null,
          result: null,
          correct: null,
          skipped: null,
          negative: null,
          timeTakenSeconds: null,
          submittedAt: null,
          autoSubmitted: null,
          autoSubmitReason: null,
        }),
        assessmentRow({
          id: 'reg-cody:maths-6',
          registrationId: 'reg-cody',
          roundId: 'maths-6',
          roundName: 'Mathematics',
          roundOrder: 2,
          code: 'BP-3',
          name: 'Cody',
          email: 'cody@example.com',
          passMode: 'score',
          passingPercent: 80,
          passingScore: 1.5,
          bestAttemptId: 'attempt-cody',
          score: 0,
          maxScore: 2,
          percent: 0,
          result: 'fail',
          questionCount: 1,
          correct: 0,
          skipped: 0,
          negative: 0.5,
          autoSubmitted: false,
          autoSubmitReason: null,
        }),
        assessmentRow({
          id: 'reg-nia:english-7',
          registrationId: 'reg-nia',
          roundId: 'english-7',
          roundName: 'English',
          roundOrder: 1,
          activityId: 'grade-7',
          assessmentName: 'Grade 7',
          code: 'BP-4',
          name: 'Nia',
          email: 'nia@example.com',
          bestAttemptId: 'attempt-nia',
          autoSubmitted: false,
          autoSubmitReason: null,
        }),
      ],
      context,
    );

    const workbook = await loadWorkbook(buffer);
    assert.deepEqual(
      workbook.worksheets.map((sheet) => sheet.name),
      ['Grade 6 English', 'Mathematics', 'Grade 7 English'],
    );

    const english = workbook.getWorksheet('Grade 6 English')!;
    assert.equal(english.views[0]?.state, 'frozen');
    assert.equal(english.views[0]?.ySplit, 1);
    const headers = headersOf(english);
    assert.equal(headers.includes('Browser'), false);
    assert.equal(headers.includes('Device'), false);
    assert.equal(headers.includes('IP Address'), false);
    assert.deepEqual(headers.slice(-12), [
      'Q1 Question Text',
      'Q1 Student Answer',
      'Q1 Correct Answer',
      'Q1 Marks',
      'Q2 Question Text',
      'Q2 Student Answer',
      'Q2 Correct Answer',
      'Q2 Marks',
      'Q3 Question Text',
      'Q3 Student Answer',
      'Q3 Correct Answer',
      'Q3 Marks',
    ]);

    assert.equal(cell(english, 2, 'Registration ID'), 'BP-1');
    assert.equal(cell(english, 2, 'Course'), 'BSc');
    assert.equal(cell(english, 2, 'Cohort'), '2026');
    assert.equal(cell(english, 2, 'City'), 'Pune');
    assert.equal(cell(english, 2, 'Assessment'), 'Grade 6');
    assert.equal(cell(english, 2, 'Round'), 'English');
    assert.equal(cell(english, 2, 'Started at'), '2026-11-01 15:30:00');
    assert.equal(cell(english, 2, 'Submitted'), '2026-11-01 15:40:00');
    assert.equal(cell(english, 2, 'Time taken'), '00:10:00');
    assert.equal(cell(english, 2, 'Allowed time'), '45 min');
    assert.equal(cell(english, 2, 'Auto-submitted'), 'Yes (Timer ran out)');
    assert.equal(cell(english, 2, 'Pass mark'), '40%');
    assert.equal(cell(english, 2, 'Disqualified'), 'No');
    assert.equal(cell(english, 2, 'Q1 Question Text'), 'Alpha');
    assert.equal(cell(english, 2, 'Q1 Student Answer'), 'A. Yes');
    assert.equal(cell(english, 2, 'Q1 Correct Answer'), 'A. Yes');
    assert.equal(cell(english, 2, 'Q1 Marks'), '2');
    assert.equal(cell(english, 2, 'Q2 Question Text'), 'Beta');
    assert.equal(cell(english, 2, 'Q2 Student Answer'), 'Not answered');
    assert.equal(cell(english, 2, 'Q2 Marks'), '');
    assert.equal(cell(english, 2, 'Q3 Student Answer'), 'hello');
    assert.equal(cell(english, 2, 'Q3 Correct Answer'), '');
    assert.equal(cell(english, 2, 'Q3 Marks'), '');

    assert.equal(cell(english, 3, 'Participant Name'), 'Bea');
    assert.equal(cell(english, 3, 'Marks scored'), '');
    assert.equal(cell(english, 3, 'Started at'), '');
    assert.equal(cell(english, 3, 'Attempt status'), 'Not started');
    assert.equal(cell(english, 3, 'Disqualified'), '');
    assert.equal(cell(english, 3, 'Q1 Question Text'), 'Alpha');
    assert.equal(cell(english, 3, 'Q1 Correct Answer'), 'A. Yes');
    assert.equal(cell(english, 3, 'Q1 Student Answer'), '');
    assert.equal(cell(english, 3, 'Q1 Marks'), '');
    assert.equal(cell(english, 3, 'Q2 Student Answer'), '');

    const maths = workbook.getWorksheet('Mathematics')!;
    assert.equal(cell(maths, 2, 'Pass mark'), '1.5');
    assert.equal(cell(maths, 2, 'Allowed time'), '30 min');
    assert.equal(cell(maths, 2, 'Q1 Student Answer'), 'B. No');
    assert.equal(cell(maths, 2, 'Q1 Correct Answer'), 'A. Yes');
    assert.equal(cell(maths, 2, 'Q1 Marks'), '-0.5');
    assert.equal(
      headersOf(maths).some((header) => header.startsWith('Q2')),
      false,
    );

    const grade7 = workbook.getWorksheet('Grade 7 English')!;
    assert.equal(cell(grade7, 2, 'Allowed time'), '20 s each');
    assert.equal(cell(grade7, 2, 'Q1 Student Answer'), 'A. Yes');
  });

  it('puts each quiz on its own sheet and leaves an empty download as headers only', async () => {
    const context: QuizExportContext = {
      profiles: new Map([['reg-ada', { course: null, cohort: 'A', city: null }]]),
      attempts: new Map([
        [
          'attempt-ada',
          {
            startedAt: STARTED,
            disqualified: false,
            questionIds: ['vb', 'va'],
            answers: new Map<string, unknown>([
              ['va', { label: 'A' }],
              ['vb', { label: 'B' }],
            ]),
          },
        ],
      ]),
      questions: questions(),
      activities: new Map([
        [
          'quiz-north',
          {
            timing: { durationMode: 'overall', durationMinutes: 20, perQuestionSeconds: null },
            negative: { enabled: true, penalty: 0 },
          },
        ],
        [
          'quiz-south',
          {
            timing: { durationMode: 'per_question', durationMinutes: null, perQuestionSeconds: 30 },
            negative: { enabled: false, penalty: 0 },
          },
        ],
      ]),
    };

    const buffer = await buildReportWorkbook(
      [
        quizRow({}),
        quizRow({
          registrationId: 'reg-bea',
          activityId: 'quiz-south',
          contestId: 'south',
          contestName: 'South',
          code: 'BP-2',
          name: 'Bea',
          email: 'bea@example.com',
          attemptStatus: 'not_started',
          attemptsStarted: 0,
          bestAttemptId: null,
          resultId: null,
          score: null,
          percent: null,
          result: null,
          correct: null,
          skipped: null,
          negative: null,
          timeTakenSeconds: null,
          submittedAt: null,
          autoSubmitted: null,
          autoSubmitReason: null,
        }),
      ],
      context,
    );
    const workbook = await loadWorkbook(buffer);
    assert.deepEqual(
      workbook.worksheets.map((sheet) => sheet.name),
      ['North Weekly', 'South Weekly'],
    );
    const north = workbook.getWorksheet('North Weekly')!;
    const headers = headersOf(north);
    assert.equal(headers.includes('Round'), false);
    assert.equal(headers.includes('Browser'), false);
    assert.equal(cell(north, 2, 'Contest'), 'North');
    assert.equal(cell(north, 2, 'Quiz'), 'Weekly');
    assert.equal(cell(north, 2, 'Cohort'), 'A');
    assert.equal(cell(north, 2, 'Allowed time'), '20 min');
    assert.equal(cell(north, 2, 'Pass mark'), '40%');
    assert.equal(cell(north, 2, 'Time taken'), '00:10:00');
    assert.equal(cell(north, 2, 'Q1 Question Text'), 'Alpha');
    assert.equal(cell(north, 2, 'Q1 Marks'), '2');
    assert.equal(cell(north, 2, 'Q2 Student Answer'), 'B');
    assert.equal(cell(north, 2, 'Q2 Marks'), '0');

    const south = workbook.getWorksheet('South Weekly')!;
    assert.equal(cell(south, 2, 'Allowed time'), '30 s each');
    assert.equal(cell(south, 2, 'Marks scored'), '');
    assert.equal(
      headersOf(south).some((header) => header.startsWith('Q1')),
      false,
    );

    const empty = await loadWorkbook(
      await buildReportWorkbook([], {
        profiles: new Map(),
        attempts: new Map(),
        questions: new Map(),
        activities: new Map(),
      }),
    );
    assert.deepEqual(
      empty.worksheets.map((sheet) => sheet.name),
      ['Results'],
    );
    assert.equal(empty.getWorksheet('Results')!.rowCount, 1);
    assert.equal(headersOf(empty.getWorksheet('Results')!).includes('Quiz'), true);
  });
});

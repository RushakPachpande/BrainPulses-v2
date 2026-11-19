import {
  allowedTimeLabel,
  assignSheetNames,
  attemptStatusLabel,
  attemptsUsedLabel,
  autoSubmittedLabel,
  blankNumber,
  formatClock,
  formatIst,
  passMarkLabel,
  type AttemptAnswers,
  type ExportQuestion,
  type NegativeMarking,
  type ParticipantProfile,
  type ReportSheet,
  type SummaryHeader,
  type Timing,
  writeReportWorkbook,
  yesNo,
} from '../../lib/report-workbook.js';
import { AUTO_SUBMIT_REASON_LABEL, type ReportRow, type ReportSortKey } from './rows.js';

export const REPORT_COLUMNS: { key: ReportSortKey; label: string }[] = [
  { key: 'code', label: 'Registration ID' },
  { key: 'name', label: 'Participant Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'contest', label: 'Contest' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'attemptsUsed', label: 'Attempts used' },
  { key: 'score', label: 'Marks scored' },
  { key: 'maxScore', label: 'Total marks' },
  { key: 'percent', label: '%' },
  { key: 'result', label: 'Result' },
  { key: 'correct', label: 'No. of correct answers' },
  { key: 'questionCount', label: 'Total no. of questions' },
  { key: 'skipped', label: 'No. of skipped questions' },
  { key: 'negative', label: 'Negative marks' },
  { key: 'timeTaken', label: 'Time taken' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'autoSubmitted', label: 'Auto-submitted' },
  { key: 'attemptStatus', label: 'Attempt status' },
];

export type QuizActivityExport = {
  timing: Timing;
  negative: NegativeMarking;
};

export type QuizExportContext = {
  profiles: Map<string, ParticipantProfile>;
  attempts: Map<string, AttemptAnswers>;
  questions: Map<string, ExportQuestion>;
  activities: Map<string, QuizActivityExport>;
};

const SUMMARY_HEADERS: SummaryHeader[] = [
  { header: 'Registration ID', width: 18 },
  { header: 'Participant Name', width: 22 },
  { header: 'Email', width: 28 },
  { header: 'Phone', width: 16 },
  { header: 'Course', width: 16 },
  { header: 'Cohort', width: 14 },
  { header: 'City', width: 16 },
  { header: 'Contest', width: 18 },
  { header: 'Quiz', width: 22 },
  { header: 'Started at', width: 22 },
  { header: 'Submitted', width: 22 },
  { header: 'Time taken', width: 14 },
  { header: 'Allowed time', width: 16 },
  { header: 'Auto-submitted', width: 28 },
  { header: 'Marks scored', width: 14 },
  { header: 'Total marks', width: 14 },
  { header: '%', width: 10 },
  { header: 'Pass mark', width: 12 },
  { header: 'Result', width: 10 },
  { header: 'Correct', width: 12 },
  { header: 'Total questions', width: 16 },
  { header: 'Skipped', width: 12 },
  { header: 'Negative marks', width: 16 },
  { header: 'Attempts used', width: 16 },
  { header: 'Attempt status', width: 16 },
  { header: 'Disqualified', width: 14 },
];

export function parseExportColumns(value: string): ReportSortKey[] {
  const allowed = new Map(REPORT_COLUMNS.map((column) => [column.key, column]));
  const keys: ReportSortKey[] = [];
  for (const part of value.split(',')) {
    const key = part.trim() as ReportSortKey;
    if (!allowed.has(key) || keys.includes(key)) continue;
    keys.push(key);
  }
  return keys;
}

function text(value: string | null | undefined): string {
  return value ?? '';
}

function summaryCells(row: ReportRow, context: QuizExportContext): (string | number)[] {
  const profile = context.profiles.get(row.registrationId);
  const attempt = row.bestAttemptId ? context.attempts.get(row.bestAttemptId) : undefined;
  const activity = context.activities.get(row.activityId);
  const scored = row.score != null;
  return [
    row.code,
    row.name,
    row.email,
    text(row.phone),
    text(profile?.course),
    text(profile?.cohort),
    text(profile?.city),
    text(row.contestName),
    row.quizName,
    formatIst(attempt?.startedAt),
    scored ? formatIst(row.submittedAt) : '',
    scored ? formatClock(row.timeTakenSeconds) : '',
    allowedTimeLabel(activity?.timing),
    autoSubmittedLabel(row.autoSubmitted, row.autoSubmitReason, AUTO_SUBMIT_REASON_LABEL),
    blankNumber(row.score),
    row.maxScore ?? 0,
    row.percent == null ? '' : `${row.percent}%`,
    passMarkLabel('percent', row.passingPercent, null),
    row.result == null ? '' : row.result === 'pass' ? 'Pass' : 'Fail',
    blankNumber(row.correct),
    row.questionCount,
    blankNumber(row.skipped),
    blankNumber(row.negative),
    attemptsUsedLabel(row.attemptsStarted, row.attemptsAllowed),
    attemptStatusLabel(row.attemptStatus),
    attempt ? yesNo(attempt.disqualified) : '',
  ];
}

function fileSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

/** `quiz-<name>-report`, or `quiz-report` when the file covers more than one. */
export function reportFileBase(quizName: string | null): string {
  const name = fileSlug(quizName ?? '');
  return name ? `quiz-${name}-report` : 'quiz-report';
}

function sheetGroups(rows: ReportRow[]) {
  const groups = new Map<string, { name: string; qualifier: string; rows: ReportRow[] }>();
  for (const row of rows) {
    const current = groups.get(row.activityId);
    if (current) {
      current.rows.push(row);
      continue;
    }
    groups.set(row.activityId, {
      name: row.quizName,
      qualifier: row.contestName ?? '',
      rows: [row],
    });
  }
  return [...groups.values()].sort((a, b) => {
    const name = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (name !== 0) return name;
    return a.qualifier.localeCompare(b.qualifier, undefined, { sensitivity: 'base' });
  });
}

export async function buildReportWorkbook(
  rows: ReportRow[],
  context: QuizExportContext,
): Promise<Buffer> {
  const groups = sheetGroups(rows);
  const names = assignSheetNames(
    groups.map((group) => ({ name: group.name, qualifier: group.qualifier })),
  );
  const sheets: ReportSheet[] = groups.map((group, index) => ({
    sheetName: names[index] ?? group.name,
    negative: context.activities.get(group.rows[0]?.activityId ?? '')?.negative ?? {
      enabled: false,
      penalty: 0,
    },
    lines: group.rows.map((row) => {
      const attempt = row.bestAttemptId ? context.attempts.get(row.bestAttemptId) : undefined;
      return {
        summary: summaryCells(row, context),
        questionIds: attempt?.questionIds ?? [],
        answers: attempt?.answers ?? new Map(),
      };
    }),
  }));
  return writeReportWorkbook({
    summaryHeaders: SUMMARY_HEADERS,
    sheets,
    questions: context.questions,
  });
}

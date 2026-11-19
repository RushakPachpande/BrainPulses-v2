import { AUTO_SUBMIT_REASON_LABEL } from '../quiz-reports/rows.js';
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
import type { AssessmentReportRow, AssessmentSortKey } from './rows.js';

export const ASSESSMENT_COLUMNS: { key: AssessmentSortKey; label: string }[] = [
  { key: 'code', label: 'Registration ID' },
  { key: 'name', label: 'Participant Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'round', label: 'Round' },
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

const REASON_LABEL = {
  ...AUTO_SUBMIT_REASON_LABEL,
  quiz_ended: 'Assessment ended',
  quiz_deactivated: 'Assessment deactivated',
} as const;

export type AssessmentRoundExport = {
  timing: Timing;
  negative: NegativeMarking;
};

export type AssessmentExportContext = {
  profiles: Map<string, ParticipantProfile>;
  attempts: Map<string, AttemptAnswers>;
  questions: Map<string, ExportQuestion>;
  rounds: Map<string, AssessmentRoundExport>;
};

const SUMMARY_HEADERS: SummaryHeader[] = [
  { header: 'Registration ID', width: 18 },
  { header: 'Participant Name', width: 22 },
  { header: 'Email', width: 28 },
  { header: 'Phone', width: 16 },
  { header: 'Course', width: 16 },
  { header: 'Cohort', width: 14 },
  { header: 'City', width: 16 },
  { header: 'Assessment', width: 22 },
  { header: 'Round', width: 18 },
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

export function parseAssessmentColumns(value: string): AssessmentSortKey[] {
  const allowed = new Set(ASSESSMENT_COLUMNS.map((column) => column.key));
  const keys: AssessmentSortKey[] = [];
  for (const part of value.split(',')) {
    const key = part.trim() as AssessmentSortKey;
    if (!allowed.has(key) || keys.includes(key)) continue;
    keys.push(key);
  }
  return keys;
}

function text(value: string | null | undefined): string {
  return value ?? '';
}

function summaryCells(
  row: AssessmentReportRow,
  context: AssessmentExportContext,
): (string | number)[] {
  const profile = context.profiles.get(row.registrationId);
  const attempt = row.bestAttemptId ? context.attempts.get(row.bestAttemptId) : undefined;
  const round = context.rounds.get(row.roundId);
  const scored = row.score != null;
  return [
    row.code,
    row.name,
    row.email,
    text(row.phone),
    text(profile?.course),
    text(profile?.cohort),
    text(profile?.city),
    row.assessmentName,
    row.roundName,
    formatIst(attempt?.startedAt),
    scored ? formatIst(row.submittedAt) : '',
    scored ? formatClock(row.timeTakenSeconds) : '',
    allowedTimeLabel(round?.timing),
    autoSubmittedLabel(row.autoSubmitted, row.autoSubmitReason, REASON_LABEL),
    blankNumber(row.score),
    row.maxScore ?? 0,
    row.percent == null ? '' : `${row.percent}%`,
    passMarkLabel(row.passMode, row.passingPercent, row.passingScore),
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

/** `assessment-<name>-report`, or `assessment-report` when the file covers more than one. */
export function assessmentFileBase(assessmentName: string | null) {
  const name = fileSlug(assessmentName ?? '');
  return name ? `assessment-${name}-report` : 'assessment-report';
}

function sheetGroups(rows: AssessmentReportRow[]) {
  const groups = new Map<
    string,
    {
      name: string;
      qualifier: string;
      assessmentName: string;
      roundOrder: number;
      rows: AssessmentReportRow[];
    }
  >();
  for (const row of rows) {
    const current = groups.get(row.roundId);
    if (current) {
      current.rows.push(row);
      continue;
    }
    groups.set(row.roundId, {
      name: row.roundName,
      qualifier: row.assessmentName,
      assessmentName: row.assessmentName,
      roundOrder: row.roundOrder,
      rows: [row],
    });
  }
  return [...groups.values()].sort((a, b) => {
    const name = a.assessmentName.localeCompare(b.assessmentName, undefined, {
      sensitivity: 'base',
    });
    if (name !== 0) return name;
    if (a.roundOrder !== b.roundOrder) return a.roundOrder - b.roundOrder;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export async function buildAssessmentWorkbook(
  rows: AssessmentReportRow[],
  context: AssessmentExportContext,
): Promise<Buffer> {
  const groups = sheetGroups(rows);
  const names = assignSheetNames(
    groups.map((group) => ({ name: group.name, qualifier: group.qualifier })),
  );
  const sheets: ReportSheet[] = groups.map((group, index) => ({
    sheetName: names[index] ?? group.name,
    negative: context.rounds.get(group.rows[0]?.roundId ?? '')?.negative ?? {
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

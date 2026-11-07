import ExcelJS from 'exceljs';
import { sanitizeCsvCell } from '../../lib/csv.js';
import { AUTO_SUBMIT_REASON_LABEL, formatDuration, formatMarks } from '../quiz-reports/rows.js';
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

const SCORE_KEYS = new Set<AssessmentSortKey>([
  'score',
  'percent',
  'result',
  'correct',
  'skipped',
  'negative',
  'timeTaken',
  'submitted',
  'autoSubmitted',
]);

const REASON_LABEL = {
  ...AUTO_SUBMIT_REASON_LABEL,
  quiz_ended: 'Assessment ended',
  quiz_deactivated: 'Assessment deactivated',
} as const;

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

function attemptsLabel(row: AssessmentReportRow): string {
  const allowed = row.attemptsAllowed == null ? 'Unlimited' : String(row.attemptsAllowed);
  return `${row.attemptsStarted} of ${allowed}`;
}

function statusLabel(status: AssessmentReportRow['attemptStatus']): string {
  if (status === 'completed') return 'Completed';
  if (status === 'in_progress') return 'In progress';
  return 'Not started';
}

function cell(row: AssessmentReportRow, key: AssessmentSortKey): string | number {
  if (row.score == null && SCORE_KEYS.has(key)) return '';
  switch (key) {
    case 'code':
      return row.code;
    case 'name':
      return row.name;
    case 'email':
      return row.email;
    case 'phone':
      return row.phone ?? '';
    case 'assessment':
      return row.assessmentName;
    case 'round':
      return row.roundName;
    case 'attemptsUsed':
      return attemptsLabel(row);
    case 'score':
      return row.score == null ? '' : formatMarks(row.score);
    case 'maxScore':
      return formatMarks(row.maxScore ?? 0);
    case 'percent':
      return row.percent == null ? '' : `${row.percent}%`;
    case 'result':
      return row.result == null ? '' : row.result === 'pass' ? 'Pass' : 'Fail';
    case 'correct':
      return row.correct ?? '';
    case 'questionCount':
      return row.questionCount;
    case 'skipped':
      return row.skipped ?? '';
    case 'negative':
      return row.negative ?? '';
    case 'timeTaken':
      return row.timeTakenSeconds == null ? '' : formatDuration(row.timeTakenSeconds);
    case 'submitted':
      return row.submittedAt ?? '';
    case 'autoSubmitted':
      if (row.autoSubmitted == null) return '';
      if (!row.autoSubmitted) return 'No';
      return row.autoSubmitReason ? `Yes (${REASON_LABEL[row.autoSubmitReason]})` : 'Yes';
    case 'attemptStatus':
      return statusLabel(row.attemptStatus);
    default:
      return '';
  }
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'assessment'
  );
}

export function assessmentFileBase(assessmentName: string | null, roundName: string | null) {
  if (!assessmentName) return 'BrainPulses-assessment-results';
  const base = `BrainPulses-assessment-results-${slug(assessmentName)}`;
  return roundName ? `${base}-${slug(roundName)}` : base;
}

export async function buildAssessmentWorkbook(
  rows: AssessmentReportRow[],
  columns: AssessmentSortKey[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Results');
  const defs = columns.map((key) => ASSESSMENT_COLUMNS.find((column) => column.key === key)!);
  sheet.addRow(defs.map((column) => column.label));
  for (const row of rows) sheet.addRow(columns.map((key) => cell(row, key)));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function csvField(value: string | number): string {
  if (typeof value === 'number') return String(value);
  const text = sanitizeCsvCell(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildAssessmentCsv(rows: AssessmentReportRow[], columns: AssessmentSortKey[]) {
  const defs = columns.map((key) => ASSESSMENT_COLUMNS.find((column) => column.key === key)!);
  const lines = [defs.map((column) => csvField(column.label)).join(',')];
  for (const row of rows) lines.push(columns.map((key) => csvField(cell(row, key))).join(','));
  return `\uFEFF${lines.join('\r\n')}`;
}

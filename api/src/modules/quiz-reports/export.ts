import ExcelJS from 'exceljs';
import { sanitizeCsvCell } from '../../lib/csv.js';
import {
  AUTO_SUBMIT_REASON_LABEL,
  formatDuration,
  formatMarks,
  type ReportRow,
  type ReportSortKey,
} from './rows.js';

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

const SCORE_KEYS = new Set<ReportSortKey>([
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

function attemptsLabel(row: ReportRow): string {
  const allowed = row.attemptsAllowed == null ? 'Unlimited' : String(row.attemptsAllowed);
  return `${row.attemptsStarted} of ${allowed}`;
}

function statusLabel(status: ReportRow['attemptStatus']): string {
  if (status === 'completed') return 'Completed';
  if (status === 'in_progress') return 'In progress';
  return 'Not started';
}

function cell(row: ReportRow, key: ReportSortKey): string | number {
  const blankScore = row.score == null;
  if (blankScore && SCORE_KEYS.has(key)) return '';
  switch (key) {
    case 'code':
      return row.code;
    case 'name':
      return row.name;
    case 'email':
      return row.email;
    case 'phone':
      return row.phone ?? '';
    case 'contest':
      return row.contestName ?? '';
    case 'quiz':
      return row.quizName;
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
      return row.autoSubmitReason
        ? `Yes (${AUTO_SUBMIT_REASON_LABEL[row.autoSubmitReason]})`
        : 'Yes';
    case 'attemptStatus':
      return statusLabel(row.attemptStatus);
    default:
      return '';
  }
}

export function reportFileBase(quizName: string | null): string {
  if (!quizName) return 'BrainPulses-results';
  const slug = quizName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `BrainPulses-results-${slug || 'quiz'}`;
}

export async function buildReportWorkbook(
  rows: ReportRow[],
  columns: ReportSortKey[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Results');
  const defs = columns.map((key) => REPORT_COLUMNS.find((column) => column.key === key)!);
  sheet.addRow(defs.map((column) => column.label));
  for (const row of rows) {
    sheet.addRow(columns.map((key) => cell(row, key)));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function csvField(value: string | number): string {
  if (typeof value === 'number') return String(value);
  const text = sanitizeCsvCell(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildReportCsv(rows: ReportRow[], columns: ReportSortKey[]): string {
  const defs = columns.map((key) => REPORT_COLUMNS.find((column) => column.key === key)!);
  const lines = [defs.map((column) => csvField(column.label)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((key) => csvField(cell(row, key))).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

import type { QuizAttemptStatus, QuizAutoReason, QuizReportRow } from '@/services/quiz-reports';

export const REPORT_COLUMNS = [
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
] as const;

export type ReportColumnKey = (typeof REPORT_COLUMNS)[number]['key'];

const DEFAULT_HIDDEN = new Set<ReportColumnKey>(['contest', 'skipped', 'negative']);

export function defaultColumns(): ReportColumnKey[] {
  return REPORT_COLUMNS.map((column) => column.key).filter((key) => !DEFAULT_HIDDEN.has(key));
}

export function columnStorageKey(userId: string) {
  return `bp-quiz-report-columns:${userId}`;
}

export function readStoredColumns(userId: string): ReportColumnKey[] {
  try {
    const raw = localStorage.getItem(columnStorageKey(userId));
    if (!raw) return defaultColumns();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultColumns();
    const allowed = new Set(REPORT_COLUMNS.map((column) => column.key));
    const keys = parsed.filter((key): key is ReportColumnKey =>
      allowed.has(key as ReportColumnKey),
    );
    return keys.length > 0 ? keys : defaultColumns();
  } catch {
    return defaultColumns();
  }
}

export function formatMarks(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function formatReportDate(iso: string): string {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
  return formatted.replace(/\b(am|pm)\b/gi, (part) => part.toUpperCase());
}

export function attemptsLabel(started: number, allowed: number | null): string {
  return `${started} of ${allowed == null ? 'Unlimited' : allowed}`;
}

export function attemptStatusLabel(status: QuizAttemptStatus): string {
  if (status === 'completed') return 'Completed';
  if (status === 'in_progress') return 'In progress';
  return 'Not started';
}

export function percentClass(percent: number, passing: number | null): string {
  const base = 'font-semibold tabular-nums';
  if (passing == null) return base;
  if (percent >= passing) return `${base} text-success`;
  if (percent >= passing - 10) return `${base} text-warning`;
  return `${base} text-destructive`;
}

export const AUTO_REASON_LABEL: Record<QuizAutoReason, string> = {
  timer: 'Timer ran out',
  quiz_ended: 'Quiz ended',
  quiz_deactivated: 'Quiz deactivated',
};

export function negativeLabel(value: number): string {
  if (value === 0) return '0';
  return `−${formatMarks(Math.abs(value))}`;
}

export function signedMarks(value: number): string {
  if (value > 0) return `+${formatMarks(value)}`;
  return negativeLabel(value);
}

export function rowHasScore(row: Pick<QuizReportRow, 'score'>): boolean {
  return row.score != null;
}

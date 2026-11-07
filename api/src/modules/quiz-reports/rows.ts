import { activityStatusDisplay, type ActivityStatusDisplay } from '../../lib/activity-status.js';

export type ReportQuizStatus = 'active' | 'expired' | 'inactive' | 'other';

export type AttemptSnapshot = {
  id: string;
  status: 'in_progress' | 'submitted' | 'auto_submitted';
  startedAt: string;
  submittedAt: string | null;
  createdAt: string;
  disqualified: boolean;
  autoSubmitReason: 'timer' | 'quiz_ended' | 'quiz_deactivated' | null;
  score: number | null;
  maxScore: number | null;
  questionCount: number;
  resultId: string | null;
};

export type ReportSource = {
  registrationId: string;
  registeredAt: string;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  activityId: string;
  quizName: string;
  contestId: string | null;
  contestName: string | null;
  displayStatus: ActivityStatusDisplay;
  passingPercent: number | null;
  scoreRelease: 'after_submit' | 'after_publish';
  resultsPublishedAt: string | null;
  maxAttempts: number | null;
  grantCount: number;
  quizQuestionCount: number;
  quizMaxScore: number;
  attempts: AttemptSnapshot[];
};

export type AttemptStatusLabel = 'completed' | 'in_progress' | 'not_started';
export type ResultLabel = 'pass' | 'fail';

export type ReportRow = {
  registrationId: string;
  registeredAt: string;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  activityId: string;
  quizName: string;
  contestId: string | null;
  contestName: string | null;
  quizStatus: ReportQuizStatus;
  displayStatus: ActivityStatusDisplay;
  passingPercent: number | null;
  scoreRelease: 'after_submit' | 'after_publish';
  resultsPublishedAt: string | null;
  attemptStatus: AttemptStatusLabel;
  attemptsStarted: number;
  attemptsAllowed: number | null;
  bestAttemptId: string | null;
  resultId: string | null;
  score: number | null;
  maxScore: number | null;
  percent: number | null;
  result: ResultLabel | null;
  questionCount: number;
  correct: number | null;
  skipped: number | null;
  negative: number | null;
  timeTakenSeconds: number | null;
  submittedAt: string | null;
  autoSubmitted: boolean | null;
  autoSubmitReason: AttemptSnapshot['autoSubmitReason'];
};

export type ReportQuery = {
  q: string;
  contestId?: string;
  activityId?: string;
  quizStatus: 'any' | 'active' | 'expired' | 'inactive';
  attemptStatus: 'any' | AttemptStatusLabel;
  autoSubmitted: 'any' | 'yes' | 'no';
  sort: ReportSortKey;
  dir: 'asc' | 'desc';
};

export type ReportSortKey =
  | 'code'
  | 'name'
  | 'email'
  | 'phone'
  | 'contest'
  | 'quiz'
  | 'attemptsUsed'
  | 'score'
  | 'maxScore'
  | 'percent'
  | 'result'
  | 'correct'
  | 'questionCount'
  | 'skipped'
  | 'negative'
  | 'timeTaken'
  | 'submitted'
  | 'autoSubmitted'
  | 'attemptStatus';

export type ScoreBreakdown = {
  correct: number;
  wrong: number;
  skipped: number;
  negative: number;
};

export function reportQuizStatus(display: ActivityStatusDisplay): ReportQuizStatus {
  if (display === 'Active') return 'active';
  if (display === 'Expired') return 'expired';
  if (display === 'Archived') return 'inactive';
  return 'other';
}

export function displayStatusOf(
  status: string,
  startsAt: Date | null,
  endsAt: Date | null,
): ActivityStatusDisplay {
  return activityStatusDisplay(status, startsAt, endsAt);
}

export function wholePercent(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.round((score / maxScore) * 100);
}

export function pickBestAttempt(attempts: AttemptSnapshot[]): AttemptSnapshot | null {
  const eligible = attempts.filter(
    (attempt) =>
      (attempt.status === 'submitted' || attempt.status === 'auto_submitted') &&
      !attempt.disqualified &&
      attempt.score != null,
  );
  eligible.sort((a, b) => {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    const aTime = a.submittedAt ?? a.createdAt;
    const bTime = b.submittedAt ?? b.createdAt;
    if (aTime !== bTime) return aTime < bTime ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  return eligible[0] ?? null;
}

export function classifyAttemptStatus(
  attempts: AttemptSnapshot[],
  quizIsActive: boolean,
): AttemptStatusLabel {
  const submitted = attempts.some(
    (attempt) => attempt.status === 'submitted' || attempt.status === 'auto_submitted',
  );
  if (submitted) return 'completed';
  const open = attempts.some((attempt) => attempt.status === 'in_progress');
  if (open && quizIsActive) return 'in_progress';
  return 'not_started';
}

export function attemptsAllowed(maxAttempts: number | null, grantCount: number): number | null {
  if (maxAttempts == null) return null;
  return maxAttempts + grantCount;
}

export function buildReportRow(source: ReportSource, breakdown?: ScoreBreakdown | null): ReportRow {
  const quizIsActive = source.displayStatus === 'Active';
  const attemptStatus = classifyAttemptStatus(source.attempts, quizIsActive);
  const best = pickBestAttempt(source.attempts);
  const scored = best != null && best.score != null && best.maxScore != null;
  const percent = scored ? wholePercent(best.score ?? 0, best.maxScore ?? 0) : null;
  const result =
    percent == null || source.passingPercent == null
      ? null
      : percent >= source.passingPercent
        ? 'pass'
        : 'fail';
  let timeTakenSeconds: number | null = null;
  if (best?.submittedAt) {
    const elapsed = Math.round((Date.parse(best.submittedAt) - Date.parse(best.startedAt)) / 1000);
    timeTakenSeconds = Math.max(0, elapsed);
  }
  const questionCount =
    best && best.questionCount > 0 ? best.questionCount : source.quizQuestionCount;
  const maxScore = scored ? best.maxScore : source.quizMaxScore;

  return {
    registrationId: source.registrationId,
    registeredAt: source.registeredAt,
    code: source.code,
    name: source.name,
    email: source.email,
    phone: source.phone,
    activityId: source.activityId,
    quizName: source.quizName,
    contestId: source.contestId,
    contestName: source.contestName,
    quizStatus: reportQuizStatus(source.displayStatus),
    displayStatus: source.displayStatus,
    passingPercent: source.passingPercent,
    scoreRelease: source.scoreRelease,
    resultsPublishedAt: source.resultsPublishedAt,
    attemptStatus,
    attemptsStarted: source.attempts.length,
    attemptsAllowed: attemptsAllowed(source.maxAttempts, source.grantCount),
    bestAttemptId: best?.id ?? null,
    resultId: best?.resultId ?? null,
    score: scored ? best.score : null,
    maxScore,
    percent,
    result,
    questionCount,
    correct: scored && breakdown ? breakdown.correct : null,
    skipped: scored && breakdown ? breakdown.skipped : null,
    negative: scored && breakdown ? breakdown.negative : null,
    timeTakenSeconds,
    submittedAt: best?.submittedAt ?? null,
    autoSubmitted: best == null ? null : best.status === 'auto_submitted',
    autoSubmitReason: best?.status === 'auto_submitted' ? best.autoSubmitReason : null,
  };
}

export function filterReportRows(rows: ReportRow[], query: ReportQuery): ReportRow[] {
  const q = query.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (q && !row.code.toLowerCase().includes(q) && !row.name.toLowerCase().includes(q)) {
      return false;
    }
    if (query.contestId && row.contestId !== query.contestId) return false;
    if (query.activityId && row.activityId !== query.activityId) return false;
    if (query.quizStatus !== 'any' && row.quizStatus !== query.quizStatus) return false;
    if (query.attemptStatus !== 'any' && row.attemptStatus !== query.attemptStatus) return false;
    if (query.autoSubmitted === 'yes' && row.autoSubmitted !== true) return false;
    if (query.autoSubmitted === 'no' && row.autoSubmitted !== false) return false;
    return true;
  });
}

function tie(a: ReportRow, b: ReportRow): number {
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  if (byName !== 0) return byName;
  return a.code.localeCompare(b.code, undefined, { numeric: true });
}

function sortValue(row: ReportRow, key: ReportSortKey): string | number | null {
  switch (key) {
    case 'code':
      return row.code;
    case 'name':
      return row.name;
    case 'email':
      return row.email;
    case 'phone':
      return row.phone;
    case 'contest':
      return row.contestName;
    case 'quiz':
      return row.quizName;
    case 'attemptsUsed':
      return row.attemptsStarted;
    case 'score':
      return row.score;
    case 'maxScore':
      return row.maxScore;
    case 'percent':
      return row.percent;
    case 'result':
      return row.result;
    case 'correct':
      return row.correct;
    case 'questionCount':
      return row.questionCount;
    case 'skipped':
      return row.skipped;
    case 'negative':
      return row.negative;
    case 'timeTaken':
      return row.timeTakenSeconds;
    case 'submitted':
      return row.submittedAt;
    case 'autoSubmitted':
      return row.autoSubmitted == null ? null : row.autoSubmitted ? 'yes' : 'no';
    case 'attemptStatus':
      return row.attemptStatus;
    default:
      return null;
  }
}

export function sortReportRows(
  rows: ReportRow[],
  key: ReportSortKey,
  dir: 'asc' | 'desc',
): ReportRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);
    const aEmpty = av == null || av === '';
    const bEmpty = bv == null || bv === '';
    if (aEmpty || bEmpty) {
      if (aEmpty && bEmpty) return tie(a, b);
      return aEmpty ? 1 : -1;
    }
    const cmp =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { sensitivity: 'base', numeric: true });
    if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
    return tie(a, b);
  });
  return copy;
}

export type ReportSummary = {
  registered: number;
  completed: number;
  notStarted: number;
  averageScore: number | null;
  passRate: number | null;
};

export function summarizeReportRows(rows: ReportRow[]): ReportSummary {
  const completed = rows.filter((row) => row.attemptStatus === 'completed');
  const scored = completed.filter((row) => row.percent != null);
  const averageScore =
    scored.length === 0
      ? null
      : Math.round(scored.reduce((sum, row) => sum + (row.percent ?? 0), 0) / scored.length);
  const passRate =
    completed.length === 0
      ? null
      : Math.round(
          (completed.filter((row) => row.result === 'pass').length / completed.length) * 100,
        );
  return {
    registered: rows.length,
    completed: completed.length,
    notStarted: rows.filter((row) => row.attemptStatus === 'not_started').length,
    averageScore,
    passRate,
  };
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function formatMarks(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export const AUTO_SUBMIT_REASON_LABEL = {
  timer: 'Timer ran out',
  quiz_ended: 'Quiz ended',
  quiz_deactivated: 'Quiz deactivated',
} as const;

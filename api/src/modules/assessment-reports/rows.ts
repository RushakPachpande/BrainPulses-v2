import { activityStatusDisplay, type ActivityStatusDisplay } from '../../lib/activity-status.js';
import { meetsPassRule, type RoundSettings } from '../../lib/round-settings.js';
import {
  classifyAttemptStatus,
  pickBestAttempt,
  reportQuizStatus,
  wholePercent,
  type AttemptSnapshot,
  type AttemptStatusLabel,
  type ReportQuizStatus,
  type ResultLabel,
} from '../quiz-reports/rows.js';

export type AssessmentAttempt = AttemptSnapshot;

export type AssessmentSource = {
  registrationId: string;
  roundId: string;
  roundName: string;
  roundOrder: number;
  registeredAt: string;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  activityId: string;
  assessmentName: string;
  displayStatus: ActivityStatusDisplay;
  roundSettings: RoundSettings;
  resultsPublishedAt: string | null;
  questionCount: number;
  maxScore: number;
  attempts: AssessmentAttempt[];
};

export type AssessmentReportRow = {
  id: string;
  registrationId: string;
  roundId: string;
  roundName: string;
  roundOrder: number;
  registeredAt: string;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  activityId: string;
  assessmentName: string;
  activityStatus: ReportQuizStatus;
  displayStatus: ActivityStatusDisplay;
  passMode: 'percent' | 'score';
  passingPercent: number | null;
  passingScore: number | null;
  passLinePercent: number | null;
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

export type AssessmentSortKey =
  | 'code'
  | 'name'
  | 'email'
  | 'phone'
  | 'assessment'
  | 'round'
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

export type AssessmentQuery = {
  q: string;
  activityId?: string;
  roundId?: string;
  activityStatus: 'any' | 'active' | 'expired' | 'inactive';
  attemptStatus: 'any' | AttemptStatusLabel;
  autoSubmitted: 'any' | 'yes' | 'no';
  sort: AssessmentSortKey;
  dir: 'asc' | 'desc';
};

export function buildAssessmentRow(
  source: AssessmentSource,
  breakdown?: { correct: number; skipped: number; negative: number } | null,
): AssessmentReportRow {
  const settings = source.roundSettings;
  const active = source.displayStatus === 'Active';
  const attemptStatus = classifyAttemptStatus(source.attempts, active);
  const best = pickBestAttempt(source.attempts);
  const scored = best != null && best.score != null && best.maxScore != null;
  const score = scored ? (best.score as number) : null;
  const maxScore = scored ? (best.maxScore as number) : source.maxScore;
  const percent = scored ? wholePercent(score ?? 0, maxScore ?? 0) : null;
  const passLinePercent =
    settings.passMode === 'score'
      ? settings.passingScore != null && maxScore > 0
        ? Math.round((settings.passingScore / maxScore) * 100)
        : null
      : settings.passingPercent;
  let result: ResultLabel | null = null;
  if (scored && score != null && percent != null) {
    const passed = meetsPassRule(settings, score, percent);
    result = passed ? 'pass' : 'fail';
  }
  let timeTakenSeconds: number | null = null;
  if (best?.submittedAt) {
    timeTakenSeconds = Math.max(
      0,
      Math.round((Date.parse(best.submittedAt) - Date.parse(best.startedAt)) / 1000),
    );
  }
  return {
    id: `${source.registrationId}:${source.roundId}`,
    registrationId: source.registrationId,
    roundId: source.roundId,
    roundName: source.roundName,
    roundOrder: source.roundOrder,
    registeredAt: source.registeredAt,
    code: source.code,
    name: source.name,
    email: source.email,
    phone: source.phone,
    activityId: source.activityId,
    assessmentName: source.assessmentName,
    activityStatus: reportQuizStatus(source.displayStatus),
    displayStatus: source.displayStatus,
    passMode: settings.passMode,
    passingPercent: settings.passingPercent,
    passingScore: settings.passingScore,
    passLinePercent,
    scoreRelease: settings.scoreRelease,
    resultsPublishedAt: source.resultsPublishedAt,
    attemptStatus,
    attemptsStarted: source.attempts.length,
    attemptsAllowed: settings.maxAttempts,
    bestAttemptId: best?.id ?? null,
    resultId: best?.resultId ?? null,
    score,
    maxScore,
    percent,
    result,
    questionCount: best && best.questionCount > 0 ? best.questionCount : source.questionCount,
    correct: scored && breakdown ? breakdown.correct : null,
    skipped: scored && breakdown ? breakdown.skipped : null,
    negative: scored && breakdown ? breakdown.negative : null,
    timeTakenSeconds,
    submittedAt: best?.submittedAt ?? null,
    autoSubmitted: best == null ? null : best.status === 'auto_submitted',
    autoSubmitReason: best?.status === 'auto_submitted' ? best.autoSubmitReason : null,
  };
}

export function filterAssessmentRows(
  rows: AssessmentReportRow[],
  query: AssessmentQuery,
): AssessmentReportRow[] {
  const q = query.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (q && !row.code.toLowerCase().includes(q) && !row.name.toLowerCase().includes(q)) {
      return false;
    }
    if (query.activityId && row.activityId !== query.activityId) return false;
    if (query.roundId && row.roundId !== query.roundId) return false;
    if (query.activityStatus !== 'any' && row.activityStatus !== query.activityStatus) return false;
    if (query.attemptStatus !== 'any' && row.attemptStatus !== query.attemptStatus) return false;
    if (query.autoSubmitted === 'yes' && row.autoSubmitted !== true) return false;
    if (query.autoSubmitted === 'no' && row.autoSubmitted !== false) return false;
    return true;
  });
}

function tie(a: AssessmentReportRow, b: AssessmentReportRow): number {
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  if (byName !== 0) return byName;
  const byRound = a.roundOrder - b.roundOrder;
  if (byRound !== 0) return byRound;
  return a.code.localeCompare(b.code, undefined, { numeric: true });
}

function sortValue(row: AssessmentReportRow, key: AssessmentSortKey): string | number | null {
  switch (key) {
    case 'code':
      return row.code;
    case 'name':
      return row.name;
    case 'email':
      return row.email;
    case 'phone':
      return row.phone;
    case 'assessment':
      return row.assessmentName;
    case 'round':
      return row.roundOrder;
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

export function sortAssessmentRows(
  rows: AssessmentReportRow[],
  key: AssessmentSortKey,
  dir: 'asc' | 'desc',
): AssessmentReportRow[] {
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

export function summarizeAssessmentRows(rows: AssessmentReportRow[]) {
  const completed = rows.filter((row) => row.attemptStatus === 'completed');
  const scored = completed.filter((row) => row.percent != null);
  return {
    registered: rows.length,
    completed: completed.length,
    notStarted: rows.filter((row) => row.attemptStatus === 'not_started').length,
    averageScore:
      scored.length === 0
        ? null
        : Math.round(scored.reduce((sum, row) => sum + (row.percent ?? 0), 0) / scored.length),
    passRate:
      completed.length === 0
        ? null
        : Math.round(
            (completed.filter((row) => row.result === 'pass').length / completed.length) * 100,
          ),
  };
}

export function assessmentDisplayStatus(
  status: string,
  startsAt: Date | null,
  endsAt: Date | null,
) {
  return activityStatusDisplay(status, startsAt, endsAt);
}

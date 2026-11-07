import { apiGetData, apiPostData } from '@/lib/api-client';

export type QuizAttemptStatus = 'completed' | 'in_progress' | 'not_started';
export type QuizResultLabel = 'pass' | 'fail';
export type QuizAutoReason = 'timer' | 'quiz_ended' | 'quiz_deactivated';

export type QuizReportRow = {
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
  quizStatus: 'active' | 'expired' | 'inactive' | 'other';
  displayStatus: string;
  passingPercent: number | null;
  scoreRelease: 'after_submit' | 'after_publish';
  resultsPublishedAt: string | null;
  attemptStatus: QuizAttemptStatus;
  attemptsStarted: number;
  attemptsAllowed: number | null;
  bestAttemptId: string | null;
  resultId: string | null;
  score: number | null;
  maxScore: number | null;
  percent: number | null;
  result: QuizResultLabel | null;
  questionCount: number;
  correct: number | null;
  skipped: number | null;
  negative: number | null;
  timeTakenSeconds: number | null;
  submittedAt: string | null;
  autoSubmitted: boolean | null;
  autoSubmitReason: QuizAutoReason | null;
};

export type QuizReportQuiz = {
  id: string;
  name: string;
  contestId: string | null;
  contestName: string | null;
  quizStatus: QuizReportRow['quizStatus'];
  displayStatus: string;
  scoreRelease: QuizReportRow['scoreRelease'];
  resultsPublishedAt: string | null;
  passingPercent: number | null;
};

export type QuizReportPage = {
  rows: QuizReportRow[];
  summary: {
    registered: number;
    completed: number;
    notStarted: number;
    averageScore: number | null;
    passRate: number | null;
  };
  page: { page: number; pageSize: number; total: number; pageCount: number };
  options: {
    contests: { id: string; name: string }[];
    quizzes: QuizReportQuiz[];
  };
};

export type QuizReportAnswer = {
  questionVersionId: string;
  number: number;
  question: string;
  marks: number;
  answered: boolean;
  answerText: string;
  correct: boolean | null;
  correctText: string | null;
};

export type QuizReportDetail = {
  registrationId: string;
  registeredAt: string;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  quizName: string;
  contestName: string | null;
  roundName?: string | null;
  passingPercent: number | null;
  attemptStatus: QuizAttemptStatus;
  attemptsStarted: number;
  attemptsAllowed: number | null;
  countedAttemptId: string | null;
  resultId: string | null;
  note: 'not_started' | 'in_progress' | null;
  attempts: {
    id: string;
    number: number;
    counted: boolean;
    score: number | null;
    maxScore: number | null;
    percent: number | null;
    result: QuizResultLabel | null;
    timeTakenSeconds: number | null;
    submittedAt: string | null;
    autoSubmitted: boolean;
    autoSubmitReason: QuizAutoReason | null;
    attemptStatus: 'completed' | 'in_progress';
    selectable: boolean;
    disqualified: boolean;
  }[];
  answers: {
    summary: { correct: number; wrong: number; skipped: number; negative: number };
    groups: { passage: string | null; questions: QuizReportAnswer[] }[];
  } | null;
  selectedAttemptId: string | null;
  showSelectPrompt: boolean;
};

const EMPTY_REPORT: QuizReportPage = {
  rows: [],
  summary: { registered: 0, completed: 0, notStarted: 0, averageScore: null, passRate: null },
  page: { page: 1, pageSize: 10, total: 0, pageCount: 1 },
  options: { contests: [], quizzes: [] },
};

export async function getQuizReport(query: string): Promise<QuizReportPage> {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_FIXTURES === 'true') return EMPTY_REPORT;
  return apiGetData<QuizReportPage>(`/api/quiz-reports${query ? `?${query}` : ''}`);
}

export async function getQuizReportDetail(
  registrationId: string,
  attemptId: string | null,
): Promise<QuizReportDetail> {
  const query = attemptId ? `?attemptId=${encodeURIComponent(attemptId)}` : '';
  return apiGetData<QuizReportDetail>(`/api/quiz-reports/registrations/${registrationId}${query}`);
}

export async function downloadQuizReport(query: string): Promise<void> {
  const { downloadQueuedExport } = await import('@/lib/jobs');
  await downloadQueuedExport(`/api/quiz-reports/export?${query}`, 'BrainPulses-results.xlsx');
}

export async function publishQuizResults(activityId: string) {
  return apiPostData<{ resultsPublishedAt: string }>(`/api/quiz-reports/${activityId}/publish`, {});
}

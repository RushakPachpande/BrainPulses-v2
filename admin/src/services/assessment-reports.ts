import { apiDownloadBlob, apiGetData, apiPostData } from '@/lib/api-client';
import type { QuizReportDetail } from '@/services/quiz-reports';

export type AssessmentActivityStatus = 'active' | 'expired' | 'inactive' | 'other';

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
  activityStatus: AssessmentActivityStatus;
  displayStatus: string;
  passMode: 'percent' | 'score';
  passingPercent: number | null;
  passingScore: number | null;
  passLinePercent: number | null;
  scoreRelease: 'after_submit' | 'after_publish';
  resultsPublishedAt: string | null;
  attemptStatus: 'completed' | 'in_progress' | 'not_started';
  attemptsStarted: number;
  attemptsAllowed: number | null;
  bestAttemptId: string | null;
  resultId: string | null;
  score: number | null;
  maxScore: number | null;
  percent: number | null;
  result: 'pass' | 'fail' | null;
  questionCount: number;
  correct: number | null;
  skipped: number | null;
  negative: number | null;
  timeTakenSeconds: number | null;
  submittedAt: string | null;
  autoSubmitted: boolean | null;
  autoSubmitReason: 'timer' | 'quiz_ended' | 'quiz_deactivated' | null;
};

export type AssessmentRoundOption = {
  id: string;
  name: string;
  activityId: string;
  assessmentName: string;
  sortOrder: number;
  scoreRelease: 'after_submit' | 'after_publish';
  resultsPublishedAt: string | null;
  withheldCount: number;
};

export type AssessmentReportPage = {
  rows: AssessmentReportRow[];
  summary: {
    registered: number;
    completed: number;
    notStarted: number;
    averageScore: number | null;
    passRate: number | null;
  };
  page: { page: number; pageSize: number; total: number; pageCount: number };
  options: {
    assessments: { id: string; name: string; activityStatus: AssessmentActivityStatus }[];
    rounds: AssessmentRoundOption[];
  };
};

const EMPTY: AssessmentReportPage = {
  rows: [],
  summary: { registered: 0, completed: 0, notStarted: 0, averageScore: null, passRate: null },
  page: { page: 1, pageSize: 10, total: 0, pageCount: 1 },
  options: { assessments: [], rounds: [] },
};

export async function getAssessmentReport(query: string): Promise<AssessmentReportPage> {
  if (import.meta.env.VITE_USE_FIXTURES === 'true') return EMPTY;
  return apiGetData<AssessmentReportPage>(`/api/assessment-reports${query ? `?${query}` : ''}`);
}

export async function getAssessmentReportDetail(
  registrationId: string,
  roundId: string,
  attemptId: string | null,
): Promise<QuizReportDetail> {
  const params = new URLSearchParams({ roundId });
  if (attemptId) params.set('attemptId', attemptId);
  return apiGetData<QuizReportDetail>(
    `/api/assessment-reports/registrations/${registrationId}?${params.toString()}`,
  );
}

export async function downloadAssessmentReport(query: string): Promise<void> {
  await apiDownloadBlob(
    `/api/assessment-reports/export?${query}`,
    'BrainPulses-assessment-results.xlsx',
  );
}

export async function publishRoundResults(roundId: string) {
  return apiPostData<{ resultsPublishedAt: string }>(
    `/api/assessment-reports/rounds/${roundId}/publish`,
    {},
  );
}

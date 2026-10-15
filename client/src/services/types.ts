export type ActivityKind = 'assessment' | 'quiz';

export type StudentActivity = {
  registrationId: string;
  activityId: string;
  code: string;
  name: string;
  subtitle: string | null;
  kind: ActivityKind;
  status: string;
  durationMinutes: number | null;
  startsAt: string | null;
  endsAt: string | null;
  questionCount: number;
  attemptState: 'not_started' | 'in_progress' | 'submitted';
  openAttemptId: string | null;
  latestResultId: string | null;
  latestPercent: number | null;
};

export type StudentResultSummary = {
  id: string;
  activityId: string;
  activityCode: string;
  title: string;
  kind: ActivityKind;
  attemptId: string;
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean | null;
  releaseStatus: string;
  submittedAt: string;
  durationMinutes: number | null;
};

export type StudentResultDetail = {
  id: string;
  title: string;
  kind: ActivityKind;
  activityId: string;
  attemptId: string;
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean | null;
  releaseStatus: string;
  submittedAt: string;
  review: {
    questionVersionId: string;
    stem: string;
    options: { label: string; body: string; isCorrect?: boolean }[];
    yourAnswer: unknown;
    correct: boolean | null;
    correctLabels: string[];
    explanation: string | null;
  }[];
};

export type AttemptQuestion = {
  questionVersionId: string;
  type: string;
  stem: string;
  points: number;
  options: { id: string; label: string; body: string; sortOrder: number }[];
};

export type AttemptState = {
  id: string;
  status: string;
  revision: number;
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  activityId: string;
  studentId: string;
  responses: { questionVersionId: string; answer: unknown; revision: number }[];
};

export type StudentProfile = {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  course: string | null;
  city: string | null;
  organization: { id: string; name: string; slug: string };
};

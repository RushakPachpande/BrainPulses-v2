export type ActivityKind = 'assessment' | 'quiz';

export type StudentRoundState = 'locked' | 'available' | 'in_progress' | 'completed';

export type StudentActivityRound = {
  id: string;
  name: string;
  sortOrder: number;
  durationMinutes: number | null;
  questionCount: number;
  state: StudentRoundState;
  openAttemptId: string | null;
  latestResultId: string | null;
};

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
  leaderboardAvailable?: boolean;
  rounds?: StudentActivityRound[];
};

export type StudentResultSummary = {
  id: string;
  activityId: string;
  activityCode: string;
  title: string;
  kind: ActivityKind;
  attemptId: string;
  roundId?: string | null;
  roundName?: string | null;
  score: number | null;
  maxScore: number | null;
  percent: number | null;
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
  score: number | null;
  maxScore: number | null;
  percent: number | null;
  passed: boolean | null;
  releaseStatus: string;
  answersVisible?: boolean;
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
  options: {
    id: string;
    label: string;
    body: string;
    sortOrder: number;
    imageUrl?: string;
  }[];
  passageText?: string;
  stemImageUrl?: string;
};

export type AttemptState = {
  id: string;
  status: string;
  revision: number;
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  activityId: string;
  roundId?: string | null;
  studentId: string;
  activityKind?: string | null;
  softProctoring?: boolean;
  disqualified?: boolean;
  isAuthoritative?: boolean;
  responses: { questionVersionId: string; answer: unknown; revision: number }[];
};

export type LeaderboardEntry = {
  rank: number;
  studentId?: string;
  studentName?: string;
  studentCode?: string;
  cohort?: string | null;
  percent?: number;
  score?: number;
  maxScore?: number;
  members?: number;
  avgPercent?: number;
  bestPercent?: number;
};

export type LeaderboardPayload = {
  activityId: string;
  activityName: string;
  scope: string;
  kind: string;
  entries: LeaderboardEntry[];
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

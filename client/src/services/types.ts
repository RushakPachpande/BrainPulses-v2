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
  /** False when status is not active or outside the start/end window. */
  canAttempt?: boolean;
  attemptBlockedReason?: string | null;
  openAttemptId: string | null;
  latestResultId: string | null;
  latestPercent: number | null;
  attemptsUsed?: number;
  maxAttempts?: number | null;
  extraAttempts?: number;
  canStartAnother?: boolean;
  instructions?: string | null;
  imageFileId?: string | null;
  sponsorName?: string | null;
  sponsorImageFileId?: string | null;
  contestName?: string | null;
  contestImageFileId?: string | null;
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
  questionCount?: number;
  attemptsUsed?: number;
  maxAttempts?: number | null;
  extraAttempts?: number;
  review: {
    questionVersionId: string;
    question: string;
    passageText?: string;
    questionImageUrl?: string;
    options: { label: string; body: string; imageUrl?: string; isCorrect?: boolean }[];
    yourAnswer: unknown;
    correct: boolean | null;
    correctLabels: string[];
    explanation: string | null;
  }[];
};

export type AttemptQuestion = {
  questionVersionId: string;
  type: string;
  question: string;
  points: number;
  options: {
    id: string;
    label: string;
    body: string;
    sortOrder: number;
    imageUrl?: string;
  }[];
  passageText?: string;
  questionImageUrl?: string;
};

export type AttemptPresentation = 'one_at_a_time' | 'all_on_page';

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
  presentation?: AttemptPresentation;
  durationMode?: 'overall' | 'per_question';
  perQuestionSeconds?: number | null;
  allowPrevious?: boolean;
  showQuestionPanel?: boolean;
  /** When true (default), Next/Submit stay disabled until answered. */
  questionsCompulsory?: boolean;
  forwardOnly?: boolean;
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

export type ActivityKind = 'assessment' | 'quiz';

export type Student = {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  registered: string;
  activities: number;
  status: string;
  lastLogin: string;
  course: string;
  city: string;
  cohort: string;
};

export type AdminUser = {
  id?: string;
  name: string;
  email: string;
  role: string;
  assessmentAccess: string;
  quizAccess: string;
  status: string;
  lastLogin: string;
};

export type Activity = {
  id: string;
  name: string;
  subtitle: string;
  iconTone: number;
  status: string;
  registered: number;
  assigned: number;
  banks: number;
  attempts: number;
  start: string;
  end: string;
  startTime: string;
  endTime: string;
};

export type ActivityRegistrationField = {
  key: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'select';
  required: boolean;
  options?: string[];
};

export type ScoreRelease = 'after_submit' | 'after_publish';

export type QuizActivitySettings = {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  scoreRelease: ScoreRelease;
  answersVisibleToStudent: boolean;
  allowPrevious: boolean;
  showQuestionPanel: boolean;
  negativeMarkingEnabled: boolean;
  negativeMarkPoints: number;
  /** Null means unlimited submissions. */
  maxAttempts: number | null;
};

export type ActivitySettings = {
  registrationForm?: { fields: ActivityRegistrationField[] };
  assignmentRules?: { mode: 'manual' | 'all_active_students'; notes?: string };
  quiz?: QuizActivitySettings;
};

export type ActivityRoundLocalQuestion = {
  id: string;
  code: string;
  type: string;
  question: string;
  points: number;
  isActive: boolean;
  options: { id: string; label: string; body: string; sortOrder: number }[];
};

export type ActivityRoundDetail = {
  id: string;
  name: string;
  sortOrder: number;
  durationMinutes: number | null;
  bankIds: string[];
  banksDetail: { id: string; name: string; code: string }[];
  localBankId: string | null;
  localQuestionCount: number;
  localQuestions: ActivityRoundLocalQuestion[];
};

export type DurationMode = 'overall' | 'per_question';

export type Sponsor = {
  id: string;
  name: string;
  imageFileId: string;
  createdAt: string;
  updatedAt: string;
  contests: number;
};

export type ImageLibraryPurpose = 'catalog' | 'question';

export type LibraryImage = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type Contest = {
  id: string;
  sponsorId: string;
  sponsorName: string;
  name: string;
  description: string | null;
  imageFileId: string;
  createdAt: string;
  updatedAt: string;
};

export type ActivityDetail = Activity & {
  code: string;
  kind: ActivityKind;
  statusKey: string;
  statusDisplay?: string;
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number | null;
  durationMode: DurationMode;
  perQuestionSeconds: number | null;
  passingPercent: number | null;
  presentation: 'one_at_a_time' | 'all_on_page';
  instructions: string | null;
  imageFileId: string | null;
  bankIds: string[];
  sponsorId: string | null;
  contestId: string | null;
  sponsor: { id: string; name: string } | null;
  contest: { id: string; name: string } | null;
  settings: ActivitySettings | null;
  rounds?: ActivityRoundDetail[];
};

export type QuestionBank = {
  id: string;
  name: string;
  description: string;
  questions: number;
  types: string;
  presentation: string;
  updated: string;
  usedIn: number;
  status: string;
};

export type RegistrationRow = {
  id: string;
  registrationId: string;
  studentId: string;
  activityId: string;
  name: string;
  email: string;
  phone: string;
  registered: string;
  activity: string;
  bank: string;
  assignment: string;
  attempt: string;
  /** Present when the student has an open or completed attempt. */
  attemptId?: string | null;
  /** Present when the primary attempt has a submitted result. */
  resultId?: string | null;
  city: string;
  course: string;
};

export type ResultRow = {
  id: string;
  student: string;
  activity: string;
  attempt: string;
  score: number;
  submitted: string;
  status: string;
  releaseStatus?: string;
  maxScore?: number;
  percent?: number;
  activityKind?: string;
  studentCode?: string;
  attemptId?: string;
  activityId?: string;
  studentId?: string;
  disqualified?: boolean;
};

export type ResultDetail = ResultRow & {
  revisions?: { id: string; score: number; maxScore: number; percent: number }[];
};

export type AccessUser = {
  membershipId?: string;
  name: string;
  email: string;
  role: string;
  assessment: boolean;
  quiz: boolean;
  enabled: boolean;
};

export type PermissionRow = {
  name: string;
  superAdmin: string;
  admin: string;
};

export type NotificationPreference = readonly [string, string, boolean];

/** [id, display text, relative time] */
export type AuditLogRow = readonly [string, string, string];

export type ReportSummaryRow = readonly [string, string, string, number];

export type DashboardData = {
  kpis: ReadonlyArray<readonly [string, string, string, number]>;
  charts: ReadonlyArray<{
    title: string;
    values: number[];
    color: string;
    caption: string;
  }>;
  /** [id, display text, relative time] */
  activity: ReadonlyArray<readonly [string, string, string]>;
};

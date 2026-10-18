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

export type ActivitySettings = {
  registrationForm?: { fields: ActivityRegistrationField[] };
  assignmentRules?: { mode: 'manual' | 'all_active_students'; notes?: string };
};

export type ActivityDetail = Activity & {
  code: string;
  kind: ActivityKind;
  statusKey: string;
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number | null;
  passingPercent: number | null;
  presentation: 'one_at_a_time' | 'all_on_page' | 'timed_card';
  bankIds: string[];
  settings: ActivitySettings | null;
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

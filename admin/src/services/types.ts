export type ActivityKind = 'assessment' | 'quiz';

export type Student = {
  id: string;
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
  student: string;
  activity: string;
  attempt: string;
  score: number;
  submitted: string;
  status: string;
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

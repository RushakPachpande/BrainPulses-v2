import {
  formatAdminDate,
  formatAdminDateTime,
  formatAdminTime,
  formatRelativeTime,
} from '@/lib/format-datetime';
import type {
  AccessUser,
  Activity,
  AdminUser,
  AuditLogRow,
  DashboardData,
  NotificationPreference,
  QuestionBank,
  RegistrationRow,
  ResultRow,
  Student,
} from './types';

function formatAccessLevel(level: string): string {
  const map: Record<string, string> = {
    full: 'Full',
    edit: 'Edit',
    view: 'View only',
    none: 'None',
  };
  return map[level] ?? level;
}

function formatPresentation(value: string): string {
  const map: Record<string, string> = {
    one_at_a_time: 'One at a time',
    all_on_page: 'All on one page',
    timed_card: 'Timed card',
  };
  return map[value] ?? value.replaceAll('_', ' ');
}

function formatAttemptStatus(value: string): string {
  const normalized = value.trim().toLowerCase().replaceAll(' ', '_').replaceAll('-', '_');
  const map: Record<string, string> = {
    not_started: 'Not Started',
    notstarted: 'Not Started',
    in_progress: 'In Progress',
    inprogress: 'In Progress',
    submitted: 'Completed',
    auto_submitted: 'Completed',
    autosubmitted: 'Completed',
  };
  return map[normalized] ?? value;
}

function formatAssignment(value: string): string {
  if (value === 'Unassigned' || value === 'unassigned') return 'Pending';
  if (value === 'Assigned' || value === 'assigned') return 'Assigned';
  return value;
}

export function mapStudentFromApi(row: {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  course: string | null;
  city: string | null;
  cohort?: string | null;
  status: string;
  registered: string | Date;
  activities: number;
  lastLoginAt: string | Date | null;
}): Student {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    email: row.email,
    phone: row.phone ?? '—',
    registered: formatAdminDate(row.registered),
    activities: row.activities,
    status: row.status,
    lastLogin: formatAdminDateTime(row.lastLoginAt),
    course: row.course ?? '—',
    city: row.city ?? '—',
    cohort: row.cohort ?? '—',
  };
}

export function mapUserFromApi(row: {
  id: string;
  name: string;
  email: string;
  role: string;
  assessmentAccess: string;
  quizAccess: string;
  status: string;
  lastLoginAt: string | Date | null;
}): AdminUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    assessmentAccess: formatAccessLevel(row.assessmentAccess),
    quizAccess: formatAccessLevel(row.quizAccess),
    status: row.status,
    lastLogin: formatAdminDateTime(row.lastLoginAt),
  };
}

export function mapActivityFromApi(
  row: {
    id: string;
    code?: string;
    name: string;
    subtitle: string | null;
    status: string;
    registered: number;
    assigned: number;
    banks: number;
    attempts: number;
    startsAt: string | Date | null;
    endsAt: string | Date | null;
  },
  index: number,
): Activity {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle ?? '',
    iconTone: index % 6,
    status: row.status,
    registered: row.registered,
    assigned: row.assigned,
    banks: row.banks,
    attempts: row.attempts,
    start: formatAdminDate(row.startsAt),
    end: formatAdminDate(row.endsAt),
    startTime: formatAdminTime(row.startsAt),
    endTime: formatAdminTime(row.endsAt),
  };
}

export function mapBankFromApi(row: {
  id: string;
  name: string;
  description: string | null;
  questions: number;
  types: string;
  presentation: string;
  updatedAt: string | Date;
  usedIn: number;
  status: string;
}): QuestionBank {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    questions: row.questions,
    types: row.types || '—',
    presentation: formatPresentation(row.presentation),
    updated: formatAdminDate(row.updatedAt),
    usedIn: row.usedIn,
    status: row.status,
  };
}

export function mapRegistrationFromApi(row: {
  id: string;
  studentId: string;
  activityId: string;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  course: string | null;
  activity: string;
  assignment: string;
  attempt: string;
  registered: string | Date;
}): RegistrationRow {
  return {
    id: row.code,
    registrationId: row.id,
    studentId: row.studentId,
    activityId: row.activityId,
    name: row.name,
    email: row.email,
    phone: row.phone ?? '—',
    registered: formatAdminDate(row.registered),
    activity: row.activity,
    bank: '—',
    assignment: formatAssignment(row.assignment),
    attempt: formatAttemptStatus(row.attempt),
    city: row.city ?? '—',
    course: row.course ?? '—',
  };
}

export function mapResultFromApi(row: {
  id: string;
  student: string;
  activity: string;
  attemptId: string;
  percent: number;
  score?: number;
  maxScore?: number;
  submitted: string | Date;
  status: string;
  releaseStatus?: string;
  activityKind?: string;
  studentCode?: string;
  activityId?: string;
  studentId?: string;
  disqualified?: boolean;
}): ResultRow {
  const percent = Math.round(row.percent);
  const score = row.score != null ? row.score : percent;
  return {
    id: row.id,
    student: row.student,
    activity: row.activity,
    attempt: '#1',
    score,
    submitted: formatAdminDateTime(row.submitted),
    status: row.status,
    releaseStatus: row.releaseStatus,
    maxScore: row.maxScore,
    percent,
    activityKind: row.activityKind,
    studentCode: row.studentCode,
    attemptId: row.attemptId,
    activityId: row.activityId,
    studentId: row.studentId,
    disqualified: row.disqualified,
  };
}

export function mapAccessUserFromApi(row: {
  id: string;
  name: string;
  email: string;
  role: string;
  assessmentAccess: string;
  quizAccess: string;
  isActive: boolean;
}): AccessUser {
  return {
    membershipId: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    assessment: row.assessmentAccess !== 'none',
    quiz: row.quizAccess !== 'none',
    enabled: row.isActive,
  };
}

const notificationMeta: { title: string; hint: string; key: string }[] = [
  {
    title: 'Student Registration',
    hint: 'Notify admins when a student registers',
    key: 'studentRegistration',
  },
  {
    title: 'Assessment Completion',
    hint: 'Alert when a student completes an assessment',
    key: 'assessmentCompletion',
  },
  {
    title: 'Quiz Completion',
    hint: 'Alert when a student completes a quiz',
    key: 'quizCompletion',
  },
  {
    title: 'Admin Notifications',
    hint: 'Account, role, and access changes',
    key: 'adminChanges',
  },
  {
    title: 'Email Notifications',
    hint: 'Send summaries to admin email',
    key: 'emailSummaries',
  },
  {
    title: 'Daily Digest',
    hint: 'Daily 8:00 AM activity summary',
    key: 'dailyDigest',
  },
];

export function mapNotificationsFromSettings(
  values: Record<string, unknown>,
): NotificationPreference[] {
  return notificationMeta.map((item) => [
    item.title,
    item.hint,
    Boolean(values[item.key]),
  ]) as NotificationPreference[];
}

export function notificationValuesFromPreferences(
  prefs: { enabled: boolean }[],
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  notificationMeta.forEach((item, index) => {
    out[item.key] = prefs[index]?.enabled ?? false;
  });
  return out;
}

export function mapAuditLogsFromApi(
  rows: { id: string; actor: string; action: string; createdAt: string | Date }[],
): AuditLogRow[] {
  return rows.map((row) => [
    row.id,
    `${row.actor} ${row.action}`,
    formatRelativeTime(row.createdAt),
  ]) as AuditLogRow[];
}

export function mapDashboardFromApi(summary: {
  kpis: { label: string; value: number }[];
  charts: { title: string; values: number[] }[];
  activity: { id?: string; text: string; at: string | Date }[];
}): DashboardData {
  const chartColors = ['var(--primary)', '#7c3aed', '#16a34a'] as const;
  const chartCaptions = [
    'Registrations over recent months.',
    'Average assessment score.',
    'Average quiz score.',
  ];
  return {
    kpis: summary.kpis.map((kpi, index) => [
      kpi.label,
      kpi.value.toLocaleString('en-IN'),
      '',
      index,
    ]) as DashboardData['kpis'],
    charts: summary.charts.map((chart, index) => ({
      title: chart.title,
      values: chart.values.length ? chart.values : [0],
      color: chartColors[index] ?? 'var(--primary)',
      caption: chartCaptions[index] ?? '',
    })),
    activity: summary.activity.map((item, index) => [
      item.id ?? `activity-${index}`,
      item.text,
      formatRelativeTime(item.at),
    ]) as DashboardData['activity'],
  };
}

export function buildReportSummaryFromResults(rows: ResultRow[]) {
  const attempted = rows.length;
  const completed = rows.filter((r) => r.status === 'Passed' || r.status === 'Failed').length;
  const avg =
    attempted === 0
      ? 0
      : Math.round(rows.reduce((sum, r) => sum + (r.percent ?? r.score), 0) / attempted);
  return [
    ['Registered', String(attempted), '', 0],
    ['Assigned', String(attempted), '', 1],
    ['Attempted', String(attempted), '', 2],
    ['Completed', String(completed), '', 3],
    ['Average Score', `${avg}%`, '', 4],
  ] as const;
}

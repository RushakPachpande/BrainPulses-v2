import { apiGetData, apiGetList, apiPatchData, apiPostData } from '@/lib/api-client';
import {
  buildReportSummaryFromResults,
  mapAccessUserFromApi,
  mapActivityFromApi,
  mapAuditLogsFromApi,
  mapBankFromApi,
  mapDashboardFromApi,
  mapNotificationsFromSettings,
  mapRegistrationFromApi,
  mapResultFromApi,
  mapStudentFromApi,
  mapUserFromApi,
  notificationValuesFromPreferences,
} from './api-mappers';
import {
  fixturesGetAccessUsers,
  fixturesGetActivities,
  fixturesGetAuditLogs,
  fixturesGetDashboard,
  fixturesGetMonths,
  fixturesGetNotifications,
  fixturesGetPermissions,
  fixturesGetQuestionBanks,
  fixturesGetRegistrations,
  fixturesGetReportSummary,
  fixturesGetResults,
  fixturesGetStudents,
  fixturesGetUsers,
} from './fixtures-sync';
import type {
  AccessUser,
  ActivityDetail,
  ActivityKind,
  ActivitySettings,
  AdminUser,
  AuditLogRow,
  DashboardData,
  NotificationPreference,
  PermissionRow,
  QuestionBank,
  ReportSummaryRow,
  ResultDetail,
  Student,
} from './types';

export type {
  ActivityKind,
  ActivityDetail,
  ActivityRegistrationField,
  ActivitySettings,
  Student,
  AdminUser,
  AccessUser,
  DashboardData,
  ResultDetail,
  ResultRow,
} from './types';

const useFixtures = import.meta.env.VITE_USE_FIXTURES === 'true';

type ApiStudentRow = Parameters<typeof mapStudentFromApi>[0];
type ApiUserRow = Parameters<typeof mapUserFromApi>[0];
type ApiActivityRow = Parameters<typeof mapActivityFromApi>[0];
type ApiBankRow = Parameters<typeof mapBankFromApi>[0];
type ApiRegistrationRow = Parameters<typeof mapRegistrationFromApi>[0];
type ApiResultRow = Parameters<typeof mapResultFromApi>[0];
type ApiAccessRow = Parameters<typeof mapAccessUserFromApi>[0];
type ApiDashboardSummary = Parameters<typeof mapDashboardFromApi>[0];

export async function getStudents(): Promise<Student[]> {
  if (useFixtures) return fixturesGetStudents();
  const rows = await apiGetList<ApiStudentRow>('/api/students', { limit: 100 });
  return rows.map(mapStudentFromApi);
}

export async function getUsers(): Promise<AdminUser[]> {
  if (useFixtures) return fixturesGetUsers();
  const rows = await apiGetList<ApiUserRow>('/api/users', { limit: 100 });
  return rows.map(mapUserFromApi);
}

export async function getUser(membershipId: string): Promise<AdminUser> {
  if (useFixtures) {
    const rows = await getUsers();
    const found = rows.find((u) => u.id === membershipId);
    if (!found) throw new Error('User not found');
    return found;
  }
  const row = await apiGetData<ApiUserRow>(`/api/users/${membershipId}`);
  return mapUserFromApi(row);
}

export async function getActivities(kind: ActivityKind) {
  if (useFixtures) return fixturesGetActivities(kind);
  const rows = await apiGetList<ApiActivityRow>('/api/activities', {
    kind,
    limit: 100,
  });
  return rows.map((row, index) => mapActivityFromApi(row, index));
}

export async function getQuestionBanks(kind: ActivityKind) {
  if (useFixtures) return fixturesGetQuestionBanks(kind);
  const rows = await apiGetList<ApiBankRow>('/api/banks', {
    kind,
    limit: 100,
  });
  return rows.map(mapBankFromApi);
}

export async function getRegistrations(kind: ActivityKind) {
  if (useFixtures) return fixturesGetRegistrations(kind);
  const rows = await apiGetList<ApiRegistrationRow>('/api/registrations', {
    kind,
    limit: 100,
  });
  return rows.map(mapRegistrationFromApi);
}

export async function getResults(kind: ActivityKind) {
  if (useFixtures) return fixturesGetResults(kind);
  const rows = await apiGetList<ApiResultRow>('/api/results', {
    kind,
    limit: 100,
  });
  return rows.map(mapResultFromApi);
}

export function getMonths() {
  return fixturesGetMonths();
}

export async function getDashboard(): Promise<DashboardData> {
  if (useFixtures) return fixturesGetDashboard();
  const summary = await apiGetData<ApiDashboardSummary>('/api/dashboard/summary');
  return mapDashboardFromApi(summary);
}

export async function getAccessUsers(): Promise<AccessUser[]> {
  if (useFixtures) return fixturesGetAccessUsers();
  const rows = await apiGetList<ApiAccessRow>('/api/users', {
    limit: 100,
  });
  return rows.map(mapAccessUserFromApi);
}

export async function getPermissions(): Promise<PermissionRow[]> {
  return fixturesGetPermissions();
}

export async function getNotifications(): Promise<NotificationPreference[]> {
  if (useFixtures) return [...fixturesGetNotifications()];
  const settings = await apiGetData<{ group: string; values: Record<string, unknown> }>(
    '/api/settings/notifications',
  );
  return mapNotificationsFromSettings(settings.values);
}

export async function getAuditLogs(): Promise<AuditLogRow[]> {
  if (useFixtures) return [...fixturesGetAuditLogs()];
  const rows = await apiGetList<{
    id: string;
    actor: string;
    action: string;
    createdAt: string;
  }>('/api/audit', { limit: 10 });
  return mapAuditLogsFromApi(rows);
}

export async function getReportSummary(kind: ActivityKind): Promise<ReportSummaryRow[]> {
  if (useFixtures) return [...fixturesGetReportSummary()];
  const results = await getResults(kind);
  return [...buildReportSummaryFromResults(results)];
}

type ActivityWritePayload = {
  kind?: ActivityKind;
  name?: string;
  subtitle?: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  durationMinutes?: number | null;
  passingPercent?: number | null;
  presentation?: 'one_at_a_time' | 'all_on_page' | 'timed_card';
  bankIds?: string[];
  code?: string;
  settings?: ActivitySettings;
};

function activityBody(payload: ActivityWritePayload) {
  return {
    ...payload,
    startsAt:
      payload.startsAt === undefined
        ? undefined
        : payload.startsAt
          ? payload.startsAt.toISOString()
          : null,
    endsAt:
      payload.endsAt === undefined
        ? undefined
        : payload.endsAt
          ? payload.endsAt.toISOString()
          : null,
  };
}

function mapActivityDetail(
  row: ApiActivityRow & {
    code: string;
    kind: ActivityKind;
    statusKey?: string;
    durationMinutes?: number | null;
    passingPercent?: number | null;
    presentation?: string;
    bankIds?: string[];
    settings?: ActivitySettings | null;
    startsAt?: string | Date | null;
    endsAt?: string | Date | null;
  },
): ActivityDetail {
  const base = mapActivityFromApi(row, 0);
  return {
    ...base,
    code: row.code,
    kind: row.kind,
    statusKey: row.statusKey ?? row.status.toLowerCase(),
    startsAt: row.startsAt ? new Date(row.startsAt).toISOString() : null,
    endsAt: row.endsAt ? new Date(row.endsAt).toISOString() : null,
    durationMinutes: row.durationMinutes ?? null,
    passingPercent: row.passingPercent ?? null,
    presentation: (row.presentation as ActivityDetail['presentation']) ?? 'one_at_a_time',
    bankIds: row.bankIds ?? [],
    settings: row.settings ?? null,
  };
}

export async function createActivity(
  payload: ActivityWritePayload & { kind: ActivityKind; name: string },
) {
  if (useFixtures) {
    return { id: crypto.randomUUID(), code: 'LOCAL' };
  }
  return apiPostData<{ id: string; code: string }>('/api/activities', activityBody(payload));
}

export async function getActivity(id: string): Promise<ActivityDetail> {
  if (useFixtures) {
    const rows = await getActivities('assessment');
    const quizRows = await getActivities('quiz');
    const found = [...rows, ...quizRows].find((a) => a.id === id);
    if (!found) throw new Error('Activity not found');
    return {
      ...found,
      code: 'LOCAL',
      kind: 'assessment',
      statusKey: found.status.toLowerCase(),
      startsAt: null,
      endsAt: null,
      durationMinutes: 60,
      passingPercent: 40,
      presentation: 'one_at_a_time',
      bankIds: [],
      settings: null,
    };
  }
  const row = await apiGetData<Parameters<typeof mapActivityDetail>[0]>(`/api/activities/${id}`);
  return mapActivityDetail(row);
}

export async function updateActivity(id: string, payload: ActivityWritePayload) {
  if (useFixtures) return { id, ...payload };
  return apiPatchData(`/api/activities/${id}`, activityBody(payload));
}

export async function getSettingsGroup(group: 'general' | 'access' | 'notifications' | 'system') {
  if (useFixtures) return { group, values: {} as Record<string, unknown> };
  return apiGetData<{ group: string; values: Record<string, unknown> }>(`/api/settings/${group}`);
}

export async function patchSettingsGroup(
  group: 'general' | 'access' | 'notifications' | 'system',
  values: Record<string, unknown>,
) {
  if (useFixtures) return { group, values };
  return apiPatchData<{ group: string; values: Record<string, unknown> }>(
    `/api/settings/${group}`,
    { values },
  );
}

export async function saveNotificationPreferences(
  prefs: { title: string; hint: string; enabled: boolean }[],
) {
  return patchSettingsGroup('notifications', notificationValuesFromPreferences(prefs));
}

export async function updateMembershipAccess(
  membershipId: string,
  patch: {
    assessmentAccess?: 'full' | 'edit' | 'view' | 'none';
    quizAccess?: 'full' | 'edit' | 'view' | 'none';
    isActive?: boolean;
    role?: 'super_admin' | 'admin';
  },
) {
  if (useFixtures) return patch;
  return apiPatchData(`/api/users/${membershipId}`, patch);
}

export async function publishActivity(activityId: string) {
  if (useFixtures) return { id: activityId };
  return apiPostData(`/api/activities/${activityId}/publish`);
}

export async function archiveActivity(activityId: string) {
  if (useFixtures) return { id: activityId };
  return apiPostData(`/api/activities/${activityId}/archive`);
}

export async function createStudent(payload: {
  name: string;
  email: string;
  phone?: string;
  course?: string;
  city?: string;
  code?: string;
}) {
  if (useFixtures) return { id: crypto.randomUUID(), code: payload.code ?? 'LOCAL' };
  return apiPostData<{ id: string; code: string }>('/api/students', payload);
}

export async function updateStudent(
  id: string,
  payload: {
    name?: string;
    email?: string;
    phone?: string | null;
    course?: string | null;
    city?: string | null;
    isActive?: boolean;
  },
) {
  if (useFixtures) return { id, ...payload };
  return apiPatchData(`/api/students/${id}`, payload);
}

export async function deactivateStudent(id: string) {
  if (useFixtures) return { id };
  return apiPostData(`/api/students/${id}/deactivate`);
}

export async function getStudent(id: string) {
  if (useFixtures) {
    const rows = await getStudents();
    const found = rows.find((s) => s.id === id);
    if (!found) throw new Error('Student not found');
    return found;
  }
  const row = await apiGetData<ApiStudentRow>(`/api/students/${id}`);
  return mapStudentFromApi(row);
}

export async function inviteUser(payload: {
  name: string;
  email: string;
  password: string;
  role?: 'super_admin' | 'admin';
  assessmentAccess?: 'full' | 'edit' | 'view' | 'none';
  quizAccess?: 'full' | 'edit' | 'view' | 'none';
}) {
  if (useFixtures) return { id: crypto.randomUUID() };
  return apiPostData('/api/users/invite', payload);
}

export async function deactivateMembership(membershipId: string) {
  if (useFixtures) return { id: membershipId };
  return apiPostData(`/api/users/${membershipId}/deactivate`);
}

export async function createQuestionBank(payload: {
  kind: ActivityKind;
  name: string;
  description?: string;
  presentation?: 'one_at_a_time' | 'all_on_page' | 'timed_card';
  code?: string;
}) {
  if (useFixtures) return { id: crypto.randomUUID(), code: payload.code ?? 'LOCAL' };
  return apiPostData<{ id: string; code: string }>('/api/banks', payload);
}

export async function updateQuestionBank(
  id: string,
  payload: {
    name?: string;
    description?: string;
    presentation?: 'one_at_a_time' | 'all_on_page' | 'timed_card';
    status?: 'draft' | 'active' | 'completed' | 'archived';
  },
) {
  if (useFixtures) return { id, ...payload };
  return apiPatchData(`/api/banks/${id}`, payload);
}

export async function getQuestionBank(id: string): Promise<
  QuestionBank & {
    items?: {
      id: string;
      type: string;
      stem: string;
      points: number;
    }[];
  }
> {
  if (useFixtures) {
    const rows = [...(await getQuestionBanks('assessment')), ...(await getQuestionBanks('quiz'))];
    const found = rows.find((b) => b.id === id);
    if (!found) throw new Error('Question bank not found');
    return { ...found, items: [] };
  }
  const row = await apiGetData<
    ApiBankRow & {
      items?: { id: string; type: string; stem: string; points: number }[];
    }
  >(`/api/banks/${id}`);
  return { ...mapBankFromApi(row), items: row.items ?? [] };
}

export async function addBankQuestion(
  bankId: string,
  payload: {
    type: string;
    stem: string;
    points?: number;
    options?: { label: string; body: string; isCorrect: boolean }[];
    answerKey?: Record<string, unknown>;
  },
) {
  if (useFixtures) return { id: crypto.randomUUID() };
  return apiPostData(`/api/banks/${bankId}/questions`, payload);
}

export async function assignRegistrations(activityId: string, studentIds: string[]) {
  if (useFixtures) return [];
  return apiPostData('/api/registrations/assign', { activityId, studentIds });
}

export async function unassignRegistrations(activityId: string, studentIds: string[]) {
  if (useFixtures) return [];
  return apiPostData('/api/registrations/unassign', { activityId, studentIds });
}

export async function publishResult(resultId: string) {
  if (useFixtures) return { id: resultId };
  return apiPostData(`/api/results/${resultId}/publish`);
}

export async function regradeResult(resultId: string, score: number, reason: string) {
  if (useFixtures) return { id: resultId };
  return apiPostData(`/api/results/${resultId}/regrade`, { score, reason });
}

export async function getResult(id: string): Promise<ResultDetail> {
  if (useFixtures) {
    const rows = [...(await getResults('assessment')), ...(await getResults('quiz'))];
    const found = rows.find((r) => r.id === id);
    if (!found) throw new Error('Result not found');
    return found;
  }
  const row = await apiGetData<
    Parameters<typeof mapResultFromApi>[0] & {
      revisions?: { id: string; score: number; maxScore: number; percent: number }[];
    }
  >(`/api/results/${id}`);
  return { ...mapResultFromApi(row), revisions: row.revisions };
}

export async function getRegistration(kind: ActivityKind, registrationId: string) {
  const rows = await getRegistrations(kind);
  const found = rows.find((r) => r.registrationId === registrationId);
  if (!found) throw new Error('Registration not found');
  return found;
}

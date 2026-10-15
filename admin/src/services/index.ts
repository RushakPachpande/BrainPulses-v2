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
  ActivityKind,
  AdminUser,
  AuditLogRow,
  DashboardData,
  NotificationPreference,
  PermissionRow,
  ReportSummaryRow,
  Student,
} from './types';

export type { ActivityKind, Student, AdminUser, AccessUser, DashboardData } from './types';

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

export async function createActivity(payload: {
  kind: ActivityKind;
  name: string;
  subtitle?: string;
  startsAt?: Date;
  endsAt?: Date;
  presentation?: 'one_at_a_time' | 'all_on_page' | 'timed_card';
  bankIds?: string[];
}) {
  if (useFixtures) {
    return { id: crypto.randomUUID(), code: 'LOCAL' };
  }
  return apiPostData<{ id: string; code: string }>('/api/activities', {
    ...payload,
    startsAt: payload.startsAt?.toISOString(),
    endsAt: payload.endsAt?.toISOString(),
  });
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
    assessmentAccess?: 'full' | 'none';
    quizAccess?: 'full' | 'none';
    isActive?: boolean;
  },
) {
  if (useFixtures) return patch;
  return apiPatchData(`/api/users/${membershipId}`, patch);
}

export async function publishActivity(activityId: string) {
  if (useFixtures) return { id: activityId };
  return apiPostData(`/api/activities/${activityId}/publish`);
}

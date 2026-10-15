import {
  apiGetData,
  apiGetList,
  apiPatchData,
  apiPostData,
  setAccessToken,
} from '../lib/api-client';
import type {
  AttemptQuestion,
  AttemptState,
  StudentActivity,
  StudentProfile,
  StudentResultDetail,
  StudentResultSummary,
} from './types';

export async function studentSignIn(email: string, password: string, organizationSlug?: string) {
  const data = await apiPostData<{
    accessToken: string;
    student: { id: string; code: string; name: string; email: string };
    organization: { id: string; name: string; slug: string };
  }>('/api/auth/student/sign-in', {
    email,
    password,
    ...(organizationSlug ? { organizationSlug } : {}),
  });
  setAccessToken(data.accessToken);
  return data;
}

export function studentSignOut() {
  setAccessToken(null);
}

export function getMe() {
  return apiGetData<StudentProfile>('/api/student/me');
}

export function patchMe(name: string) {
  return apiPatchData<StudentProfile>('/api/student/me', { name });
}

export function listActivities(kind?: 'assessment' | 'quiz' | 'all') {
  return apiGetList<StudentActivity>('/api/student/activities', {
    limit: 100,
    kind: kind ?? 'all',
  });
}

export function listResults(kind?: 'assessment' | 'quiz' | 'all') {
  return apiGetList<StudentResultSummary>('/api/student/results', {
    limit: 100,
    kind: kind ?? 'all',
  });
}

export function getResult(id: string) {
  return apiGetData<StudentResultDetail>(`/api/student/results/${id}`);
}

export function startAttempt(activityId: string) {
  return apiPostData<{
    attempt: AttemptState;
    questions: AttemptQuestion[];
  }>('/api/attempts/start', { activityId });
}

export function resumeAttempt(attemptId: string) {
  return apiGetData<{
    attempt: AttemptState;
    questions: AttemptQuestion[];
    submitted?: boolean;
    result?: { id: string };
  }>(`/api/attempts/${attemptId}/resume`);
}

export function saveAttempt(
  attemptId: string,
  revision: number,
  responses: { questionVersionId: string; answer: unknown }[],
) {
  return apiPostData<{
    acknowledged: boolean;
    revision: number;
    attempt: AttemptState;
  }>(`/api/attempts/${attemptId}/save`, { revision, responses });
}

export function submitAttempt(attemptId: string, idempotencyKey: string) {
  return apiPostData<{
    attempt: AttemptState;
    result: { id: string; score: unknown; percent: unknown; maxScore: unknown };
  }>(`/api/attempts/${attemptId}/submit`, undefined, {
    'idempotency-key': idempotencyKey,
  });
}

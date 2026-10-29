import {
  apiGetData,
  apiGetList,
  apiPatchData,
  apiPostData,
  getAccessToken,
  setAccessToken,
} from '../lib/api-client';
import { invalidateClient } from '../lib/query-client';
import type {
  AttemptQuestion,
  AttemptState,
  StudentActivity,
  StudentProfile,
  StudentResultDetail,
  StudentResultSummary,
} from './types';
import type { StudentPages } from '../lib/student-pages';

type StudentAuthPayload = {
  accessToken: string;
  student: { id: string; code: string; name: string; email: string };
  organization: { id: string; name: string; slug: string };
};

export async function studentSignInByCode(
  code: string,
  organizationSlug?: string,
  replaceSession?: boolean,
) {
  const data = await apiPostData<StudentAuthPayload>('/api/auth/student/sign-in-by-code', {
    code,
    ...(organizationSlug ? { organizationSlug } : {}),
    ...(replaceSession ? { replaceSession: true } : {}),
  });
  setAccessToken(data.accessToken);
  return data;
}

export async function studentRequestOtp(
  countryCode: string,
  mobileNumber: string,
  organizationSlug?: string,
) {
  return apiPostData<{ ok: boolean; message: string }>('/api/auth/student/request-otp', {
    countryCode,
    mobileNumber,
    ...(organizationSlug ? { organizationSlug } : {}),
  });
}

export async function studentResendOtp(
  countryCode: string,
  mobileNumber: string,
  organizationSlug?: string,
) {
  return apiPostData<{ ok: boolean; message: string }>('/api/auth/student/resend-otp', {
    countryCode,
    mobileNumber,
    ...(organizationSlug ? { organizationSlug } : {}),
  });
}

export async function studentVerifyOtp(
  countryCode: string,
  mobileNumber: string,
  otp: string,
  organizationSlug?: string,
  replaceSession?: boolean,
) {
  const data = await apiPostData<StudentAuthPayload>('/api/auth/student/verify-otp', {
    countryCode,
    mobileNumber,
    otp,
    ...(organizationSlug ? { organizationSlug } : {}),
    ...(replaceSession ? { replaceSession: true } : {}),
  });
  setAccessToken(data.accessToken);
  return data;
}

export async function studentSignOut() {
  const token = getAccessToken();
  if (token) {
    try {
      await apiPostData<{ ok: boolean }>('/api/auth/student/sign-out', {});
    } catch {
      /* best-effort; clear local token anyway */
    }
  }
  setAccessToken(null);
}

export function getMe() {
  return apiGetData<StudentProfile>('/api/student/me');
}

export function getStudentPages() {
  return apiGetData<StudentPages>('/api/student/pages');
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

export async function startAttempt(activityId: string, roundId?: string) {
  const data = await apiPostData<{
    attempt: AttemptState;
    questions: AttemptQuestion[];
  }>('/api/attempts/start', {
    activityId,
    ...(roundId ? { roundId } : {}),
  });
  invalidateClient(['activities', 'dashboard']);
  return data;
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
  }>(`/api/attempts/${attemptId}/save`, { revision, responses }, undefined, { background: true });
}

/**
 * Best-effort save on tab close. Uses fetch keepalive; ignores response body.
 * Does not drive the loading overlay.
 */
export function saveAttemptKeepalive(
  attemptId: string,
  revision: number,
  responses: { questionVersionId: string; answer: unknown }[],
): void {
  if (responses.length === 0) return;
  const token = getAccessToken();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const base = import.meta.env.DEV
    ? ''
    : String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  try {
    void fetch(`${base}/api/attempts/${attemptId}/save`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ revision, responses }),
      keepalive: true,
    });
  } catch {
    /* ignore — tab is closing */
  }
}

const SUBMIT_KEY_PREFIX = 'bp-submit-key:';

export function submitIdempotencyKeyFor(attemptId: string): string {
  const storageKey = `${SUBMIT_KEY_PREFIX}${attemptId}`;
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const key = `submit-${attemptId}`;
    sessionStorage.setItem(storageKey, key);
    return key;
  } catch {
    return `submit-${attemptId}`;
  }
}

export function clearSubmitIdempotencyKey(attemptId: string): void {
  try {
    sessionStorage.removeItem(`${SUBMIT_KEY_PREFIX}${attemptId}`);
  } catch {
    /* ignore */
  }
}

export async function submitAttempt(attemptId: string, idempotencyKey: string) {
  const data = await apiPostData<{
    attempt: AttemptState;
    result: { id: string; score: unknown; percent: unknown; maxScore: unknown };
  }>(`/api/attempts/${attemptId}/submit`, undefined, {
    'idempotency-key': idempotencyKey,
  });
  invalidateClient(['activities', 'results', 'dashboard']);
  return data;
}

/** Renew the per-question deadline after moving forward (or when the window expires). */
export async function advanceAttempt(attemptId: string) {
  return apiPostData<{
    attempt: AttemptState;
    submitted: boolean;
    result?: { id: string };
  }>(`/api/attempts/${attemptId}/advance`);
}

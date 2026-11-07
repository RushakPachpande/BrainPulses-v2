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
  ParticipantActivity,
  ParticipantProfile,
  ParticipantResultDetail,
  ParticipantResultSummary,
} from './types';
import type { ParticipantPages } from '../lib/participant-pages';

type ParticipantAuthPayload = {
  accessToken: string;
  participant: { id: string; code: string; name: string; email: string };
  organization: { id: string; name: string; slug: string };
};

export function getParticipantLoginOptions(organizationSlug?: string) {
  const query = organizationSlug ? `?organizationSlug=${encodeURIComponent(organizationSlug)}` : '';
  return apiGetData<{ phoneLogin: boolean }>(`/api/auth/participant/login-options${query}`);
}

export async function participantSignInByCode(
  code: string,
  organizationSlug?: string,
  replaceSession?: boolean,
) {
  const data = await apiPostData<ParticipantAuthPayload>(
    '/api/auth/participant/sign-in-by-code',
    {
      code,
      ...(organizationSlug ? { organizationSlug } : {}),
      ...(replaceSession ? { replaceSession: true } : {}),
    },
    undefined,
    { blocking: true },
  );
  setAccessToken(data.accessToken);
  return data;
}

export async function participantRequestOtp(
  countryCode: string,
  mobileNumber: string,
  organizationSlug?: string,
) {
  return apiPostData<{ ok: boolean; message: string }>(
    '/api/auth/participant/request-otp',
    {
      countryCode,
      mobileNumber,
      ...(organizationSlug ? { organizationSlug } : {}),
    },
    undefined,
    { blocking: true },
  );
}

export async function participantResendOtp(
  countryCode: string,
  mobileNumber: string,
  organizationSlug?: string,
) {
  return apiPostData<{ ok: boolean; message: string }>(
    '/api/auth/participant/resend-otp',
    {
      countryCode,
      mobileNumber,
      ...(organizationSlug ? { organizationSlug } : {}),
    },
    undefined,
    { blocking: true },
  );
}

export async function participantVerifyOtp(
  countryCode: string,
  mobileNumber: string,
  otp: string,
  organizationSlug?: string,
  replaceSession?: boolean,
) {
  const data = await apiPostData<ParticipantAuthPayload>(
    '/api/auth/participant/verify-otp',
    {
      countryCode,
      mobileNumber,
      otp,
      ...(organizationSlug ? { organizationSlug } : {}),
      ...(replaceSession ? { replaceSession: true } : {}),
    },
    undefined,
    { blocking: true },
  );
  setAccessToken(data.accessToken);
  return data;
}

export async function participantSignOut() {
  const token = getAccessToken();
  if (token) {
    try {
      await apiPostData<{ ok: boolean }>('/api/auth/participant/sign-out', {});
    } catch {
      /* best-effort; clear local token anyway */
    }
  }
  setAccessToken(null);
}

export function getMe() {
  return apiGetData<ParticipantProfile>('/api/participant/me');
}

export function getParticipantPages() {
  return apiGetData<ParticipantPages>('/api/participant/pages');
}

export function patchMe(name: string) {
  return apiPatchData<ParticipantProfile>('/api/participant/me', { name });
}

export function listActivities(kind?: 'assessment' | 'quiz' | 'all') {
  return apiGetList<ParticipantActivity>('/api/participant/activities', {
    limit: 100,
    kind: kind ?? 'all',
  });
}

export function listResults(kind?: 'assessment' | 'quiz' | 'all') {
  return apiGetList<ParticipantResultSummary>('/api/participant/results', {
    limit: 100,
    kind: kind ?? 'all',
  });
}

export function getResult(id: string) {
  return apiGetData<ParticipantResultDetail>(`/api/participant/results/${id}`);
}

export async function startAttempt(activityId: string, roundId?: string) {
  const data = await apiPostData<{
    attempt: AttemptState;
    questions: AttemptQuestion[];
  }>(
    '/api/attempts/start',
    {
      activityId,
      ...(roundId ? { roundId } : {}),
    },
    undefined,
    { blocking: true },
  );
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

export type AttemptSaveProgress = {
  currentQuestionIndex?: number;
  closedQuestionVersionIds?: string[];
};

export function saveAttempt(
  attemptId: string,
  revision: number,
  responses: { questionVersionId: string; answer: unknown }[],
  progress?: AttemptSaveProgress,
) {
  return apiPostData<{
    acknowledged: boolean;
    revision: number;
    attempt: AttemptState;
  }>(`/api/attempts/${attemptId}/save`, {
    revision,
    responses,
    ...(progress?.currentQuestionIndex !== undefined
      ? { currentQuestionIndex: progress.currentQuestionIndex }
      : {}),
    ...(progress?.closedQuestionVersionIds
      ? { closedQuestionVersionIds: progress.closedQuestionVersionIds }
      : {}),
  });
}

/**
 * Best-effort save on tab close. Uses fetch keepalive; ignores response body.
 * Does not drive the loading overlay.
 */
export function saveAttemptKeepalive(
  attemptId: string,
  revision: number,
  responses: { questionVersionId: string; answer: unknown }[],
  progress?: AttemptSaveProgress,
): void {
  if (
    responses.length === 0 &&
    progress?.currentQuestionIndex === undefined &&
    !progress?.closedQuestionVersionIds?.length
  ) {
    return;
  }
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
      body: JSON.stringify({
        revision,
        responses,
        ...(progress?.currentQuestionIndex !== undefined
          ? { currentQuestionIndex: progress.currentQuestionIndex }
          : {}),
        ...(progress?.closedQuestionVersionIds
          ? { closedQuestionVersionIds: progress.closedQuestionVersionIds }
          : {}),
      }),
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
  }>(
    `/api/attempts/${attemptId}/submit`,
    undefined,
    {
      'idempotency-key': idempotencyKey,
    },
    { blocking: true },
  );
  invalidateClient(['activities', 'results', 'dashboard']);
  return data;
}

/** Renew the per-question deadline after moving forward (or when the window expires). */
export async function advanceAttempt(attemptId: string) {
  return apiPostData<{
    attempt: AttemptState;
    submitted: boolean;
    result?: { id: string };
  }>(`/api/attempts/${attemptId}/advance`, undefined, undefined, { blocking: true });
}

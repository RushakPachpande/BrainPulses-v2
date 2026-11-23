import { apiGetData, apiPatchData, apiPostData, apiRequest } from '@/lib/api-client';
import type {
  ContestFormOverview,
  ContestFormQuiz,
  ContestFormRecord,
  ContestFormRegistrant,
} from '@/lib/contest-form';

export type SaveContestFormPayload = {
  mode: 'draft' | 'step1' | 'save';
  sponsorId?: string | null;
  contestId?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  seats?: number | null;
  welcomeMessage?: string | null;
  showContestImage?: boolean;
  showSponsorName?: boolean;
  showRegistrationCloses?: boolean;
  showSeatsLeft?: boolean;
  fields?: ContestFormRecord['fields'];
  linkActive?: boolean;
  domainRestriction?: boolean;
  allowedDomains?: string[];
  domainMessage?: string;
  keepExistingId?: boolean;
  matchRule?: ContestFormRecord['matchRule'];
  quizIds?: string[];
  thankYouEnabled?: boolean;
  thankYouKind?: ContestFormRecord['thankYouKind'];
  thankYouTitle?: string | null;
  thankYouHtml?: string | null;
  thankYouImageFileId?: string | null;
  thankYouShowNextSteps?: boolean;
  thankYouShowQuizzes?: boolean;
  thankYouButtonLabel?: string | null;
  thankYouButtonUrl?: string | null;
};

export function getContestFormOverview(signal?: AbortSignal) {
  return apiGetData<ContestFormOverview>('/api/contest-forms', { signal });
}

export function getContestForm(id: string, signal?: AbortSignal) {
  return apiGetData<ContestFormRecord>(`/api/contest-forms/${id}`, { signal });
}

export function getContestFormRegistrants(id: string, signal?: AbortSignal) {
  return apiGetData<ContestFormRegistrant[]>(`/api/contest-forms/${id}/registrants`, { signal });
}

export function getContestQuizzes(contestId: string, signal?: AbortSignal) {
  return apiGetData<ContestFormQuiz[]>(
    `/api/contest-forms/quizzes?contestId=${encodeURIComponent(contestId)}`,
    { signal },
  );
}

export function createContestForm(payload: SaveContestFormPayload) {
  return apiPostData<ContestFormRecord>('/api/contest-forms', payload);
}

export function updateContestForm(id: string, payload: SaveContestFormPayload) {
  return apiPatchData<ContestFormRecord>(`/api/contest-forms/${id}`, payload);
}

export function regenerateContestFormLink(id: string) {
  return apiPostData<ContestFormRecord>(`/api/contest-forms/${id}/regenerate-link`, {});
}

export async function deleteContestForm(id: string, password: string) {
  const body = await apiRequest<{ data: { deleted: true; participantsRemoved: number } }>(
    `/api/contest-forms/${id}`,
    { method: 'DELETE', body: JSON.stringify({ password }) },
  );
  return body.data;
}

export function giveContestFormQuizzes(id: string, activityIds: string[]) {
  return apiPostData<{ form: ContestFormRecord; added: number; registrationCount: number }>(
    `/api/contest-forms/${id}/quizzes`,
    { activityIds },
  );
}

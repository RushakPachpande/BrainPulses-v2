import { apiGetData, apiPostData, apiPatchData } from '@/lib/api-client';
import type { ContestFormOverview, ContestFormQuiz, ContestFormRecord } from '@/lib/contest-form';

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
};

export function getContestFormOverview() {
  return apiGetData<ContestFormOverview>('/api/contest-forms');
}

export function getContestForm(id: string) {
  return apiGetData<ContestFormRecord>(`/api/contest-forms/${id}`);
}

export function getContestQuizzes(contestId: string) {
  return apiGetData<ContestFormQuiz[]>(
    `/api/contest-forms/quizzes?contestId=${encodeURIComponent(contestId)}`,
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

export function giveContestFormQuizzes(id: string, activityIds: string[]) {
  return apiPostData<{ form: ContestFormRecord; added: number; registrationCount: number }>(
    `/api/contest-forms/${id}/quizzes`,
    { activityIds },
  );
}

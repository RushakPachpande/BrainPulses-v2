export type ParticipantPageKey =
  'overview' | 'quizzes' | 'assessments' | 'results' | 'profile' | 'help';

export type ParticipantPages = Record<ParticipantPageKey, boolean>;

export const DEFAULT_PARTICIPANT_PAGES: ParticipantPages = {
  overview: true,
  quizzes: true,
  assessments: true,
  results: true,
  profile: true,
  help: true,
};

/** Page toggles no longer gate the portal. Every participant page stays available. */
export async function getParticipantPages(_organizationId: string): Promise<ParticipantPages> {
  return { ...DEFAULT_PARTICIPANT_PAGES };
}

export async function assertParticipantPageEnabled(
  _organizationId: string,
  _page: ParticipantPageKey,
) {
  return;
}

export async function assertActivityPageEnabled(_organizationId: string, _kind: string) {
  return;
}

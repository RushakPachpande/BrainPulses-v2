import { forbidden } from './errors.js';
import { prisma } from './prisma.js';

export const PARTICIPANT_PAGE_OFF_MESSAGE = 'This participant page is turned off.';

export const PARTICIPANT_PAGE_SETTING_KEYS = {
  overview: 'participantPageOverview',
  quizzes: 'participantPageQuizzes',
  assessments: 'participantPageAssessments',
  results: 'participantPageResults',
  profile: 'participantPageProfile',
  help: 'participantPageHelp',
} as const;

export type ParticipantPageKey = keyof typeof PARTICIPANT_PAGE_SETTING_KEYS;

export type ParticipantPages = Record<ParticipantPageKey, boolean>;

export const DEFAULT_PARTICIPANT_PAGES: ParticipantPages = {
  overview: true,
  quizzes: true,
  assessments: true,
  results: true,
  profile: true,
  help: true,
};

export function participantPagesFromValues(values: Record<string, unknown>): ParticipantPages {
  const pages = { ...DEFAULT_PARTICIPANT_PAGES };
  for (const key of Object.keys(PARTICIPANT_PAGE_SETTING_KEYS) as ParticipantPageKey[]) {
    const raw = values[PARTICIPANT_PAGE_SETTING_KEYS[key]];
    if (typeof raw === 'boolean') pages[key] = raw;
  }
  return pages;
}

export async function getParticipantPages(organizationId: string): Promise<ParticipantPages> {
  const rows = await prisma.setting.findMany({
    where: {
      organizationId,
      group: 'general',
      key: { in: [...Object.values(PARTICIPANT_PAGE_SETTING_KEYS)] },
    },
  });
  const values: Record<string, unknown> = {};
  for (const row of rows) values[row.key] = row.value;
  return participantPagesFromValues(values);
}

export async function assertParticipantPageEnabled(
  organizationId: string,
  page: ParticipantPageKey,
) {
  const pages = await getParticipantPages(organizationId);
  if (!pages[page]) throw forbidden(PARTICIPANT_PAGE_OFF_MESSAGE);
}

export async function assertActivityPageEnabled(organizationId: string, kind: string) {
  if (kind === 'quiz') return assertParticipantPageEnabled(organizationId, 'quizzes');
  if (kind === 'assessment') return assertParticipantPageEnabled(organizationId, 'assessments');
}

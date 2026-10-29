import { forbidden } from './errors.js';
import { prisma } from './prisma.js';

export const STUDENT_PAGE_OFF_MESSAGE = 'This student page is turned off.';

export const STUDENT_PAGE_SETTING_KEYS = {
  overview: 'studentPageOverview',
  quizzes: 'studentPageQuizzes',
  assessments: 'studentPageAssessments',
  results: 'studentPageResults',
  profile: 'studentPageProfile',
  help: 'studentPageHelp',
} as const;

export type StudentPageKey = keyof typeof STUDENT_PAGE_SETTING_KEYS;

export type StudentPages = Record<StudentPageKey, boolean>;

export const DEFAULT_STUDENT_PAGES: StudentPages = {
  overview: true,
  quizzes: true,
  assessments: true,
  results: true,
  profile: true,
  help: true,
};

export function studentPagesFromValues(values: Record<string, unknown>): StudentPages {
  const pages = { ...DEFAULT_STUDENT_PAGES };
  for (const key of Object.keys(STUDENT_PAGE_SETTING_KEYS) as StudentPageKey[]) {
    const raw = values[STUDENT_PAGE_SETTING_KEYS[key]];
    if (typeof raw === 'boolean') pages[key] = raw;
  }
  return pages;
}

export async function getStudentPages(organizationId: string): Promise<StudentPages> {
  const rows = await prisma.setting.findMany({
    where: {
      organizationId,
      group: 'general',
      key: { in: [...Object.values(STUDENT_PAGE_SETTING_KEYS)] },
    },
  });
  const values: Record<string, unknown> = {};
  for (const row of rows) values[row.key] = row.value;
  return studentPagesFromValues(values);
}

export async function assertStudentPageEnabled(organizationId: string, page: StudentPageKey) {
  const pages = await getStudentPages(organizationId);
  if (!pages[page]) throw forbidden(STUDENT_PAGE_OFF_MESSAGE);
}

export async function assertActivityPageEnabled(organizationId: string, kind: string) {
  if (kind === 'quiz') return assertStudentPageEnabled(organizationId, 'quizzes');
  if (kind === 'assessment') return assertStudentPageEnabled(organizationId, 'assessments');
}

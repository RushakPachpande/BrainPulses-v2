export type PageMeta = {
  title: string;
  crumb: string;
  description?: string;
};

export const pageMeta: Record<string, PageMeta> = {
  '/dashboard': { crumb: 'Brainpules / Dashboard', title: 'Admin Dashboard' },
  '/students': {
    crumb: 'Brainpules / Students',
    title: 'Students',
    description: 'Manage student accounts, view details, and track their learning progress.',
  },
  '/users': {
    crumb: 'Brainpules / Users',
    title: 'User Management',
    description: 'Manage admin users, roles, and access to assessments and quizzes.',
  },
  '/assessments': {
    crumb: 'Brainpules / Assessment',
    title: 'Assessments',
    description: 'Create and manage assessments, track participation, and monitor performance.',
  },
  '/assessments/banks': {
    crumb: 'Brainpules / Assessment / Question Banks',
    title: 'Assessment Question Banks',
    description:
      'Manage reusable question banks for assessments. A bank can be attached to multiple assessments.',
  },
  '/assessments/new': {
    crumb: 'Brainpules / Assessment / Create Assessment',
    title: 'Create Assessment',
  },
  '/assessments/registrations': {
    crumb: 'Brainpules / Assessment / Registrations',
    title: 'Registrations & Student Data',
    description:
      'View all student registrations, their assigned question banks, and assessment status.',
  },
  '/assessments/reports': {
    crumb: 'Brainpules / Assessment / Reports',
    title: 'Assessment Reports & Results',
  },
  '/quizzes': {
    crumb: 'Brainpules / Quiz',
    title: 'Quizzes',
    description: 'Create and manage quizzes, track participation, and monitor performance.',
  },
  '/quizzes/banks': {
    crumb: 'Brainpules / Quiz / Question Banks',
    title: 'Quiz Question Banks',
    description:
      'Manage reusable question banks for quizzes. Banks use MCQs with one correct answer.',
  },
  '/quizzes/new': { crumb: 'Brainpules / Quiz / Create Quiz', title: 'Create Quiz' },
  '/quizzes/registrations': {
    crumb: 'Brainpules / Quiz / Registrations',
    title: 'Registrations & Student Data',
    description:
      'View all student registrations, their assigned question banks, and quiz attempt status.',
  },
  '/quizzes/reports': { crumb: 'Brainpules / Quiz / Reports', title: 'Quiz Reports & Results' },
  '/settings': { crumb: 'Brainpules / Settings / General Settings', title: 'General Settings' },
  '/settings/access': {
    crumb: 'Brainpules / Settings / User & Access',
    title: 'User & Access Settings',
  },
  '/settings/notifications': {
    crumb: 'Brainpules / Settings / Notification',
    title: 'Notification Settings',
  },
  '/settings/system': {
    crumb: 'Brainpules / Settings / System Settings',
    title: 'System Settings',
  },
};

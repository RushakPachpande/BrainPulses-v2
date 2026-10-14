export type PageMeta = {
  title: string;
  crumb: string;
  description?: string;
};

export const pageMeta: Record<string, PageMeta> = {
  '/dashboard': { crumb: 'BrainPulses / Dashboard', title: 'Admin Dashboard' },
  '/students': {
    crumb: 'BrainPulses / Students',
    title: 'Students',
    description: 'Manage student accounts, view details, and track their learning progress.',
  },
  '/users': {
    crumb: 'BrainPulses / Users',
    title: 'User Management',
    description: 'Manage admin users, roles, and access to assessments and quizzes.',
  },
  '/assessments': {
    crumb: 'BrainPulses / Assessment',
    title: 'Assessments',
    description: 'Create and manage assessments, track participation, and monitor performance.',
  },
  '/assessments/banks': {
    crumb: 'BrainPulses / Assessment / Question Banks',
    title: 'Assessment Question Banks',
    description:
      'Manage reusable question banks for assessments. A bank can be attached to multiple assessments.',
  },
  '/assessments/new': {
    crumb: 'BrainPulses / Assessment / Create Assessment',
    title: 'Create Assessment',
  },
  '/assessments/registrations': {
    crumb: 'BrainPulses / Assessment / Registrations',
    title: 'Registrations & Student Data',
    description:
      'View all student registrations, their assigned question banks, and assessment status.',
  },
  '/assessments/reports': {
    crumb: 'BrainPulses / Assessment / Reports',
    title: 'Assessment Reports & Results',
  },
  '/quizzes': {
    crumb: 'BrainPulses / Quiz',
    title: 'Quizzes',
    description: 'Create and manage quizzes, track participation, and monitor performance.',
  },
  '/quizzes/banks': {
    crumb: 'BrainPulses / Quiz / Question Banks',
    title: 'Quiz Question Banks',
    description:
      'Manage reusable question banks for quizzes. Banks use MCQs with one correct answer.',
  },
  '/quizzes/new': { crumb: 'BrainPulses / Quiz / Create Quiz', title: 'Create Quiz' },
  '/quizzes/registrations': {
    crumb: 'BrainPulses / Quiz / Registrations',
    title: 'Registrations & Student Data',
    description:
      'View all student registrations, their assigned question banks, and quiz attempt status.',
  },
  '/quizzes/reports': { crumb: 'BrainPulses / Quiz / Reports', title: 'Quiz Reports & Results' },
  '/settings': { crumb: 'BrainPulses / Settings / General Settings', title: 'General Settings' },
  '/settings/access': {
    crumb: 'BrainPulses / Settings / User & Access',
    title: 'User & Access Settings',
  },
  '/settings/notifications': {
    crumb: 'BrainPulses / Settings / Notification',
    title: 'Notification Settings',
  },
  '/settings/system': {
    crumb: 'BrainPulses / Settings / System Settings',
    title: 'System Settings',
  },
};

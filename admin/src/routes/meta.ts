export const pageMeta: Record<string, { title: string; crumb: string }> = {
  '/dashboard': { crumb: 'Brainpules / Dashboard', title: 'Admin Dashboard' },
  '/students': { crumb: 'Brainpules / Students', title: 'Students' },
  '/users': { crumb: 'Brainpules / Users', title: 'User Management' },
  '/assessments': { crumb: 'Brainpules / Assessment', title: 'Assessments' },
  '/assessments/banks': {
    crumb: 'Brainpules / Assessment / Question Banks',
    title: 'Assessment Question Banks',
  },
  '/assessments/new': {
    crumb: 'Brainpules / Assessment / Create Assessment',
    title: 'Create Assessment',
  },
  '/assessments/registrations': {
    crumb: 'Brainpules / Assessment / Registrations',
    title: 'Registrations & Student Data',
  },
  '/assessments/reports': {
    crumb: 'Brainpules / Assessment / Reports',
    title: 'Assessment Reports & Results',
  },
  '/quizzes': { crumb: 'Brainpules / Quiz', title: 'Quizzes' },
  '/quizzes/banks': { crumb: 'Brainpules / Quiz / Question Banks', title: 'Quiz Question Banks' },
  '/quizzes/new': { crumb: 'Brainpules / Quiz / Create Quiz', title: 'Create Quiz' },
  '/quizzes/registrations': {
    crumb: 'Brainpules / Quiz / Registrations',
    title: 'Registrations & Student Data',
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

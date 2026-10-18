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
  '/students/new': {
    crumb: 'BrainPulses / Students / Add Student',
    title: 'Add Student',
  },
  '/users': {
    crumb: 'BrainPulses / Users',
    title: 'User Management',
    description: 'Manage admin users, roles, and access to assessments and quizzes.',
  },
  '/users/new': {
    crumb: 'BrainPulses / Users / Invite User',
    title: 'Invite User',
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
  '/assessments/banks/new': {
    crumb: 'BrainPulses / Assessment / Question Banks / Create',
    title: 'Create Question Bank',
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
  '/assessments/registrations/new': {
    crumb: 'BrainPulses / Assessment / Registrations / Assign',
    title: 'Assign Students',
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
  '/quizzes/banks/new': {
    crumb: 'BrainPulses / Quiz / Question Banks / Create',
    title: 'Create Question Bank',
  },
  '/quizzes/new': { crumb: 'BrainPulses / Quiz / Create Quiz', title: 'Create Quiz' },
  '/quizzes/registrations': {
    crumb: 'BrainPulses / Quiz / Registrations',
    title: 'Registrations & Student Data',
    description:
      'View all student registrations, their assigned question banks, and quiz attempt status.',
  },
  '/quizzes/registrations/new': {
    crumb: 'BrainPulses / Quiz / Registrations / Assign',
    title: 'Assign Students',
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
  '/settings/design-system': {
    crumb: 'BrainPulses / Settings / Design System',
    title: 'Design System',
    description: 'The BrainPulses brand, shared design tokens, and interactive UI patterns.',
  },
  '/settings/system': {
    crumb: 'BrainPulses / Settings / System Settings',
    title: 'System Settings',
  },
};

export function resolvePageMeta(pathname: string): PageMeta {
  if (pageMeta[pathname]) return pageMeta[pathname]!;
  if (/^\/students\/[^/]+\/edit$/.test(pathname)) {
    return { crumb: 'BrainPulses / Students / Edit Student', title: 'Edit Student' };
  }
  if (/^\/students\/[^/]+$/.test(pathname)) {
    return { crumb: 'BrainPulses / Students / View Student', title: 'View Student' };
  }
  if (/^\/users\/[^/]+\/edit$/.test(pathname)) {
    return { crumb: 'BrainPulses / Users / Edit User', title: 'Edit User' };
  }
  if (/^\/users\/[^/]+$/.test(pathname) && pathname !== '/users/new') {
    return { crumb: 'BrainPulses / Users / View User', title: 'View User' };
  }
  const activityEdit = pathname.match(/^\/(assessments|quizzes)\/([^/]+)\/edit$/);
  if (activityEdit && !['banks', 'registrations', 'reports', 'new'].includes(activityEdit[2]!)) {
    const kind = activityEdit[1] === 'quizzes' ? 'Quiz' : 'Assessment';
    return {
      crumb: `BrainPulses / ${kind} / Edit`,
      title: `Edit ${kind}`,
    };
  }
  const activityView = pathname.match(/^\/(assessments|quizzes)\/([^/]+)$/);
  if (activityView && !['banks', 'registrations', 'reports', 'new'].includes(activityView[2]!)) {
    const kind = activityView[1] === 'quizzes' ? 'Quiz' : 'Assessment';
    return { crumb: `BrainPulses / ${kind} / View`, title: `View ${kind}` };
  }
  if (/^\/(assessments|quizzes)\/banks\/[^/]+\/edit$/.test(pathname)) {
    return { crumb: 'BrainPulses / Question Banks / Edit', title: 'Edit Question Bank' };
  }
  if (/^\/(assessments|quizzes)\/banks\/[^/]+$/.test(pathname)) {
    return { crumb: 'BrainPulses / Question Banks / View', title: 'View Question Bank' };
  }
  if (/^\/(assessments|quizzes)\/registrations\/[^/]+\/edit$/.test(pathname)) {
    return { crumb: 'BrainPulses / Registrations / Edit', title: 'Edit Registration' };
  }
  if (/^\/(assessments|quizzes)\/registrations\/[^/]+$/.test(pathname)) {
    return { crumb: 'BrainPulses / Registrations / View', title: 'View Registration' };
  }
  if (/^\/(assessments|quizzes)\/reports\/[^/]+$/.test(pathname)) {
    return { crumb: 'BrainPulses / Reports / Result', title: 'View Result' };
  }
  return pageMeta['/dashboard']!;
}

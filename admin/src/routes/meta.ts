export type PageMeta = {
  title: string;
  crumb: string;
  description?: string;
};

export const pageMeta: Record<string, PageMeta> = {
  '/dashboard': { crumb: 'BrainPulses / Dashboard', title: 'Admin Dashboard' },
  '/participants': {
    crumb: 'BrainPulses / Participants',
    title: 'Participants',
    description: 'Manage participant accounts, view details, and track their learning progress.',
  },
  '/sponsors': {
    crumb: 'BrainPulses / Sponsors',
    title: 'Sponsors',
    description: 'Manage sponsors used by quizzes.',
  },
  '/contests': {
    crumb: 'BrainPulses / Contests',
    title: 'Contests',
    description: 'Manage contests and the sponsor each one belongs to.',
  },
  '/users': {
    crumb: 'BrainPulses / Users',
    title: 'User Management',
    description: 'Manage admin users, roles, and access to assessments and quizzes.',
  },
  '/change-password': {
    crumb: 'BrainPulses / Change password',
    title: 'Change password',
    description: 'Choose a new password before continuing.',
  },
  '/assessments': {
    crumb: 'BrainPulses / Assessment',
    title: 'Assessments',
    description: 'Create and manage assessments, track participation, and monitor performance.',
  },
  '/assessments/new': {
    crumb: 'BrainPulses / Assessment / Create Assessment',
    title: 'Create Assessment',
  },
  '/assessments/registrations': {
    crumb: 'BrainPulses / Assessment / Registrations',
    title: 'Registrations & Participant Data',
    description:
      'View all participant registrations, their assigned question banks, and assessment status.',
  },
  '/assessments/registrations/new': {
    crumb: 'BrainPulses / Assessment / Registrations / Assign',
    title: 'Assign Participants',
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
  '/quizzes/new': { crumb: 'BrainPulses / Quiz / Create Quiz', title: 'Create Quiz' },
  '/quizzes/registrations': {
    crumb: 'BrainPulses / Quiz / Registrations',
    title: 'Registrations & Participant Data',
    description:
      'View all participant registrations, their assigned question banks, and quiz attempt status.',
  },
  '/quizzes/registrations/new': {
    crumb: 'BrainPulses / Quiz / Registrations / Assign',
    title: 'Assign Participants',
  },
  '/quizzes/reports': {
    crumb: 'BrainPulses / Quiz / Reports',
    title: 'Quiz Reports & Results',
    description: "One row per student per quiz. Scores show each student's best attempt.",
  },
  '/settings': { crumb: 'BrainPulses / Settings / General Settings', title: 'General Settings' },
  '/settings/participant-portal': {
    crumb: 'BrainPulses / Settings / Participant Portal',
    title: 'Participant Portal Pages',
    description: 'Choose which pages appear in the participant portal navigation.',
  },
  '/settings/design-system': {
    crumb: 'BrainPulses / Settings / Design System',
    title: 'Design System',
    description: 'The BrainPulses brand, shared design tokens, and interactive UI patterns.',
  },
};

export function resolvePageMeta(pathname: string): PageMeta {
  if (pageMeta[pathname]) return pageMeta[pathname]!;
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

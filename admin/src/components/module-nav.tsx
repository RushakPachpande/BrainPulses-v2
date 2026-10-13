import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

type ModuleLink = { to: string; label: string };

const modules: { prefix: string; label: string; links: ModuleLink[] }[] = [
  {
    prefix: '/assessments',
    label: 'Assessment',
    links: [
      { to: '/assessments', label: 'All assessments' },
      { to: '/assessments/banks', label: 'Question Banks' },
      { to: '/assessments/registrations', label: 'Registrations & Student Data' },
      { to: '/assessments/reports', label: 'Reports & Results' },
    ],
  },
  {
    prefix: '/quizzes',
    label: 'Quiz',
    links: [
      { to: '/quizzes', label: 'All quizzes' },
      { to: '/quizzes/banks', label: 'Question Banks' },
      { to: '/quizzes/registrations', label: 'Registrations & Student Data' },
      { to: '/quizzes/reports', label: 'Reports & Results' },
    ],
  },
  {
    prefix: '/settings',
    label: 'Settings',
    links: [
      { to: '/settings', label: 'General Settings' },
      { to: '/settings/access', label: 'User & Access Settings' },
      { to: '/settings/notifications', label: 'Notification Settings' },
      { to: '/settings/system', label: 'System Settings' },
    ],
  },
];

export function ModuleNav({ pathname }: { pathname: string }) {
  const module = modules.find(
    (item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`),
  );
  if (!module) return null;

  return (
    <nav aria-label={module.label} className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {module.links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end
          className={({ isActive }) =>
            cn(
              'inline-flex min-h-(--control-h) items-center rounded-md px-3 py-2 text-sm font-medium text-foreground/60 hover:text-foreground',
              isActive && 'bg-background text-foreground shadow-sm',
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

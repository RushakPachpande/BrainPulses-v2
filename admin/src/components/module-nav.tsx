import { NavLink } from 'react-router';
import {
  BarChart3Icon,
  ClipboardListIcon,
  FolderOpenIcon,
  PanelsTopLeftIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ModuleLink = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

const modules: { prefix: string; label: string; links: ModuleLink[] }[] = [
  {
    prefix: '/assessments',
    label: 'Assessment',
    links: [
      { to: '/assessments', label: 'Overview', icon: ClipboardListIcon, end: true },
      { to: '/assessments/banks', label: 'Question Banks', icon: FolderOpenIcon, end: true },
      { to: '/assessments/registrations', label: 'Registrations', icon: UsersIcon, end: true },
      { to: '/assessments/reports', label: 'Reports & Results', icon: BarChart3Icon, end: true },
    ],
  },
  {
    prefix: '/quizzes',
    label: 'Quiz',
    links: [
      { to: '/quizzes', label: 'Overview', icon: ClipboardListIcon, end: true },
      { to: '/quizzes/registrations', label: 'Registrations', icon: UsersIcon, end: true },
      { to: '/quizzes/reports', label: 'Reports & Results', icon: BarChart3Icon, end: true },
    ],
  },
  {
    prefix: '/settings',
    label: 'Settings',
    links: [
      { to: '/settings', label: 'General', icon: SettingsIcon, end: true },
      {
        to: '/settings/student-portal',
        label: 'Student portal',
        icon: PanelsTopLeftIcon,
        end: true,
      },
    ],
  },
];

export function ModuleNav({ pathname }: { pathname: string }) {
  const module = modules.find(
    (item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`),
  );
  if (!module) return null;

  return (
    <nav aria-label={`${module.label} navigation`} className="w-fit max-w-full min-w-0">
      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-sm scrollbar-none [&::-webkit-scrollbar]:hidden">
        {module.links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              aria-label={link.label}
              className={({ isActive }) =>
                cn(
                  'inline-flex min-h-(--control-h) shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent px-3.5 text-sm font-medium transition-colors duration-150',
                  'text-muted-foreground hover:bg-muted hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                  isActive &&
                    'border-border bg-accent text-accent-foreground shadow-sm hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

import { NavLink } from 'react-router';
import {
  BarChart3Icon,
  BellIcon,
  ClipboardListIcon,
  FolderOpenIcon,
  SettingsIcon,
  ShieldIcon,
  ServerIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ModuleLink = { to: string; label: string; icon: LucideIcon };

const modules: { prefix: string; label: string; links: ModuleLink[] }[] = [
  {
    prefix: '/assessments',
    label: 'Assessment',
    links: [
      { to: '/assessments', label: 'All Assessments', icon: ClipboardListIcon },
      { to: '/assessments/banks', label: 'Question Banks', icon: FolderOpenIcon },
      { to: '/assessments/registrations', label: 'Registrations & Student Data', icon: UsersIcon },
      { to: '/assessments/reports', label: 'Reports & Results', icon: BarChart3Icon },
    ],
  },
  {
    prefix: '/quizzes',
    label: 'Quiz',
    links: [
      { to: '/quizzes', label: 'All Quizzes', icon: ClipboardListIcon },
      { to: '/quizzes/banks', label: 'Question Banks', icon: FolderOpenIcon },
      { to: '/quizzes/registrations', label: 'Registrations & Student Data', icon: UsersIcon },
      { to: '/quizzes/reports', label: 'Reports & Results', icon: BarChart3Icon },
    ],
  },
  {
    prefix: '/settings',
    label: 'Settings',
    links: [
      { to: '/settings', label: 'General Settings', icon: SettingsIcon },
      { to: '/settings/access', label: 'User & Access Settings', icon: ShieldIcon },
      { to: '/settings/notifications', label: 'Notification Settings', icon: BellIcon },
      { to: '/settings/system', label: 'System Settings', icon: ServerIcon },
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
      {module.links.map((link) => {
        const Icon = link.icon;
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end
            className={({ isActive }) =>
              cn(
                'inline-flex min-h-(--control-h) items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                isActive && 'bg-primary text-primary-foreground hover:text-primary-foreground',
              )
            }
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {link.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

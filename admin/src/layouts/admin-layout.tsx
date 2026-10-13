import { useEffect, useState, type CSSProperties } from 'react';
import { NavLink, Outlet, useLocation, useMatch } from 'react-router';
import {
  ActivityIcon,
  BellIcon,
  BookOpenIcon,
  ChartColumnIcon,
  ChartLineIcon,
  CircleHelpIcon,
  LayoutDashboardIcon,
  ListIcon,
  PlusIcon,
  ServerIcon,
  ShieldIcon,
  SlidersHorizontalIcon,
  UserCheckIcon,
  UserCogIcon,
  UserPlusIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { pageMeta } from '@/routes/meta';

const SIDEBAR_KEY = 'brainpulses-sidebar';

type NavLinkItem = { to: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavLinkItem[] };

const primary: NavLinkItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
  { to: '/students', label: 'Students', icon: UsersIcon },
  { to: '/users', label: 'Users', icon: UserCogIcon },
];

const groups: NavGroup[] = [
  {
    label: 'Assessment',
    items: [
      { to: '/assessments', label: 'All assessments', icon: ListIcon },
      { to: '/assessments/new', label: 'Create Assessment', icon: PlusIcon },
      { to: '/assessments/banks', label: 'Question Banks', icon: BookOpenIcon },
      {
        to: '/assessments/registrations',
        label: 'Registrations & Student Data',
        icon: UserPlusIcon,
      },
      { to: '/assessments/reports', label: 'Reports & Results', icon: ChartColumnIcon },
    ],
  },
  {
    label: 'Quiz',
    items: [
      { to: '/quizzes', label: 'All quizzes', icon: CircleHelpIcon },
      { to: '/quizzes/new', label: 'Create Quiz', icon: PlusIcon },
      { to: '/quizzes/banks', label: 'Question Banks', icon: ShieldIcon },
      { to: '/quizzes/registrations', label: 'Registrations & Student Data', icon: UserCheckIcon },
      { to: '/quizzes/reports', label: 'Reports & Results', icon: ChartLineIcon },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/settings', label: 'General Settings', icon: SlidersHorizontalIcon },
      { to: '/settings/access', label: 'User & Access Settings', icon: ShieldIcon },
      { to: '/settings/notifications', label: 'Notification Settings', icon: BellIcon },
      { to: '/settings/system', label: 'System Settings', icon: ServerIcon },
    ],
  },
];

function readSidebarOpen() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== 'collapsed';
  } catch {
    return true;
  }
}

function NavItem({ to, label, icon: Icon }: NavLinkItem) {
  const match = useMatch({ path: to, end: true });
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={Boolean(match)} tooltip={label}>
        <NavLink to={to} end>
          <Icon />
          <span>{label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AdminLayout() {
  const { pathname } = useLocation();
  const meta = pageMeta[pathname] ?? pageMeta['/dashboard'];
  const crumbs = meta.crumb.split(' / ');
  const [open, setOpen] = useState(readSidebarOpen);

  useEffect(() => {
    document.title = `${meta.title} · Brainpules Admin`;
  }, [meta.title]);

  useEffect(() => {
    const main = document.getElementById('main');
    if (main instanceof HTMLElement && document.activeElement !== main) {
      main.focus({ preventScroll: true });
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? 'expanded' : 'collapsed');
    } catch {
      /* ignore */
    }
  }

  return (
    <SidebarProvider
      open={open}
      onOpenChange={onOpenChange}
      style={{ '--sidebar-width': '268px' } as CSSProperties}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-1">
            <SidebarMenu className="min-w-0 flex-1">
              <SidebarMenuItem>
                <SidebarMenuButton asChild size="lg" tooltip="Brainpules">
                  <NavLink to="/dashboard">
                    <ActivityIcon />
                    <span className="text-base font-semibold">Brainpules</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {primary.map((item) => (
                  <NavItem key={item.to} {...item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <NavItem key={item.to} {...item} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="flex min-h-14 min-w-0 items-center gap-2 border-b bg-card px-4 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SidebarTrigger aria-label="Toggle sidebar" title="Toggle sidebar" />
            <div className="min-w-0">
              <Breadcrumb>
                <BreadcrumbList>
                  {crumbs.map((crumb, index) => (
                    <span key={`${crumb}-${index}`} className="inline-flex items-center gap-1.5">
                      {index > 0 ? <BreadcrumbSeparator /> : null}
                      <BreadcrumbItem>
                        {index === crumbs.length - 1 ? (
                          <BreadcrumbPage>{crumb}</BreadcrumbPage>
                        ) : (
                          <span>{crumb}</span>
                        )}
                      </BreadcrumbItem>
                    </span>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
              <h1 className="truncate text-xl font-semibold">{meta.title}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Button type="button" variant="outline" size="icon" aria-label="Notifications">
              <BellIcon />
            </Button>
            <Avatar>
              <AvatarFallback>MJ</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm lg:inline">Meera Joshi · Super Admin</span>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-x-hidden px-4 py-4 md:px-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { Fragment, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useMatch } from 'react-router';
import {
  ActivityIcon,
  BellIcon,
  ChevronsUpDownIcon,
  CircleHelpIcon,
  LayoutDashboardIcon,
  ListIcon,
  SlidersHorizontalIcon,
  UserCogIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { ModuleNav } from '@/components/module-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { pageMeta } from '@/routes/meta';

type NavLinkItem = { to: string; label: string; icon: LucideIcon; end: boolean };

const nav: NavLinkItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon, end: true },
  { to: '/students', label: 'Students', icon: UsersIcon, end: true },
  { to: '/users', label: 'Users', icon: UserCogIcon, end: true },
  { to: '/assessments', label: 'Assessments', icon: ListIcon, end: false },
  { to: '/quizzes', label: 'Quizzes', icon: CircleHelpIcon, end: false },
  { to: '/settings', label: 'Settings', icon: SlidersHorizontalIcon, end: false },
];

const crumbHrefs: Record<string, string> = {
  Brainpules: '/dashboard',
  Assessment: '/assessments',
  Quiz: '/quizzes',
  Settings: '/settings',
};

function NavItem({ to, label, icon: Icon, end }: NavLinkItem) {
  const match = useMatch({ path: to, end });
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={Boolean(match)} tooltip={label}>
        <NavLink to={to} end={end}>
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

  return (
    <SidebarProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Sidebar variant="inset" collapsible="offcanvas">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg" tooltip="Brainpules">
                <NavLink to="/dashboard">
                  <ActivityIcon />
                  <span className="text-base font-semibold">Brainpules</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => (
                  <NavItem key={item.to} {...item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="h-auto min-h-12 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar>
                      <AvatarFallback>MJ</AvatarFallback>
                    </Avatar>
                    <span className="grid min-w-0 flex-1 text-left leading-tight">
                      <span className="truncate font-medium">Meera Joshi</span>
                      <span className="truncate text-xs text-muted-foreground">Super Admin</span>
                    </span>
                    <ChevronsUpDownIcon />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start">
                  <ThemeToggle />
                  <DropdownMenuItem className="min-h-(--control-h)">
                    <BellIcon />
                    Notifications
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset id="main" tabIndex={-1} className="min-w-0 overflow-x-hidden">
        <header className="flex min-h-16 min-w-0 flex-wrap items-center gap-2 border-b px-4 py-2">
          <SidebarTrigger aria-label="Toggle sidebar" title="Toggle sidebar" />
          <Separator
            orientation="vertical"
            className="h-4 data-vertical:h-4 data-vertical:self-center"
          />
          <Breadcrumb className="min-w-0">
            <BreadcrumbList>
              {crumbs.map((crumb, index) => {
                const href = crumbHrefs[crumb];
                const current = index === crumbs.length - 1;
                return (
                  <Fragment key={`${crumb}-${index}`}>
                    {index > 0 ? <BreadcrumbSeparator /> : null}
                    <BreadcrumbItem>
                      {current || !href ? (
                        <BreadcrumbPage>{crumb}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <NavLink to={href} end>
                            {crumb}
                          </NavLink>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-4 md:px-6">
          <h1 className="truncate text-xl font-semibold">{meta.title}</h1>
          <ModuleNav pathname={pathname} />
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

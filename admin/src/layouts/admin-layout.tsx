import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import { NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router';
import {
  ChevronDownIcon,
  CircleHelpIcon,
  LayoutDashboardIcon,
  ListIcon,
  LogOutIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  UserCogIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { canManageUsersOrSettings } from '@/lib/access';
import { Button } from '@/components/ui/button';
import { NotificationsMenu } from '@/components/notifications-menu';
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
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { PageHeaderProvider } from '@/contexts/page-header';
import { usePageHeader } from '@/contexts/use-page-header';
import { resolvePageMeta } from '@/routes/meta';

type NavLinkItem = { to: string; label: string; icon: LucideIcon; end: boolean };
type NavChildItem = { to: string; label: string; end: boolean };
type NavGroupItem = NavLinkItem & { children?: NavChildItem[] };

const nav: NavGroupItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon, end: true },
  { to: '/students', label: 'Students', icon: UsersIcon, end: true },
  { to: '/users', label: 'Users', icon: UserCogIcon, end: true },
  {
    to: '/assessments',
    label: 'Assessments',
    icon: ListIcon,
    end: false,
    children: [
      { to: '/assessments', label: 'All Assessments', end: true },
      { to: '/assessments/banks', label: 'Question Banks', end: true },
      { to: '/assessments/registrations', label: 'Registrations', end: true },
      { to: '/assessments/reports', label: 'Reports & Results', end: true },
    ],
  },
  {
    to: '/quizzes',
    label: 'Quizzes',
    icon: CircleHelpIcon,
    end: false,
    children: [
      { to: '/quizzes', label: 'All Quizzes', end: true },
      { to: '/quizzes/banks', label: 'Question Banks', end: true },
      { to: '/quizzes/registrations', label: 'Registrations', end: true },
      { to: '/quizzes/reports', label: 'Reports & Results', end: true },
    ],
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: SlidersHorizontalIcon,
    end: false,
    children: [
      { to: '/settings', label: 'General', end: true },
      { to: '/settings/access', label: 'User & Access', end: true },
      { to: '/settings/notifications', label: 'Notifications', end: true },
      { to: '/settings/system', label: 'System', end: true },
      { to: '/settings/design-system', label: 'Design System', end: true },
    ],
  },
];

const crumbHrefs: Record<string, string> = {
  BrainPulses: '/dashboard',
  Assessment: '/assessments',
  Quiz: '/quizzes',
  Settings: '/settings',
};

function NavItem({ item, pathname }: { item: NavGroupItem; pathname: string }) {
  const { to, label, icon: Icon, end, children } = item;
  const match = useMatch({ path: to, end });
  const groupIsActive = Boolean(match) || Boolean(children?.some((child) => pathname === child.to));
  const [expanded, setExpanded] = useState(groupIsActive);

  useEffect(() => {
    if (groupIsActive) setExpanded(true);
  }, [groupIsActive]);

  if (!children) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={Boolean(match)}
          tooltip={label}
          className="h-auto min-h-(--control-h) gap-3 px-3 group-data-[collapsible=icon]:min-h-8 group-data-[collapsible=icon]:px-2"
        >
          <NavLink to={to} end={end}>
            <Icon />
            <span>{label}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        isActive={groupIsActive}
        tooltip={label}
        aria-expanded={expanded}
        aria-controls={`${to.replace(/\W+/g, '-')}-submenu`}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label} submenu`}
        onClick={() => setExpanded((value) => !value)}
        className="h-auto min-h-(--control-h) gap-3 px-3 group-data-[collapsible=icon]:min-h-8 group-data-[collapsible=icon]:px-2"
      >
        <Icon />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDownIcon
          className={`ml-auto size-4 shrink-0 transition-transform duration-150 group-data-[collapsible=icon]:hidden ${expanded ? 'rotate-180' : ''}`}
        />
      </SidebarMenuButton>
      {expanded ? (
        <SidebarMenuSub
          id={`${to.replace(/\W+/g, '-')}-submenu`}
          className="mt-1 gap-1 border-sidebar-border/80 pl-3"
        >
          {children.map((child) => {
            const active = pathname === child.to;
            return (
              <SidebarMenuSubItem key={child.to}>
                <SidebarMenuSubButton
                  asChild
                  isActive={active}
                  size="md"
                  className="min-h-9 h-auto px-2.5 py-2 text-sm"
                >
                  <NavLink to={child.to} end={child.end} aria-current={active ? 'page' : undefined}>
                    <span>{child.label}</span>
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  );
}

function PageHeader({
  title,
  description,
  crumbs,
}: {
  title: string;
  description?: string;
  crumbs: string[];
}) {
  const { actions } = usePageHeader();

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Breadcrumb>
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
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

export function AdminLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const meta = resolvePageMeta(pathname);
  const crumbs = meta.crumb.split(' / ');
  const userName = auth.status === 'authenticated' ? auth.user.name : 'Admin';
  const userRole =
    auth.status === 'authenticated'
      ? auth.membership.role === 'super_admin'
        ? 'Super Admin'
        : 'Admin'
      : 'Administrator';
  const userInitials = userName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const showAccessSettings = canManageUsersOrSettings(membership);
  const navItems = nav.map((item) => {
    if (item.to !== '/settings' || !item.children) return item;
    return {
      ...item,
      children: item.children.filter(
        (child) => showAccessSettings || child.to !== '/settings/access',
      ),
    };
  });

  useEffect(() => {
    document.title = `${meta.title} · BrainPulses Admin`;
  }, [meta.title]);

  useEffect(() => {
    const main = document.getElementById('main');
    if (main instanceof HTMLElement && document.activeElement !== main) {
      main.focus({ preventScroll: true });
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '16rem',
          '--sidebar-width-icon': '76px',
        } as CSSProperties
      }
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Sidebar collapsible="icon">
        <SidebarHeader className="min-h-18 justify-center border-b border-sidebar-border group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
          <SidebarMenu className="group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:items-center">
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg" tooltip="BrainPulses">
                <NavLink to="/dashboard" className="text-foreground">
                  <img src="/brand.svg" alt="" className="size-8 shrink-0" />
                  <span className="text-base font-semibold group-data-[collapsible=icon]:hidden">
                    BrainPulses
                  </span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-2 group-data-[collapsible=icon]:items-center">
                {navItems.map((item) => (
                  <NavItem key={item.to} item={item} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:items-center">
          <div className="flex w-full items-center gap-2 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:justify-center">
            <Avatar>
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-sm font-medium text-foreground">{userName}</div>
              <div className="truncate text-xs text-muted-foreground">{userRole}</div>
            </div>
            <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
              <ThemeToggle />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                title="Sign out"
                onClick={() => {
                  void auth.signOut().then(() => navigate('/login', { replace: true }));
                }}
              >
                <LogOutIcon />
              </Button>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <PageHeaderProvider>
        <SidebarInset id="main" tabIndex={-1} className="min-w-0 overflow-x-hidden">
          <header className="sticky top-0 z-20 flex min-h-18 min-w-0 items-center gap-2 border-b bg-card px-3.5 md:gap-4 md:px-7">
            <SidebarTrigger aria-label="Toggle sidebar" title="Toggle sidebar" />
            <InputGroup className="min-w-0 max-w-117.5 flex-1 bg-muted">
              <InputGroupAddon align="inline-start">
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                placeholder="Search"
                aria-label="Search"
                autoComplete="off"
              />
            </InputGroup>
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              <ThemeToggle />
              <NotificationsMenu />
            </div>
          </header>
          <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-1 flex-col gap-4 px-3.5 py-4 md:px-7 md:py-7">
            <PageHeader title={meta.title} description={meta.description} crumbs={crumbs} />
            <Outlet />
          </div>
        </SidebarInset>
      </PageHeaderProvider>
    </SidebarProvider>
  );
}

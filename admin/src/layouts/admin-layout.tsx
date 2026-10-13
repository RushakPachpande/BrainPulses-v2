import { Fragment, useEffect, type CSSProperties } from 'react';
import { NavLink, Outlet, useLocation, useMatch } from 'react-router';
import {
  BellIcon,
  CircleHelpIcon,
  LayoutDashboardIcon,
  ListIcon,
  SearchIcon,
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
import { Button } from '@/components/ui/button';
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
              <SidebarMenuButton asChild size="lg" tooltip="Brainpules">
                <NavLink to="/dashboard" className="text-foreground">
                  <img src="/brand.svg" alt="" className="size-8 shrink-0" />
                  <span className="text-base font-semibold group-data-[collapsible=icon]:hidden">
                    Brainpules
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
                {nav.map((item) => (
                  <NavItem key={item.to} {...item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:items-center">
          <div className="flex w-full items-center gap-2 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:justify-center">
            <Avatar>
              <AvatarFallback>MJ</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-sm font-medium text-foreground">Meera Joshi</div>
              <div className="truncate text-xs text-muted-foreground">Super Admin</div>
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <ThemeToggle />
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset id="main" tabIndex={-1} className="min-w-0 overflow-x-hidden">
        <header className="sticky top-0 z-20 flex min-h-18 min-w-0 items-center gap-2 border-b bg-card px-3.5 md:gap-4 md:px-7">
          <SidebarTrigger aria-label="Toggle sidebar" title="Toggle sidebar" />
          <InputGroup className="max-w-117.5 min-w-0 flex-1 bg-muted">
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
            <Button type="button" variant="ghost" size="icon" aria-label="Notifications">
              <BellIcon />
            </Button>
            <div className="flex items-center gap-2 border-l border-border pl-2 sm:pl-3">
              <Avatar>
                <AvatarFallback>MJ</AvatarFallback>
              </Avatar>
              <div className="hidden min-w-0 sm:block">
                <div className="truncate text-sm font-medium">Meera Joshi</div>
                <div className="truncate text-xs text-muted-foreground">Super Admin</div>
              </div>
            </div>
          </div>
        </header>
        <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-1 flex-col gap-4 px-3.5 py-4 md:px-7 md:py-7">
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
            <h1 className="truncate text-xl font-semibold">{meta.title}</h1>
          </div>
          <ModuleNav pathname={pathname} />
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

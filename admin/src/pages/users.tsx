import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  RotateCcwIcon,
  UploadIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { RecordSortSelect } from '@/components/record-sort-select';
import { ResponsiveRecords, type RecordColumn } from '@/components/responsive-records';
import { RowActions } from '@/components/row-actions';
import { StatusBadge } from '@/components/status-badge';
import { AccountStatusPill } from '@/components/status-pill';
import { Toolbar, type ToolbarFilter } from '@/components/toolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/auth-context';
import { PageHeaderActions } from '@/contexts/page-header';
import { useContainerNarrow } from '@/hooks/use-container-narrow';
import { useRecordSelection } from '@/hooks/use-list-selection';
import { useOrgId } from '@/hooks/use-org-id';
import { canManageUsersOrSettings } from '@/lib/access';
import { adminQueryKeys } from '@/lib/query-keys';
import { UserEditorDialog } from '@/pages/user-editor-dialog';
import { UserViewDialog } from '@/pages/user-view-dialog';
import { getUsers, type AdminUser as User } from '@/services';

const EMPTY_USERS: User[] = [];

type SortKey =
  'name' | 'email' | 'role' | 'assessmentAccess' | 'quizAccess' | 'status' | 'lastLogin';

const userColumns: RecordColumn<User>[] = [
  {
    key: 'name',
    label: 'Name',
    placement: 'title',
    render: (user) => <span className="font-medium">{user.name}</span>,
  },
  { key: 'email', label: 'Email', placement: 'identity', render: (user) => user.email },
  {
    key: 'role',
    label: 'Role',
    placement: 'primary',
    render: (user) => <StatusBadge value={user.role} />,
  },
  {
    key: 'assessmentAccess',
    label: 'Assessment Access',
    placement: 'details',
    render: (user) => user.assessmentAccess,
  },
  {
    key: 'quizAccess',
    label: 'Quiz Access',
    placement: 'details',
    render: (user) => user.quizAccess,
  },
  {
    key: 'status',
    label: 'Status',
    placement: 'status',
    render: (user) => <AccountStatusPill value={user.status} />,
  },
  {
    key: 'lastLogin',
    label: 'Last Login',
    placement: 'details',
    render: (user) => user.lastLogin,
  },
];

function compareUsers(a: User, b: User, key: SortKey) {
  return String(a[key]).localeCompare(String(b[key]), undefined, { numeric: true });
}

export function UsersPage() {
  const { narrow, ref } = useContainerNarrow();
  const auth = useAuth();
  const orgId = useOrgId();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canManage = canManageUsersOrSettings(membership);
  const [searchParams, setSearchParams] = useSearchParams();
  const [editor, setEditor] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const { data, isPending: loading } = useQuery({
    queryKey: adminQueryKeys.users(orgId),
    queryFn: () => getUsers(),
    enabled: Boolean(orgId),
  });
  const users = data ?? EMPTY_USERS;
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('All');
  const [status, setStatus] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  useEffect(() => {
    const view = searchParams.get('view');
    const edit = searchParams.get('edit');
    const create = searchParams.get('create') === '1';
    if (!view && !edit && !create) return;
    if (view && loading) return;
    if (view) {
      if (users.some((user) => user.id === view)) setViewId(view);
      else toast.error('Could not load user.');
    }
    if (canManage && create) setEditor('create');
    if (canManage && edit) setEditor(edit);
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    next.delete('edit');
    next.delete('create');
    setSearchParams(next, { replace: true });
  }, [canManage, loading, searchParams, setSearchParams, users]);

  const filters: ToolbarFilter[] = [
    {
      name: 'Role',
      options: ['All', 'Super Admin', 'Admin'],
      value: role,
      onValueChange: (value) => {
        setRole(value);
        setPage(1);
      },
    },
    {
      name: 'Status',
      options: ['All', 'Active', 'Inactive'],
      value: status,
      onValueChange: (value) => {
        setStatus(value);
        setPage(1);
      },
    },
  ];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let rows = users.filter((user) => {
      if (role !== 'All' && user.role !== role) return false;
      if (status !== 'All' && user.status !== status) return false;
      if (!query) return true;
      return user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
    });

    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const result = compareUsers(a, b, sortKey);
        return sortDir === 'asc' ? result : -result;
      });
    }

    return rows;
  }, [users, search, role, status, sortKey, sortDir]);

  const size = Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * size;
  const pageRows = filtered.slice(start, start + size);
  const end = filtered.length === 0 ? 0 : Math.min(start + size, filtered.length);

  const pageIds = pageRows.map((row) => row.email);
  const records = useRecordSelection(
    orgId,
    'users',
    'users',
    pageIds,
    filtered.map((row) => row.email),
  );

  function clearFilters() {
    setSearch('');
    setRole('All');
    setStatus('All');
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc') {
      setSortDir('desc');
      return;
    }
    setSortKey(null);
    setSortDir('asc');
  }

  const viewing = viewId ? users.find((user) => user.id === viewId) : undefined;
  const viewDialog = viewing ? (
    <UserViewDialog
      user={viewing}
      canEdit={canManage}
      onOpenChange={(open) => {
        if (!open) setViewId(null);
      }}
      onEdit={
        canManage && viewing.id
          ? () => {
              const id = viewing.id;
              if (!id) return;
              setViewId(null);
              setEditor(id);
            }
          : undefined
      }
    />
  ) : null;

  const editorDialog =
    editor !== null ? (
      <UserEditorDialog
        mode={editor === 'create' ? 'create' : 'edit'}
        userId={editor === 'create' ? undefined : editor}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      />
    ) : null;

  if (loading) {
    return (
      <>
        <div className="flex flex-col gap-4">
          {canManage ? (
            <PageHeaderActions>
              <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
                <UploadIcon data-icon="inline-start" />
                Upload Users
              </Button>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => setEditor('create')}
              >
                <PlusIcon data-icon="inline-start" />
                Add User
              </Button>
            </PageHeaderActions>
          ) : null}
          <ListPageSkeleton columns={6} kpiCount={0} />
        </div>
        {viewDialog}
        {editorDialog}
      </>
    );
  }

  return (
    <>
      <div ref={ref} className="flex flex-col gap-4">
        {canManage ? (
          <PageHeaderActions>
            <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
              <UploadIcon data-icon="inline-start" />
              Upload Users
            </Button>
            <Button type="button" className="w-full sm:w-auto" onClick={() => setEditor('create')}>
              <PlusIcon data-icon="inline-start" />
              Add User
            </Button>
          </PageHeaderActions>
        ) : null}

        <Toolbar
          filters={filters}
          searchPlaceholder="Search by name or email..."
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          actions={
            <>
              {narrow ? (
                <RecordSortSelect
                  columns={userColumns}
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={(key) => toggleSort(key as SortKey)}
                />
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                className="w-full sm:w-auto"
              >
                <RotateCcwIcon data-icon="inline-start" />
                Clear Filters
              </Button>
            </>
          }
        />

        <Card>
          <CardContent className="flex flex-col gap-4">
            <ResponsiveRecords
              caption="Admin users"
              rows={pageRows}
              getRowId={(user) => user.email}
              columns={userColumns}
              narrow={narrow}
              empty="No users match the current filters."
              sort={{
                key: sortKey,
                direction: sortDir,
                onSort: (key) => toggleSort(key as SortKey),
              }}
              selection={{
                ...records,
                rowLabel: (user) => `Select ${user.name}`,
              }}
              renderActions={(user) => {
                const id = user.id;
                return (
                  <RowActions
                    view={
                      id
                        ? {
                            onClick: () => setViewId(id),
                          }
                        : undefined
                    }
                    edit={
                      canManage && id
                        ? {
                            onClick: () => setEditor(id),
                          }
                        : undefined
                    }
                  />
                );
              }}
              onRowOpen={(user) => {
                if (user.id) setViewId(user.id);
              }}
            />

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filtered.length === 0 ? 0 : start + 1} to {end} of {filtered.length} users
              </p>
              <div className="list-pager flex flex-nowrap items-center justify-between gap-2 sm:justify-end">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
                    Rows per page
                  </span>
                  <Select
                    value={pageSize}
                    onValueChange={(value) => {
                      setPageSize(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger aria-label="Rows per page" className="w-16 shrink-0 sm:w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {['10', '20', '50'].map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Previous page"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeftIcon />
                  </Button>
                  <Button type="button" variant="default" size="icon" aria-current="page">
                    {currentPage}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Next page"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {viewDialog}
      {editorDialog}
    </>
  );
}

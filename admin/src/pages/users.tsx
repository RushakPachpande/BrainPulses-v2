import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  RotateCcwIcon,
  UploadIcon,
} from 'lucide-react';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { RowActions } from '@/components/row-actions';
import { SortHeader } from '@/components/sort-header';
import { StatusBadge } from '@/components/status-badge';
import { AccountStatusPill } from '@/components/status-pill';
import { Toolbar, type ToolbarFilter } from '@/components/toolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/auth-context';
import { PageHeaderActions } from '@/contexts/page-header';
import { useOrgId } from '@/hooks/use-org-id';
import { canManageUsersOrSettings } from '@/lib/access';
import { adminQueryKeys } from '@/lib/query-keys';
import { getUsers, type AdminUser as User } from '@/services';

const EMPTY_USERS: User[] = [];

type SortKey =
  'name' | 'email' | 'role' | 'assessmentAccess' | 'quizAccess' | 'status' | 'lastLogin';

const sortColumns: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'assessmentAccess', label: 'Assessment Access' },
  { key: 'quizAccess', label: 'Quiz Access' },
  { key: 'status', label: 'Status' },
  { key: 'lastLogin', label: 'Last Login' },
];

function compareUsers(a: User, b: User, key: SortKey) {
  return String(a[key]).localeCompare(String(b[key]), undefined, { numeric: true });
}

export function UsersPage() {
  const auth = useAuth();
  const orgId = useOrgId();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canManage = canManageUsersOrSettings(membership);
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
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

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
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

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

  function toggleAllPage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {canManage ? (
          <PageHeaderActions>
            <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
              <UploadIcon data-icon="inline-start" />
              Upload Users
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link to="/users/new">
                <PlusIcon data-icon="inline-start" />
                Add User
              </Link>
            </Button>
          </PageHeaderActions>
        ) : null}
        <ListPageSkeleton columns={6} kpiCount={0} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <PageHeaderActions>
          <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
            <UploadIcon data-icon="inline-start" />
            Upload Users
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/users/new">
              <PlusIcon data-icon="inline-start" />
              Add User
            </Link>
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
          <Button
            type="button"
            variant="outline"
            onClick={clearFilters}
            className="w-full sm:w-auto"
          >
            <RotateCcwIcon data-icon="inline-start" />
            Clear Filters
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableCaption className="sr-only">Admin users</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                    onCheckedChange={(checked) => toggleAllPage(checked === true)}
                    aria-label="Select all users on this page"
                  />
                </TableHead>
                {sortColumns.map((column) => (
                  <TableHead
                    key={column.key}
                    scope="col"
                    aria-sort={
                      sortKey === column.key
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <SortHeader
                      label={column.label}
                      active={sortKey === column.key}
                      direction={sortDir}
                      onSort={() => toggleSort(column.key)}
                    />
                  </TableHead>
                ))}
                <TableHead scope="col">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    No users match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((user) => (
                  <TableRow
                    key={user.email}
                    data-state={selected.has(user.email) ? 'selected' : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(user.email)}
                        onCheckedChange={(checked) => toggleOne(user.email, checked === true)}
                        aria-label={`Select ${user.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{user.name}</span>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <StatusBadge value={user.role} />
                    </TableCell>
                    <TableCell>{user.assessmentAccess}</TableCell>
                    <TableCell>{user.quizAccess}</TableCell>
                    <TableCell>
                      <AccountStatusPill value={user.status} />
                    </TableCell>
                    <TableCell>{user.lastLogin}</TableCell>
                    <TableCell>
                      <RowActions
                        view={{ to: `/users/${user.id}` }}
                        edit={canManage && user.id ? { to: `/users/${user.id}/edit` } : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : start + 1} to {end} of {filtered.length} users
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page</span>
                <Select
                  value={pageSize}
                  onValueChange={(value) => {
                    setPageSize(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger aria-label="Rows per page" className="w-20">
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
  );
}

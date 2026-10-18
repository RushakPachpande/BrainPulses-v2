import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useAsyncService } from '@/hooks/use-async-service';
import {
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  MoreVerticalIcon,
  PlusIcon,
  RotateCcwIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { SortHeader } from '@/components/sort-header';
import { AssignmentStatusPill, AttemptStatusPill } from '@/components/status-pill';
import { Toolbar, type ToolbarFilter } from '@/components/toolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { canEditKind } from '@/lib/access';
import { cn } from '@/lib/utils';
import { getRegistrations, type ActivityKind } from '@/services';
import { assessmentNames, quizNames, studentCities, studentCourses } from '@/services/fixtures';
import type { RegistrationRow as Registration } from '@/services/types';

const EMPTY_ROWS: Registration[] = [];

type SortKey =
  'id' | 'name' | 'email' | 'phone' | 'registered' | 'activity' | 'bank' | 'assignment' | 'attempt';

function compareRows(a: Registration, b: Registration, key: SortKey) {
  return String(a[key]).localeCompare(String(b[key]), undefined, { numeric: true });
}

export function RegistrationsPage({ kind }: { kind: ActivityKind }) {
  const auth = useAuth();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canEdit = canEditKind(membership, kind);
  const isQuiz = kind === 'quiz';
  const activityLabel = isQuiz ? 'Quiz' : 'Assessment';
  const attemptLabel = isQuiz ? 'Attempt Status' : 'Student Status';
  const activityOptions = isQuiz ? quizNames : assessmentNames;
  const acrossLabel = isQuiz ? 'Across all quizzes' : 'Across all assessments';

  const sortColumns: { key: SortKey; label: string }[] = [
    { key: 'id', label: 'Unique ID' },
    { key: 'name', label: 'Student Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'registered', label: 'Registration Date' },
    { key: 'activity', label: activityLabel },
    { key: 'bank', label: 'Assigned Question Bank' },
    { key: 'assignment', label: 'Assignment Status' },
    { key: 'attempt', label: attemptLabel },
  ];

  const { data, loading } = useAsyncService(() => getRegistrations(kind), [kind]);
  const rows = data ?? EMPTY_ROWS;
  const [search, setSearch] = useState('');
  const [activity, setActivity] = useState('All');
  const [city, setCity] = useState('All');
  const [course, setCourse] = useState('All');
  const [assignment, setAssignment] = useState('All');
  const [attempt, setAttempt] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const metrics = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((row) => row.attempt === 'Completed').length;
    const inProgress = rows.filter((row) => row.attempt === 'In Progress').length;
    const notStarted = rows.filter((row) => row.attempt === 'Not Started').length;
    const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
    return [
      {
        label: 'Total Registrations',
        value: String(total),
        detail: (
          <>
            <span className="text-success">↑ 12%</span>
            <span className="text-muted-foreground"> · {acrossLabel}</span>
          </>
        ),
        icon: UsersIcon,
        tone: 'bg-chart-2/15 text-chart-2',
      },
      {
        label: 'Completed',
        value: String(completed),
        detail: <span className="text-muted-foreground">{pct(completed)}% of total</span>,
        icon: CheckCircle2Icon,
        tone: 'bg-success/15 text-success',
      },
      {
        label: 'In Progress',
        value: String(inProgress),
        detail: <span className="text-muted-foreground">{pct(inProgress)}% of total</span>,
        icon: ClockIcon,
        tone: 'bg-warning/15 text-warning',
      },
      {
        label: 'Not Started',
        value: String(notStarted),
        detail: <span className="text-muted-foreground">{pct(notStarted)}% of total</span>,
        icon: UserIcon,
        tone: 'bg-primary/15 text-primary',
      },
    ] as const;
  }, [rows, acrossLabel]);

  const filters: ToolbarFilter[] = [
    {
      name: activityLabel,
      options: ['All', ...activityOptions],
      value: activity,
      onValueChange: (value) => {
        setActivity(value);
        setPage(1);
      },
    },
    {
      name: 'City',
      options: ['All', ...studentCities],
      value: city,
      onValueChange: (value) => {
        setCity(value);
        setPage(1);
      },
    },
    {
      name: 'Course',
      options: ['All', ...studentCourses],
      value: course,
      onValueChange: (value) => {
        setCourse(value);
        setPage(1);
      },
    },
    {
      name: 'Assignment Status',
      options: ['All', 'Assigned', 'Pending'],
      value: assignment,
      onValueChange: (value) => {
        setAssignment(value);
        setPage(1);
      },
    },
    {
      name: attemptLabel,
      options: ['All', 'Completed', 'In Progress', 'Not Started'],
      value: attempt,
      onValueChange: (value) => {
        setAttempt(value);
        setPage(1);
      },
    },
  ];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let next = rows.filter((row) => {
      if (activity !== 'All' && row.activity !== activity) return false;
      if (city !== 'All' && row.city !== city) return false;
      if (course !== 'All' && row.course !== course) return false;
      if (assignment !== 'All' && row.assignment !== assignment) return false;
      if (attempt !== 'All' && row.attempt !== attempt) return false;
      if (!query) return true;
      return (
        row.id.toLowerCase().includes(query) ||
        row.name.toLowerCase().includes(query) ||
        row.email.toLowerCase().includes(query)
      );
    });

    if (sortKey) {
      next = [...next].sort((a, b) => {
        const result = compareRows(a, b, sortKey);
        return sortDir === 'asc' ? result : -result;
      });
    }

    return next;
  }, [rows, search, activity, city, course, assignment, attempt, sortKey, sortDir]);

  const size = Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * size;
  const pageRows = filtered.slice(start, start + size);
  const end = filtered.length === 0 ? 0 : Math.min(start + size, filtered.length);

  const pageIds = pageRows.map((row) => row.registrationId);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

  function clearFilters() {
    setSearch('');
    setActivity('All');
    setCity('All');
    setCourse('All');
    setAssignment('All');
    setAttempt('All');
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
        <PageHeaderActions>
          <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
            <DownloadIcon data-icon="inline-start" />
            Download Filtered Data
          </Button>
          {canEdit ? (
            <Button asChild className="w-full sm:w-auto">
              <Link to={isQuiz ? '/quizzes/registrations/new' : '/assessments/registrations/new'}>
                <PlusIcon data-icon="inline-start" />
                Add Registration
              </Link>
            </Button>
          ) : null}
        </PageHeaderActions>
        <ListPageSkeleton columns={8} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeaderActions>
        <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
          <DownloadIcon data-icon="inline-start" />
          Download Filtered Data
        </Button>
        {canEdit ? (
          <Button asChild className="w-full sm:w-auto">
            <Link to={isQuiz ? '/quizzes/registrations/new' : '/assessments/registrations/new'}>
              <PlusIcon data-icon="inline-start" />
              Add Registration
            </Link>
          </Button>
        ) : null}
      </PageHeaderActions>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <CardContent className="flex items-center gap-3">
                <span
                  className={cn(
                    'inline-flex size-10 shrink-0 items-center justify-center rounded-lg',
                    metric.tone,
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm text-muted-foreground">{metric.label}</div>
                  <div className="text-2xl font-semibold tabular-nums">{metric.value}</div>
                  <div className="text-xs">{metric.detail}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Toolbar
        filters={filters}
        searchPlaceholder="Search by name, email, or unique ID..."
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
            <TableCaption className="sr-only">{activityLabel} registrations</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                    onCheckedChange={(checked) => toggleAllPage(checked === true)}
                    aria-label="Select all registrations on this page"
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
                  <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                    No registrations match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => (
                  <TableRow
                    key={row.registrationId}
                    data-state={selected.has(row.registrationId) ? 'selected' : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(row.registrationId)}
                        onCheckedChange={(checked) =>
                          toggleOne(row.registrationId, checked === true)
                        }
                        aria-label={`Select ${row.name}`}
                      />
                    </TableCell>
                    <TableCell className="tabular-nums">{row.id}</TableCell>
                    <TableCell>
                      <span className="font-medium">{row.name}</span>
                    </TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell className="tabular-nums">{row.phone}</TableCell>
                    <TableCell>{row.registered}</TableCell>
                    <TableCell>{row.activity}</TableCell>
                    <TableCell>{row.bank}</TableCell>
                    <TableCell>
                      <AssignmentStatusPill value={row.assignment} />
                    </TableCell>
                    <TableCell>
                      <AttemptStatusPill value={row.attempt} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${row.name}`}
                          >
                            <MoreVerticalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link
                              to={
                                isQuiz
                                  ? `/quizzes/registrations/${row.registrationId}`
                                  : `/assessments/registrations/${row.registrationId}`
                              }
                            >
                              View
                            </Link>
                          </DropdownMenuItem>
                          {canEdit ? (
                            <DropdownMenuItem asChild>
                              <Link
                                to={
                                  isQuiz
                                    ? `/quizzes/registrations/${row.registrationId}/edit`
                                    : `/assessments/registrations/${row.registrationId}/edit`
                                }
                              >
                                Edit
                              </Link>
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : start + 1} to {end} of {filtered.length}{' '}
              registrations
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

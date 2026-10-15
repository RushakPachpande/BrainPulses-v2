import { useMemo, useState } from 'react';
import { useAsyncService } from '@/hooks/use-async-service';
import { Link } from 'react-router';
import {
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  ClipboardListIcon,
  LayersIcon,
  MoreVerticalIcon,
  PlusIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { DateRangeFilter } from '@/components/date-range-filter';
import { SortHeader } from '@/components/sort-header';
import { FlowStatusPill } from '@/components/status-pill';
import { Toolbar, type ToolbarFilter } from '@/components/toolbar';
import {
  ALL_DATE_RANGE,
  isDateInRange,
  parseFixtureDate,
  type DateRangeValue,
} from '@/lib/date-range';
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
import { PageHeaderActions } from '@/contexts/page-header';
import { cn } from '@/lib/utils';
import { getActivities, type ActivityKind } from '@/services';
import type { Activity } from '@/services/types';

type SortKey =
  'name' | 'status' | 'registered' | 'assigned' | 'banks' | 'attempts' | 'start' | 'end';

const assessmentMetrics = [
  {
    label: 'Total Assessments',
    value: '24',
    icon: ClipboardListIcon,
    tone: 'bg-chart-2/15 text-chart-2',
  },
  { label: 'Active', value: '14', icon: CheckCircle2Icon, tone: 'bg-success/15 text-success' },
  { label: 'Draft', value: '6', icon: CircleDashedIcon, tone: 'bg-warning/15 text-warning' },
  { label: 'Completed', value: '4', icon: LayersIcon, tone: 'bg-primary/15 text-primary' },
] as const;

const quizMetrics = [
  {
    label: 'Total Quizzes',
    value: '32',
    icon: ClipboardListIcon,
    tone: 'bg-chart-2/15 text-chart-2',
  },
  { label: 'Active', value: '26', icon: CheckCircle2Icon, tone: 'bg-success/15 text-success' },
  { label: 'Draft', value: '4', icon: CircleDashedIcon, tone: 'bg-warning/15 text-warning' },
  { label: 'Completed', value: '2', icon: LayersIcon, tone: 'bg-primary/15 text-primary' },
] as const;

function compareActivities(a: Activity, b: Activity, key: SortKey) {
  const left = a[key];
  const right = b[key];
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true });
}

function attemptPercent(activity: Activity) {
  if (activity.registered <= 0) return 0;
  return Math.min(100, Math.round((activity.attempts / activity.registered) * 100));
}

export function ActivityListPage({ kind }: { kind: ActivityKind }) {
  const isQuiz = kind === 'quiz';
  const noun = isQuiz ? 'quizzes' : 'assessments';
  const nounSingular = isQuiz ? 'quiz' : 'assessment';
  const nameLabel = isQuiz ? 'Quiz Name' : 'Assessment Name';
  const createHref = isQuiz ? '/quizzes/new' : '/assessments/new';
  const metrics = isQuiz ? quizMetrics : assessmentMetrics;

  const sortColumns: { key: SortKey; label: string }[] = isQuiz
    ? [
        { key: 'name', label: nameLabel },
        { key: 'status', label: 'Status' },
        { key: 'banks', label: 'Question Banks' },
        { key: 'registered', label: 'Registered Students' },
        { key: 'assigned', label: 'Assigned Students' },
        { key: 'attempts', label: 'Attempts' },
        { key: 'start', label: 'Start Date' },
        { key: 'end', label: 'End Date' },
      ]
    : [
        { key: 'name', label: nameLabel },
        { key: 'status', label: 'Status' },
        { key: 'registered', label: 'Registered Students' },
        { key: 'assigned', label: 'Assigned Students' },
        { key: 'banks', label: 'Question Banks' },
        { key: 'attempts', label: 'Attempts' },
        { key: 'start', label: 'Start Date' },
        { key: 'end', label: 'End Date' },
      ];

  const { data: activities = [] } = useAsyncService(() => getActivities(kind), [kind]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [dateRange, setDateRange] = useState<DateRangeValue>(ALL_DATE_RANGE);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const filters: ToolbarFilter[] = [
    {
      name: 'Status',
      options: ['All', 'Active', 'Draft', 'Completed'],
      value: status,
      onValueChange: (value) => {
        setStatus(value);
        setPage(1);
      },
    },
  ];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let rows = activities.filter((item) => {
      if (status !== 'All' && item.status !== status) return false;
      if (!isDateInRange(parseFixtureDate(item.start), dateRange)) return false;
      if (!query) return true;
      return item.name.toLowerCase().includes(query) || item.subtitle.toLowerCase().includes(query);
    });

    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const result = compareActivities(a, b, sortKey);
        return sortDir === 'asc' ? result : -result;
      });
    }

    return rows;
  }, [activities, search, status, dateRange, sortKey, sortDir]);

  const size = Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * size;
  const pageRows = filtered.slice(start, start + size);
  const end = filtered.length === 0 ? 0 : Math.min(start + size, filtered.length);

  const pageIds = pageRows.map((row) => row.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

  function clearFilters() {
    setSearch('');
    setStatus('All');
    setDateRange(ALL_DATE_RANGE);
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

  function renderCell(column: SortKey, item: Activity) {
    switch (column) {
      case 'name':
        return (
          <div className="min-w-0">
            <div className="truncate font-medium">{item.name}</div>
            <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
          </div>
        );
      case 'status':
        return <FlowStatusPill status={item.status} />;
      case 'registered':
      case 'assigned':
      case 'banks':
        return <span className="tabular-nums">{item[column]}</span>;
      case 'attempts': {
        const percent = attemptPercent(item);
        return (
          <div className="min-w-28">
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="tabular-nums">{item.attempts}</span>
              <span className="tabular-nums text-muted-foreground">{percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      }
      case 'start':
        return (
          <div className="leading-tight">
            <div>{item.start}</div>
            <div className="text-xs text-muted-foreground">{item.startTime}</div>
          </div>
        );
      case 'end':
        return (
          <div className="leading-tight">
            <div>{item.end}</div>
            <div className="text-xs text-muted-foreground">{item.endTime}</div>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeaderActions>
        <Button type="button" asChild className="w-full sm:w-auto">
          <Link to={createHref}>
            <PlusIcon data-icon="inline-start" />
            Create {isQuiz ? 'Quiz' : 'Assessment'}
          </Link>
        </Button>
      </PageHeaderActions>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <CardContent className="flex items-center gap-3 pt-0">
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
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Toolbar
        filters={filters}
        searchPlaceholder={`Search by ${nounSingular} name...`}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        dateRange={
          <DateRangeFilter
            value={dateRange}
            onApply={(next) => {
              setDateRange(next);
              setPage(1);
            }}
          />
        }
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
            <TableCaption className="sr-only">{isQuiz ? 'Quizzes' : 'Assessments'}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                    onCheckedChange={(checked) => toggleAllPage(checked === true)}
                    aria-label={`Select all ${noun} on this page`}
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
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    No {noun} match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((item) => (
                  <TableRow
                    key={item.id}
                    data-state={selected.has(item.id) ? 'selected' : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={(checked) => toggleOne(item.id, checked === true)}
                        aria-label={`Select ${item.name}`}
                      />
                    </TableCell>
                    {sortColumns.map((column) => (
                      <TableCell key={column.key}>{renderCell(column.key, item)}</TableCell>
                    ))}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${item.name}`}
                          >
                            <MoreVerticalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View</DropdownMenuItem>
                          <DropdownMenuItem>Edit</DropdownMenuItem>
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
              Showing {filtered.length === 0 ? 0 : start + 1} to {end} of {filtered.length} {noun}
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

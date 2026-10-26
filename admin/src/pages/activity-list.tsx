import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  ClipboardListIcon,
  LayersIcon,
  PlusIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { DateRangeFilter } from '@/components/date-range-filter';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { RecordSortSelect } from '@/components/record-sort-select';
import { ResponsiveRecords, type RecordColumn } from '@/components/responsive-records';
import { RowActions } from '@/components/row-actions';
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
import { canEditKind } from '@/lib/access';
import { adminQueryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { getActivities, type ActivityKind } from '@/services';
import type { Activity } from '@/services/types';

const EMPTY_ACTIVITIES: Activity[] = [];

type SortKey =
  'name' | 'status' | 'registered' | 'assigned' | 'banks' | 'attempts' | 'start' | 'end';

const activityPlacement: Record<SortKey, RecordColumn<Activity>['placement']> = {
  name: 'title',
  status: 'status',
  registered: 'primary',
  assigned: 'primary',
  attempts: 'primary',
  banks: 'details',
  start: 'details',
  end: 'details',
};

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
  const { narrow, ref } = useContainerNarrow();
  const auth = useAuth();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canEdit = canEditKind(membership, kind);
  const isQuiz = kind === 'quiz';
  const noun = isQuiz ? 'quizzes' : 'assessments';
  const nounSingular = isQuiz ? 'quiz' : 'assessment';
  const nameLabel = isQuiz ? 'Quiz Name' : 'Assessment Name';
  const listPath = isQuiz ? '/quizzes' : '/assessments';
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

  const orgId = useOrgId();
  const { data, isPending: loading } = useQuery({
    queryKey: adminQueryKeys.activities(orgId, kind),
    queryFn: () => getActivities(kind),
    enabled: Boolean(orgId),
  });
  const activities = data ?? EMPTY_ACTIVITIES;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [dateRange, setDateRange] = useState<DateRangeValue>(ALL_DATE_RANGE);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
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
  const records = useRecordSelection(
    orgId,
    `activities-${kind}`,
    noun,
    pageIds,
    filtered.map((row) => row.id),
  );

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

  function renderCell(column: SortKey, item: Activity) {
    switch (column) {
      case 'name':
        return (
          <div className="min-w-0">
            <div className="truncate font-medium">{item.name}</div>
            <div className="truncate text-xs font-normal text-muted-foreground">
              {item.subtitle}
            </div>
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

  const recordColumns: RecordColumn<Activity>[] = sortColumns.map((column) => ({
    key: column.key,
    label: column.label,
    placement: activityPlacement[column.key],
    render: (item) => renderCell(column.key, item),
  }));

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {canEdit ? (
          <PageHeaderActions>
            <Button type="button" asChild className="w-full sm:w-auto">
              <Link to={createHref}>
                <PlusIcon data-icon="inline-start" />
                Create {isQuiz ? 'Quiz' : 'Assessment'}
              </Link>
            </Button>
          </PageHeaderActions>
        ) : null}
        <ListPageSkeleton columns={isQuiz ? 7 : 8} />
      </div>
    );
  }

  return (
    <div ref={ref} className="flex flex-col gap-4">
      {canEdit ? (
        <PageHeaderActions>
          <Button type="button" asChild className="w-full sm:w-auto">
            <Link to={createHref}>
              <PlusIcon data-icon="inline-start" />
              Create {isQuiz ? 'Quiz' : 'Assessment'}
            </Link>
          </Button>
        </PageHeaderActions>
      ) : null}

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
          <>
            {narrow ? (
              <RecordSortSelect
                columns={recordColumns}
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
            caption={isQuiz ? 'Quizzes' : 'Assessments'}
            rows={pageRows}
            getRowId={(item) => item.id}
            columns={recordColumns}
            narrow={narrow}
            empty={`No ${noun} match the current filters.`}
            sort={{
              key: sortKey,
              direction: sortDir,
              onSort: (key) => toggleSort(key as SortKey),
            }}
            selection={{
              ...records,
              rowLabel: (item) => `Select ${item.name}`,
            }}
            renderActions={(item) => (
              <RowActions
                view={{ to: `${listPath}/${item.id}` }}
                edit={canEdit ? { to: `${listPath}/${item.id}/edit` } : undefined}
              />
            )}
          />

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : start + 1} to {end} of {filtered.length} {noun}
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
  );
}

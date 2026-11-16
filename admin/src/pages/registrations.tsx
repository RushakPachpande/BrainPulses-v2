import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  PlusIcon,
  RotateCcwIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { RecordSortSelect } from '@/components/record-sort-select';
import { ResponsiveRecords, type RecordColumn } from '@/components/responsive-records';
import { RowActions } from '@/components/row-actions';
import { AssignmentStatusPill, AttemptStatusPill } from '@/components/status-pill';
import { Toolbar, type ToolbarFilter } from '@/components/toolbar';
import { selectionMatches } from '@/lib/multi-select';
import { confirmSensitiveDelete, useConfirm } from '@/components/use-confirm';
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
import { ApiError } from '@/lib/api-client';
import { canEditKind, canFullKind } from '@/lib/access';
import { adminQueryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import {
  deleteAttempt,
  deleteParticipant,
  getActivities,
  getRegistrations,
  type ActivityKind,
} from '@/services';
import { AddRegistrationDialog } from '@/pages/add-registration-dialog';
import type { RegistrationRow as Registration } from '@/services/types';

const EMPTY_ROWS: Registration[] = [];

type SortKey =
  'id' | 'name' | 'email' | 'phone' | 'registered' | 'activity' | 'assignment' | 'attempt';

const ASSIGNMENT_OPTIONS = ['Assigned', 'Pending'];
const ATTEMPT_OPTIONS = ['Completed', 'In Progress', 'Not Started'];

function compareRows(a: Registration, b: Registration, key: SortKey) {
  return String(a[key]).localeCompare(String(b[key]), undefined, { numeric: true });
}

const registrationPlacement: Record<SortKey, RecordColumn<Registration>['placement']> = {
  id: 'identity',
  name: 'title',
  email: 'wide',
  phone: 'wide',
  registered: 'details',
  activity: 'primary',
  assignment: 'primary',
  attempt: 'status',
};

function renderRegistrationCell(key: SortKey, row: Registration) {
  switch (key) {
    case 'id':
      return row.id;
    case 'name':
      return <span className="font-medium">{row.name}</span>;
    case 'email':
      return row.email;
    case 'phone':
      return row.phone;
    case 'registered':
      return row.registered;
    case 'activity':
      return row.activity;
    case 'assignment':
      return <AssignmentStatusPill value={row.assignment} />;
    case 'attempt':
      return <AttemptStatusPill value={row.attempt} />;
  }
}

export function RegistrationsPage({ kind }: { kind: ActivityKind }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { narrow, ref } = useContainerNarrow();
  const auth = useAuth();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canEdit = canEditKind(membership, kind);
  const canFull = canFullKind(membership, kind);
  const isQuiz = kind === 'quiz';
  const activityLabel = isQuiz ? 'Quiz' : 'Assessment';
  const attemptLabel = isQuiz ? 'Attempt Status' : 'Participant Status';
  const acrossLabel = isQuiz ? 'Across all quizzes' : 'Across all assessments';

  const sortColumns: { key: SortKey; label: string }[] = [
    { key: 'id', label: 'Unique ID' },
    { key: 'name', label: 'Participant Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'registered', label: 'Registration Date' },
    { key: 'activity', label: activityLabel },
    { key: 'assignment', label: 'Assignment Status' },
    { key: 'attempt', label: attemptLabel },
  ];

  const recordColumns: RecordColumn<Registration>[] = sortColumns.map((column) => ({
    key: column.key,
    label: column.label,
    placement: registrationPlacement[column.key],
    identityPrefix: column.key === 'id' ? 'ID: ' : undefined,
    tableClassName: column.key === 'id' || column.key === 'phone' ? 'tabular-nums' : undefined,
    render: (row) => renderRegistrationCell(column.key, row),
  }));

  const orgId = useOrgId();
  const { data, isPending: loading } = useQuery({
    queryKey: adminQueryKeys.registrations(orgId, kind),
    queryFn: () => getRegistrations(kind),
    enabled: Boolean(orgId),
  });
  const { data: activityList } = useQuery({
    queryKey: adminQueryKeys.activities(orgId, kind),
    queryFn: () => getActivities(kind),
    enabled: Boolean(orgId),
  });
  const rows = data ?? EMPTY_ROWS;

  const [addOpen, setAddOpen] = useState(false);

  async function onDeleteRegistration(row: Registration) {
    const password = await confirmSensitiveDelete(confirm, {
      title: `Delete ${row.name}'s registration?`,
      description: 'Permanently removes this participant. This cannot be undone.',
      details: [
        'Their registrations, attempts, scores, and reports are deleted.',
        'They are removed from every quiz, assessment, and contest form they are on.',
        'The live registration link can sign them up again as a new Registration ID.',
      ],
      confirmLabel: 'Delete registration',
    });
    if (!password) return;
    try {
      await deleteParticipant(row.participantId, password);
      toast.success('Registration deleted.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'registrations'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'results'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'contest-forms'] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete registration.');
    }
  }

  async function onDeleteAttempt(row: Registration) {
    if (!row.attemptId) return;
    const inProgress = row.attempt === 'In Progress';
    const password = await confirmSensitiveDelete(confirm, {
      title: inProgress ? 'Delete this in-progress attempt?' : 'Delete this attempt?',
      description: inProgress
        ? 'Removes the open attempt so the participant can start again as if they never began. This cannot be undone.'
        : "Removes the participant's attempt and score. They can start again as if they never attempted. This cannot be undone.",
      confirmLabel: 'Delete attempt',
    });
    if (!password) return;
    try {
      await deleteAttempt(row.attemptId, password);
      toast.success('Attempt deleted.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'registrations'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'results'] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete attempt.');
    }
  }
  const [search, setSearch] = useState('');
  const [activity, setActivity] = useState<string[]>([]);
  const [assignment, setAssignment] = useState<string[]>([]);
  const [attempt, setAttempt] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
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
        detail: <span className="text-muted-foreground">{acrossLabel}</span>,
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

  const activityOptions = useMemo(
    () =>
      [...new Set((activityList ?? []).map((item) => item.name.trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [activityList],
  );

  const filters: ToolbarFilter[] = [
    {
      name: activityLabel,
      options: activityOptions,
      values: activity,
      onValuesChange: (values) => {
        setActivity(values);
        setPage(1);
      },
    },
    {
      name: 'Assignment Status',
      options: ASSIGNMENT_OPTIONS,
      values: assignment,
      onValuesChange: (values) => {
        setAssignment(values);
        setPage(1);
      },
    },
    {
      name: attemptLabel,
      options: ATTEMPT_OPTIONS,
      values: attempt,
      onValuesChange: (values) => {
        setAttempt(values);
        setPage(1);
      },
    },
  ];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let next = rows.filter((row) => {
      if (!selectionMatches(activity, row.activity)) return false;
      if (!selectionMatches(assignment, row.assignment)) return false;
      if (!selectionMatches(attempt, row.attempt)) return false;
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
  }, [rows, search, activity, assignment, attempt, sortKey, sortDir]);

  const size = Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * size;
  const pageRows = filtered.slice(start, start + size);
  const end = filtered.length === 0 ? 0 : Math.min(start + size, filtered.length);

  const pageIds = pageRows.map((row) => row.registrationId);
  const records = useRecordSelection(
    orgId,
    `registrations-${kind}`,
    'registrations',
    pageIds,
    filtered.map((row) => row.registrationId),
  );

  function clearFilters() {
    setSearch('');
    setActivity([]);
    setAssignment([]);
    setAttempt([]);
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

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {canEdit ? (
          <PageHeaderActions>
            <Button type="button" className="w-full sm:w-auto" onClick={() => setAddOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              Add registration
            </Button>
          </PageHeaderActions>
        ) : null}
        <ListPageSkeleton columns={7} />
        {addOpen ? <AddRegistrationDialog kind={kind} onOpenChange={setAddOpen} /> : null}
      </div>
    );
  }

  return (
    <div ref={ref} className="flex flex-col gap-4">
      {canEdit ? (
        <PageHeaderActions>
          <Button type="button" className="w-full sm:w-auto" onClick={() => setAddOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Add registration
          </Button>
        </PageHeaderActions>
      ) : null}
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
            caption={`${activityLabel} registrations`}
            rows={pageRows}
            getRowId={(row) => row.registrationId}
            columns={recordColumns}
            narrow={narrow}
            empty="No registrations match the current filters."
            sort={{
              key: sortKey,
              direction: sortDir,
              onSort: (key) => toggleSort(key as SortKey),
            }}
            selection={{
              ...records,
              rowLabel: (row) => `Select ${row.name}`,
            }}
            renderActions={(row) => (
              <RowActions
                view={{
                  to: isQuiz
                    ? `/quizzes/registrations/${row.registrationId}`
                    : `/assessments/registrations/${row.registrationId}`,
                }}
                edit={
                  canEdit
                    ? {
                        to: isQuiz
                          ? `/quizzes/registrations/${row.registrationId}/edit`
                          : `/assessments/registrations/${row.registrationId}/edit`,
                      }
                    : undefined
                }
                removeRegistration={
                  canFull
                    ? {
                        onClick: () => {
                          void onDeleteRegistration(row);
                        },
                      }
                    : undefined
                }
                remove={
                  canFull && row.attemptId
                    ? {
                        label: 'Delete attempt',
                        onClick: () => {
                          void onDeleteAttempt(row);
                        },
                      }
                    : undefined
                }
              />
            )}
            onRowOpen={(row) =>
              navigate(
                isQuiz
                  ? `/quizzes/registrations/${row.registrationId}`
                  : `/assessments/registrations/${row.registrationId}`,
              )
            }
          />

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : start + 1} to {end} of {filtered.length}{' '}
              registrations
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
      {addOpen ? <AddRegistrationDialog kind={kind} onOpenChange={setAddOpen} /> : null}
    </div>
  );
}

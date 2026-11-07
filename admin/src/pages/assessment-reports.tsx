import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, RotateCcwIcon } from 'lucide-react';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { RecordSortSelect } from '@/components/record-sort-select';
import { ResponsiveRecords, type RecordColumn } from '@/components/responsive-records';
import { StatusPill } from '@/components/status-pill';
import { Toolbar, type ToolbarFilter } from '@/components/toolbar';
import { useConfirm } from '@/components/use-confirm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
import { useAuth } from '@/contexts/auth-context';
import { PageHeaderActions } from '@/contexts/page-header';
import { useContainerNarrow } from '@/hooks/use-container-narrow';
import { useOrgId } from '@/hooks/use-org-id';
import { canFullKind } from '@/lib/access';
import { adminQueryKeys } from '@/lib/query-keys';
import {
  downloadAssessmentReport,
  getAssessmentReport,
  publishRoundResults,
  type AssessmentReportRow,
} from '@/services/assessment-reports';
import { AssessmentReportSheet } from '@/pages/assessment-report-sheet';
import { QuizReportDownloadDialog } from '@/pages/quiz-report-download';
import {
  attemptsLabel,
  attemptStatusLabel,
  columnStorageKey,
  formatDuration,
  formatMarks,
  formatReportDate,
  negativeLabel,
  percentClass,
} from '@/pages/quiz-report-format';

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

const COLUMNS = [
  { key: 'code', label: 'Registration ID' },
  { key: 'name', label: 'Participant Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'round', label: 'Round' },
  { key: 'attemptsUsed', label: 'Attempts used' },
  { key: 'score', label: 'Marks scored' },
  { key: 'maxScore', label: 'Total marks' },
  { key: 'percent', label: '%' },
  { key: 'result', label: 'Result' },
  { key: 'correct', label: 'No. of correct answers' },
  { key: 'questionCount', label: 'Total no. of questions' },
  { key: 'skipped', label: 'No. of skipped questions' },
  { key: 'negative', label: 'Negative marks' },
  { key: 'timeTaken', label: 'Time taken' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'autoSubmitted', label: 'Auto-submitted' },
  { key: 'attemptStatus', label: 'Attempt status' },
] as const;

type ColumnKey = (typeof COLUMNS)[number]['key'];
const HIDDEN = new Set<ColumnKey>(['skipped', 'negative']);
const NUMERIC = new Set<ColumnKey>([
  'score',
  'maxScore',
  'percent',
  'correct',
  'questionCount',
  'skipped',
  'negative',
]);

const REASON = {
  timer: 'Timer ran out',
  quiz_ended: 'Assessment ended',
  quiz_deactivated: 'Assessment deactivated',
} as const;

function defaultColumns(): ColumnKey[] {
  return COLUMNS.map((column) => column.key).filter((key) => !HIDDEN.has(key));
}

function readColumns(userId: string): ColumnKey[] {
  try {
    const raw = localStorage.getItem(columnStorageKey(`assessment:${userId}`));
    if (!raw) return defaultColumns();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultColumns();
    const allowed = new Set(COLUMNS.map((column) => column.key));
    const keys = parsed.filter((key): key is ColumnKey => allowed.has(key as ColumnKey));
    return keys.length > 0 ? keys : defaultColumns();
  } catch {
    return defaultColumns();
  }
}

export function AssessmentReportsPage() {
  const auth = useAuth();
  const confirm = useConfirm();
  const orgId = useOrgId();
  const userId = auth.status === 'authenticated' ? auth.user.id : '';
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canPublish = canFullKind(membership, 'assessment');
  const { narrow, ref } = useContainerNarrow();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [activityId, setActivityId] = useState(searchParams.get('activityId') ?? 'all');
  const [roundId, setRoundId] = useState(searchParams.get('roundId') ?? 'all');
  const [activityStatus, setActivityStatus] = useState('any');
  const [attemptStatus, setAttemptStatus] = useState('any');
  const [autoSubmitted, setAutoSubmitted] = useState('any');
  const [sortKey, setSortKey] = useState<ColumnKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');
  const [columns, setColumns] = useState<ColumnKey[]>(defaultColumns);
  const [openRow, setOpenRow] = useState<AssessmentReportRow | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (userId) setColumns(readColumns(userId));
  }, [userId]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (activityId !== 'all') params.set('activityId', activityId);
    if (roundId !== 'all') params.set('roundId', roundId);
    if (activityStatus !== 'any') params.set('activityStatus', activityStatus);
    if (attemptStatus !== 'any') params.set('attemptStatus', attemptStatus);
    if (autoSubmitted !== 'any') params.set('autoSubmitted', autoSubmitted);
    if (sortKey) {
      params.set('sort', sortKey);
      params.set('dir', sortDir);
    }
    params.set('page', String(page));
    params.set('pageSize', pageSize);
    return params.toString();
  }, [
    activityId,
    activityStatus,
    attemptStatus,
    autoSubmitted,
    page,
    pageSize,
    roundId,
    search,
    sortDir,
    sortKey,
  ]);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: adminQueryKeys.assessmentReports(orgId, query),
    queryFn: () => getAssessmentReport(query),
    enabled: Boolean(orgId),
  });

  const assessmentChoices = useMemo(() => {
    return (data?.options.assessments ?? []).filter((item) =>
      activityStatus === 'any' ? true : item.activityStatus === activityStatus,
    );
  }, [activityStatus, data?.options.assessments]);

  const roundChoices = useMemo(() => {
    return (data?.options.rounds ?? []).filter((round) =>
      activityId === 'all' ? true : round.activityId === activityId,
    );
  }, [activityId, data?.options.rounds]);

  const selectedAssessment = assessmentChoices.find((item) => item.id === activityId) ?? null;
  const selectedRound = roundChoices.find((round) => round.id === roundId) ?? null;
  const inProgressAllowed =
    activityStatus !== 'expired' &&
    activityStatus !== 'inactive' &&
    (selectedAssessment == null || selectedAssessment.activityStatus === 'active');

  useEffect(() => {
    if (!data) return;
    if (activityId !== 'all' && !assessmentChoices.some((item) => item.id === activityId)) {
      setActivityId('all');
      setPage(1);
    }
  }, [activityId, assessmentChoices, data]);

  useEffect(() => {
    if (!data) return;
    if (roundId !== 'all' && !roundChoices.some((round) => round.id === roundId)) {
      setRoundId('all');
      setPage(1);
    }
  }, [data, roundChoices, roundId]);

  useEffect(() => {
    if (attemptStatus === 'in_progress' && !inProgressAllowed) {
      setAttemptStatus('any');
      setPage(1);
    }
  }, [attemptStatus, inProgressAllowed]);

  function chooseAssessment(id: string) {
    setActivityId(id);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (id === 'all') next.delete('activityId');
    else next.set('activityId', id);
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    setSearch('');
    setActivityId('all');
    setRoundId('all');
    setActivityStatus('any');
    setAttemptStatus('any');
    setAutoSubmitted('any');
    setPage(1);
    setSearchParams({}, { replace: true });
  }

  function toggleSort(key: string) {
    setPage(1);
    const column = key as ColumnKey;
    if (sortKey !== column) {
      setSortKey(column);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc') {
      setSortDir('desc');
      return;
    }
    setSortKey(null);
    setSortDir('desc');
  }

  function toggleColumn(key: ColumnKey, checked: boolean) {
    setColumns((current) => {
      const next = checked
        ? COLUMNS.map((column) => column.key).filter(
            (column) => current.includes(column) || column === key,
          )
        : current.filter((column) => column !== key);
      const stored = next.length > 0 ? next : current;
      if (userId)
        localStorage.setItem(columnStorageKey(`assessment:${userId}`), JSON.stringify(stored));
      return stored;
    });
  }

  const filters: ToolbarFilter[] = [
    {
      name: 'Assessment',
      value: assessmentChoices.some((item) => item.id === activityId) ? activityId : 'all',
      onValueChange: chooseAssessment,
      options: [
        { value: 'all', label: 'All assessments' },
        ...assessmentChoices.map((item) => ({ value: item.id, label: item.name })),
      ],
    },
    {
      name: 'Round',
      value: roundChoices.some((round) => round.id === roundId) ? roundId : 'all',
      onValueChange: (value) => {
        setRoundId(value);
        setPage(1);
      },
      options: [
        { value: 'all', label: 'All rounds' },
        ...roundChoices.map((round) => ({
          value: round.id,
          label: activityId === 'all' ? `${round.assessmentName} · ${round.name}` : round.name,
        })),
      ],
    },
    {
      name: 'Assessment status',
      value: activityStatus,
      onValueChange: (value) => {
        setActivityStatus(value);
        setPage(1);
      },
      options: [
        { value: 'any', label: 'Any' },
        { value: 'active', label: 'Active' },
        { value: 'expired', label: 'Expired' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
    {
      name: 'Attempt status',
      value: attemptStatus === 'in_progress' && !inProgressAllowed ? 'any' : attemptStatus,
      onValueChange: (value) => {
        setAttemptStatus(value);
        setPage(1);
      },
      options: [
        { value: 'any', label: 'Any' },
        { value: 'completed', label: 'Completed' },
        ...(inProgressAllowed ? [{ value: 'in_progress', label: 'In progress' }] : []),
        { value: 'not_started', label: 'Not started' },
      ],
    },
    {
      name: 'Auto-submitted',
      value: autoSubmitted,
      onValueChange: (value) => {
        setAutoSubmitted(value);
        setPage(1);
      },
      options: [
        { value: 'any', label: 'Any' },
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    },
  ];

  const recordColumns: RecordColumn<AssessmentReportRow>[] = COLUMNS.filter((column) =>
    columns.includes(column.key),
  ).map((column) => ({
    key: column.key,
    label: column.label,
    placement: column.key === 'name' ? 'title' : column.key === 'code' ? 'identity' : 'details',
    identityPrefix: column.key === 'code' ? 'Registration ID: ' : undefined,
    tableClassName: NUMERIC.has(column.key) ? 'text-right tabular-nums' : undefined,
    headClassName: NUMERIC.has(column.key) ? 'text-right' : undefined,
    render: (row) => renderCell(column.key, row),
  }));

  const summary = data?.summary;
  const metrics = [
    ['Registered', summary ? String(summary.registered) : '—', 'Student rounds in view'],
    ['Completed', summary ? String(summary.completed) : '—', 'Submitted at least once'],
    ['Not started', summary ? String(summary.notStarted) : '—', 'Never started this round'],
    [
      'Average score',
      summary?.averageScore == null ? '—' : `${summary.averageScore}%`,
      'Best attempts, completed only',
    ],
    ['Pass rate', summary?.passRate == null ? '—' : `${summary.passRate}%`, 'Of completed rows'],
  ] as const;

  const total = data?.page.total ?? 0;
  const currentPage = data?.page.page ?? page;
  const size = data?.page.pageSize ?? Number(pageSize);
  const start = total === 0 ? 0 : (currentPage - 1) * size + 1;
  const end = Math.min(currentPage * size, total);
  const pageCount = data?.page.pageCount ?? 1;
  const noRegistrations = Boolean(data && data.options.assessments.length === 0);
  const holdsScores =
    selectedRound?.scoreRelease === 'after_publish' && !selectedRound.resultsPublishedAt;
  const blocksNext =
    (selectedRound?.withheldCount ?? 0) > 0 && selectedRound?.scoreRelease === 'after_submit';
  const showPublish = Boolean(
    selectedRound && (selectedRound.scoreRelease === 'after_publish' || blocksNext),
  );

  async function onPublish() {
    if (!selectedRound || !canPublish) return;
    const ok = await confirm({
      title: `Publish results for ${selectedRound.name}?`,
      description: holdsScores
        ? "Every student who has submitted this round will be able to see their score and result. You can't hide them again afterwards."
        : "Publishing releases held scores so students can continue to the next round. You can't hide them again afterwards.",
      confirmLabel: 'Publish results',
    });
    if (ok !== true) return;
    setPublishing(true);
    try {
      await publishRoundResults(selectedRound.id);
      toast.success('Results published');
      await refetch();
    } catch {
      toast.error("Couldn't publish results. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  const visible = COLUMNS.filter((column) => columns.includes(column.key)).map(
    (column) => column.key,
  );

  return (
    <div ref={ref} className="flex flex-col gap-4">
      <PageHeaderActions>
        <Button type="button" disabled={!data || isError} onClick={() => setDownloadOpen(true)}>
          <DownloadIcon data-icon="inline-start" />
          Download report
        </Button>
      </PageHeaderActions>

      {isPending && !data ? <ListPageSkeleton kpiCount={5} columns={6} /> : null}

      {isError && !data ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-8">
            <p className="text-sm text-muted-foreground">Couldn&apos;t load results.</p>
            <Button type="button" variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {metrics.map(([label, value, hint]) => (
              <Card key={label}>
                <CardContent className="flex flex-col gap-1">
                  <div className="text-sm text-muted-foreground">{label}</div>
                  <div className="text-2xl font-semibold tabular-nums">{value}</div>
                  <div className="text-xs text-muted-foreground">{hint}</div>
                </CardContent>
              </Card>
            ))}
          </section>

          {showPublish && selectedRound ? (
            <Alert
              className={
                selectedRound.resultsPublishedAt && !blocksNext && !holdsScores
                  ? 'border-success/40 bg-success/10'
                  : 'border-warning/40 bg-warning/10'
              }
            >
              <AlertTitle>
                {selectedRound.resultsPublishedAt && !holdsScores
                  ? `Results published on ${formatReportDate(selectedRound.resultsPublishedAt)}. Students can see their scores.`
                  : holdsScores
                    ? 'Results not yet visible to students.'
                    : 'Some results are held. Publishing them lets students continue to the next round.'}
              </AlertTitle>
              {(!selectedRound.resultsPublishedAt || blocksNext || holdsScores) && canPublish ? (
                <AlertDescription>
                  <Button type="button" disabled={publishing} onClick={() => void onPublish()}>
                    Publish results
                  </Button>
                </AlertDescription>
              ) : null}
            </Alert>
          ) : null}

          <Toolbar
            filters={filters}
            searchPlaceholder="Search name or Registration ID"
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            actions={
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline">
                      Columns
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
                    {COLUMNS.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.key}
                        checked={columns.includes(column.key)}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(checked) => {
                          if (checked !== true && columns.length === 1) return;
                          toggleColumn(column.key, checked === true);
                        }}
                      >
                        {column.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {narrow ? (
                  <RecordSortSelect
                    columns={recordColumns}
                    activeKey={sortKey}
                    direction={sortDir}
                    onSort={toggleSort}
                  />
                ) : null}
                <Button type="button" variant="outline" onClick={clearFilters}>
                  <RotateCcwIcon data-icon="inline-start" />
                  Clear Filters
                </Button>
              </>
            }
          />

          <Card>
            <CardContent className="flex flex-col gap-4">
              <ResponsiveRecords
                caption="Assessment reports"
                rows={data.rows}
                getRowId={(row) => row.id}
                columns={recordColumns}
                narrow={narrow}
                sort={{ key: sortKey, direction: sortDir, onSort: toggleSort }}
                onRowOpen={setOpenRow}
                empty={
                  noRegistrations ? (
                    'No students have registered yet.'
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-6">
                      <p className="font-medium text-foreground">No students match these filters</p>
                      <p>Try clearing a filter or searching for a different name or ID.</p>
                      <Button type="button" variant="outline" onClick={clearFilters}>
                        Clear all filters
                      </Button>
                    </div>
                  )
                }
              />
              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {start} to {end} of {total} participants
                </p>
                <div className="list-pager flex flex-nowrap items-center justify-between gap-2 sm:justify-end">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-sm whitespace-nowrap text-muted-foreground">
                      Rows per page
                    </span>
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
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
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
                      onClick={() => setPage((value) => value + 1)}
                    >
                      <ChevronRightIcon />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      <AssessmentReportSheet
        registrationId={openRow?.registrationId ?? null}
        roundId={openRow?.roundId ?? null}
        onOpenChange={(open) => {
          if (open) return;
          const id = openRow?.id;
          setOpenRow(null);
          if (!id) return;
          requestAnimationFrame(() => {
            document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`)?.focus();
          });
        }}
      />
      <QuizReportDownloadDialog
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        query={`${query}${query ? '&' : ''}columns=${visible.join(',')}`}
        completed={summary?.completed ?? 0}
        registered={summary?.registered ?? 0}
        columnCount={visible.length}
        onDownloadReport={downloadAssessmentReport}
        absentHint="Adds registered students with no submitted attempt on that round (Not started, and In progress while the assessment is active). Their score columns are left blank."
      />
    </div>
  );
}

function renderCell(key: ColumnKey, row: AssessmentReportRow) {
  switch (key) {
    case 'code':
      return <span className="font-medium">{row.code}</span>;
    case 'name':
      return <span className="font-medium">{row.name}</span>;
    case 'email':
      return row.email;
    case 'phone':
      return row.phone ?? <Dash />;
    case 'assessment':
      return row.assessmentName;
    case 'round':
      return row.roundName;
    case 'attemptsUsed':
      return attemptsLabel(row.attemptsStarted, row.attemptsAllowed);
    case 'score':
      return row.score == null ? (
        <Dash />
      ) : (
        <span className="font-semibold">{formatMarks(row.score)}</span>
      );
    case 'maxScore':
      return row.maxScore == null ? <Dash /> : formatMarks(row.maxScore);
    case 'percent':
      return row.percent == null ? (
        <Dash />
      ) : (
        <span className={percentClass(row.percent, row.passLinePercent)}>{row.percent}%</span>
      );
    case 'result':
      if (row.result == null) return <Dash />;
      return (
        <StatusPill
          value={row.result === 'pass' ? 'Pass' : 'Fail'}
          tone={row.result === 'pass' ? 'ok' : 'er'}
        />
      );
    case 'correct':
      return row.correct == null ? <Dash /> : row.correct;
    case 'questionCount':
      return row.questionCount;
    case 'skipped':
      return row.skipped == null ? <Dash /> : row.skipped;
    case 'negative':
      return row.negative == null ? <Dash /> : negativeLabel(row.negative);
    case 'timeTaken':
      return row.timeTakenSeconds == null ? <Dash /> : formatDuration(row.timeTakenSeconds);
    case 'submitted':
      return row.submittedAt ? formatReportDate(row.submittedAt) : <Dash />;
    case 'autoSubmitted':
      if (row.autoSubmitted == null) return <Dash />;
      if (!row.autoSubmitted) return 'No';
      return (
        <span className="inline-flex flex-col items-start gap-1">
          <StatusPill value="Yes" tone="wn" />
          {row.autoSubmitReason ? (
            <span className="text-xs text-warning">{REASON[row.autoSubmitReason]}</span>
          ) : null}
        </span>
      );
    case 'attemptStatus': {
      const tone =
        row.attemptStatus === 'completed'
          ? 'ok'
          : row.attemptStatus === 'in_progress'
            ? 'wn'
            : 'gy';
      return <StatusPill value={attemptStatusLabel(row.attemptStatus)} tone={tone} />;
    }
    default:
      return <Dash />;
  }
}

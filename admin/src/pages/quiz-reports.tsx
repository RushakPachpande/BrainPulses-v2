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
import { ApiError } from '@/lib/api-client';
import { canFullKind } from '@/lib/access';
import { adminQueryKeys } from '@/lib/query-keys';
import { getQuizReport, publishQuizResults, type QuizReportRow } from '@/services/quiz-reports';
import { QuizReportDownloadDialog } from '@/pages/quiz-report-download';
import {
  AUTO_REASON_LABEL,
  REPORT_COLUMNS,
  attemptsLabel,
  attemptStatusLabel,
  columnStorageKey,
  defaultColumns,
  formatDuration,
  formatMarks,
  formatReportDate,
  negativeLabel,
  percentClass,
  readStoredColumns,
  type ReportColumnKey,
} from '@/pages/quiz-report-format';
import { QuizReportSheet } from '@/pages/quiz-report-sheet';

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

const NUMERIC = new Set<ReportColumnKey>([
  'score',
  'maxScore',
  'percent',
  'correct',
  'questionCount',
  'skipped',
  'negative',
]);

export function QuizReportsPage() {
  const auth = useAuth();
  const confirm = useConfirm();
  const orgId = useOrgId();
  const userId = auth.status === 'authenticated' ? auth.user.id : '';
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canPublish = canFullKind(membership, 'quiz');
  const { narrow, ref } = useContainerNarrow();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [contestId, setContestId] = useState('all');
  const [activityId, setActivityId] = useState(searchParams.get('activityId') ?? 'all');
  const [quizStatus, setQuizStatus] = useState('any');
  const [attemptStatus, setAttemptStatus] = useState('any');
  const [autoSubmitted, setAutoSubmitted] = useState('any');
  const [sortKey, setSortKey] = useState<ReportColumnKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');
  const [columns, setColumns] = useState<ReportColumnKey[]>(defaultColumns);
  const [openId, setOpenId] = useState<string | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (userId) setColumns(readStoredColumns(userId));
  }, [userId]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (contestId !== 'all') params.set('contestId', contestId);
    if (activityId !== 'all') params.set('activityId', activityId);
    if (quizStatus !== 'any') params.set('quizStatus', quizStatus);
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
    attemptStatus,
    autoSubmitted,
    contestId,
    page,
    pageSize,
    quizStatus,
    search,
    sortDir,
    sortKey,
  ]);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: adminQueryKeys.quizReports(orgId, query),
    queryFn: () => getQuizReport(query),
    enabled: Boolean(orgId),
  });

  const quizChoices = useMemo(() => {
    const quizzes = data?.options.quizzes ?? [];
    return quizzes.filter((quiz) => {
      if (contestId !== 'all' && quiz.contestId !== contestId) return false;
      if (quizStatus === 'any') return true;
      return quiz.quizStatus === quizStatus;
    });
  }, [contestId, data?.options.quizzes, quizStatus]);

  const selectedQuiz = quizChoices.find((quiz) => quiz.id === activityId) ?? null;
  const inProgressAllowed =
    quizStatus !== 'expired' &&
    quizStatus !== 'inactive' &&
    (selectedQuiz == null || selectedQuiz.quizStatus === 'active');

  useEffect(() => {
    if (!data) return;
    if (activityId !== 'all' && !quizChoices.some((quiz) => quiz.id === activityId)) {
      setActivityId('all');
      setPage(1);
    }
  }, [activityId, data, quizChoices]);

  useEffect(() => {
    if (attemptStatus === 'in_progress' && !inProgressAllowed) {
      setAttemptStatus('any');
      setPage(1);
    }
  }, [attemptStatus, inProgressAllowed]);

  function chooseQuiz(id: string) {
    setActivityId(id);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (id === 'all') next.delete('activityId');
    else next.set('activityId', id);
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    setSearch('');
    setContestId('all');
    setActivityId('all');
    setQuizStatus('any');
    setAttemptStatus('any');
    setAutoSubmitted('any');
    setPage(1);
    setSearchParams({}, { replace: true });
  }

  function toggleSort(key: string) {
    setPage(1);
    const column = key as ReportColumnKey;
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

  function toggleColumn(key: ReportColumnKey, checked: boolean) {
    setColumns((current) => {
      const next = checked
        ? REPORT_COLUMNS.map((column) => column.key).filter(
            (column) => current.includes(column) || column === key,
          )
        : current.filter((column) => column !== key);
      const stored = next.length > 0 ? next : current;
      if (userId) localStorage.setItem(columnStorageKey(userId), JSON.stringify(stored));
      return stored;
    });
  }

  const filters: ToolbarFilter[] = [
    {
      name: 'Contest',
      value: contestId,
      onValueChange: (value) => {
        setContestId(value);
        setPage(1);
      },
      options: [
        { value: 'all', label: 'All contests' },
        ...(data?.options.contests ?? []).map((contest) => ({
          value: contest.id,
          label: contest.name,
        })),
      ],
    },
    {
      name: 'Quiz',
      value: quizChoices.some((quiz) => quiz.id === activityId) ? activityId : 'all',
      onValueChange: chooseQuiz,
      options: [
        { value: 'all', label: 'All quizzes' },
        ...quizChoices.map((quiz) => ({ value: quiz.id, label: quiz.name })),
      ],
    },
    {
      name: 'Quiz status',
      value: quizStatus,
      onValueChange: (value) => {
        setQuizStatus(value);
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

  const recordColumns: RecordColumn<QuizReportRow>[] = REPORT_COLUMNS.filter((column) =>
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
    ['Registered', summary ? String(summary.registered) : '—', 'All students in view'],
    ['Completed', summary ? String(summary.completed) : '—', 'Submitted at least once'],
    ['Not started', summary ? String(summary.notStarted) : '—', 'Registered, never started'],
    [
      'Average score',
      summary?.averageScore == null ? '—' : `${summary.averageScore}%`,
      'Best attempts, completed only',
    ],
    [
      'Pass rate',
      summary?.passRate == null ? '—' : `${summary.passRate}%`,
      'Of completed students',
    ],
  ] as const;

  const total = data?.page.total ?? 0;
  const currentPage = data?.page.page ?? page;
  const size = data?.page.pageSize ?? Number(pageSize);
  const start = total === 0 ? 0 : (currentPage - 1) * size + 1;
  const end = Math.min(currentPage * size, total);
  const pageCount = data?.page.pageCount ?? 1;
  const noRegistrations = Boolean(data && data.options.quizzes.length === 0);
  const publishQuiz =
    activityId !== 'all' ? data?.options.quizzes.find((quiz) => quiz.id === activityId) : undefined;

  async function onPublish() {
    if (!publishQuiz || !canPublish) return;
    const ok = await confirm({
      title: `Publish results for ${publishQuiz.name}?`,
      description:
        "Every student who has submitted will be able to see their score and result. You can't hide them again afterwards.",
      confirmLabel: 'Publish results',
    });
    if (ok !== true) return;
    setPublishing(true);
    try {
      await publishQuizResults(publishQuiz.id);
      toast.success('Results published');
      await refetch();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? "Couldn't publish results. Try again."
          : "Couldn't publish results. Try again.",
      );
    } finally {
      setPublishing(false);
    }
  }

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

          {publishQuiz?.scoreRelease === 'after_publish' ? (
            <Alert
              className={
                publishQuiz.resultsPublishedAt
                  ? 'border-success/40 bg-success/10'
                  : 'border-warning/40 bg-warning/10'
              }
            >
              <AlertTitle>
                {publishQuiz.resultsPublishedAt
                  ? `Results published on ${formatReportDate(publishQuiz.resultsPublishedAt)}. Students can see their scores.`
                  : 'Results not yet visible to students.'}
              </AlertTitle>
              {!publishQuiz.resultsPublishedAt && canPublish ? (
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
                    {REPORT_COLUMNS.map((column) => (
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
                caption="Quiz reports"
                rows={data.rows}
                getRowId={(row) => row.registrationId}
                columns={recordColumns}
                narrow={narrow}
                sort={{ key: sortKey, direction: sortDir, onSort: toggleSort }}
                onRowOpen={(row) => setOpenId(row.registrationId)}
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

      <QuizReportSheet
        registrationId={openId}
        onOpenChange={(open) => {
          if (open) return;
          const id = openId;
          setOpenId(null);
          if (!id) return;
          requestAnimationFrame(() => {
            document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`)?.focus();
          });
        }}
      />
      <QuizReportDownloadDialog
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        query={`${query}${query ? '&' : ''}columns=${REPORT_COLUMNS.filter((column) =>
          columns.includes(column.key),
        )
          .map((column) => column.key)
          .join(',')}`}
        completed={summary?.completed ?? 0}
        registered={summary?.registered ?? 0}
        columnCount={columns.length}
      />
    </div>
  );
}

function renderCell(key: ReportColumnKey, row: QuizReportRow) {
  switch (key) {
    case 'code':
      return <span className="font-medium">{row.code}</span>;
    case 'name':
      return <span className="font-medium">{row.name}</span>;
    case 'email':
      return row.email;
    case 'phone':
      return row.phone ?? <Dash />;
    case 'contest':
      return row.contestName ?? <Dash />;
    case 'quiz':
      return row.quizName;
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
        <span className={percentClass(row.percent, row.passingPercent)}>{row.percent}%</span>
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
            <span className="text-xs text-warning">{AUTO_REASON_LABEL[row.autoSubmitReason]}</span>
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

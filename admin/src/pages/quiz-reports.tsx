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
import {
  getQuizReport,
  publishQuizResults,
  unpublishQuizResults,
  type QuizReportQuiz,
  type QuizReportRow,
} from '@/services/quiz-reports';
import { QuizReportDownloadDialog } from '@/pages/quiz-report-download';
import {
  AUTO_REASON_LABEL,
  REPORT_COLUMNS,
  attemptsLabel,
  attemptStatusLabel,
  defaultColumns,
  formatDuration,
  formatMarks,
  formatReportDate,
  negativeLabel,
  percentClass,
  readStoredColumns,
  writeStoredColumns,
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
  const [contestIds, setContestIds] = useState<string[]>([]);
  const [activityIds, setActivityIds] = useState<string[]>(() => {
    const initial = searchParams.get('activityId');
    return initial ? [initial] : [];
  });
  const [quizStatuses, setQuizStatuses] = useState<string[]>([]);
  const [attemptStatuses, setAttemptStatuses] = useState<string[]>([]);
  const [autoSubmitted, setAutoSubmitted] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<ReportColumnKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');
  const [columns, setColumns] = useState<ReportColumnKey[]>(defaultColumns);
  const [openId, setOpenId] = useState<string | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);

  useEffect(() => {
    if (userId) setColumns(readStoredColumns(userId));
  }, [userId]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    for (const id of contestIds) params.append('contestId', id);
    for (const id of activityIds) params.append('activityId', id);
    for (const status of quizStatuses) params.append('quizStatus', status);
    for (const status of attemptStatuses) params.append('attemptStatus', status);
    for (const value of autoSubmitted) params.append('autoSubmitted', value);
    if (sortKey) {
      params.set('sort', sortKey);
      params.set('dir', sortDir);
    }
    params.set('page', String(page));
    params.set('pageSize', pageSize);
    return params.toString();
  }, [
    activityIds,
    attemptStatuses,
    autoSubmitted,
    contestIds,
    page,
    pageSize,
    quizStatuses,
    search,
    sortDir,
    sortKey,
  ]);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: adminQueryKeys.quizReports(orgId, query),
    queryFn: ({ signal }) => getQuizReport(query, signal),
    enabled: Boolean(orgId),
  });

  const quizChoices = useMemo(() => {
    const quizzes = data?.options.quizzes ?? [];
    return quizzes.filter((quiz) => {
      if (contestIds.length > 0 && (!quiz.contestId || !contestIds.includes(quiz.contestId))) {
        return false;
      }
      if (quizStatuses.length > 0 && !quizStatuses.includes(quiz.quizStatus)) return false;
      return true;
    });
  }, [contestIds, data?.options.quizzes, quizStatuses]);

  const selectedQuiz =
    activityIds.length === 1
      ? (quizChoices.find((quiz) => quiz.id === activityIds[0]) ?? null)
      : null;
  const statusBlocksProgress =
    quizStatuses.length > 0 &&
    quizStatuses.every((status) => status === 'expired' || status === 'inactive');
  const inProgressAllowed =
    !statusBlocksProgress && (selectedQuiz == null || selectedQuiz.quizStatus === 'active');

  useEffect(() => {
    if (!data) return;
    const valid = new Set(quizChoices.map((quiz) => quiz.id));
    setActivityIds((current) => {
      const next = current.filter((id) => valid.has(id));
      return next.length === current.length ? current : next;
    });
  }, [data, quizChoices]);

  useEffect(() => {
    if (attemptStatuses.includes('in_progress') && !inProgressAllowed) {
      setAttemptStatuses((current) => current.filter((status) => status !== 'in_progress'));
      setPage(1);
    }
  }, [attemptStatuses, inProgressAllowed]);

  function chooseQuizzes(ids: string[]) {
    setActivityIds(ids);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    next.delete('activityId');
    if (ids.length === 1) next.set('activityId', ids[0] ?? '');
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    setSearch('');
    setContestIds([]);
    setActivityIds([]);
    setQuizStatuses([]);
    setAttemptStatuses([]);
    setAutoSubmitted([]);
    const columnsDefault = defaultColumns();
    setColumns(columnsDefault);
    if (userId) writeStoredColumns(userId, columnsDefault);
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
      if (userId) writeStoredColumns(userId, stored);
      return stored;
    });
  }

  const filters: ToolbarFilter[] = [
    {
      name: 'Contest',
      values: contestIds,
      onValuesChange: (values) => {
        setContestIds(values);
        setPage(1);
      },
      options: (data?.options.contests ?? []).map((contest) => ({
        value: contest.id,
        label: contest.name,
      })),
    },
    {
      name: 'Quiz',
      values: activityIds.filter((id) => quizChoices.some((quiz) => quiz.id === id)),
      onValuesChange: chooseQuizzes,
      options: quizChoices.map((quiz) => ({ value: quiz.id, label: quiz.name })),
    },
    {
      name: 'Quiz status',
      values: quizStatuses,
      onValuesChange: (values) => {
        setQuizStatuses(values);
        setPage(1);
      },
      options: [
        { value: 'active', label: 'Active' },
        { value: 'expired', label: 'Expired' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
    {
      name: 'Attempt status',
      values: attemptStatuses.filter((status) => status !== 'in_progress' || inProgressAllowed),
      onValuesChange: (values) => {
        setAttemptStatuses(values);
        setPage(1);
      },
      options: [
        { value: 'completed', label: 'Completed' },
        ...(inProgressAllowed ? [{ value: 'in_progress', label: 'In progress' }] : []),
        { value: 'not_started', label: 'Not started' },
      ],
    },
    {
      name: 'Auto-submitted',
      values: autoSubmitted,
      onValuesChange: (values) => {
        setAutoSubmitted(values);
        setPage(1);
      },
      options: [
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
  const publishQuiz = selectedQuiz;
  const pendingWithheld = (publishQuiz?.withheldCount ?? 0) > 0;
  const canPublishNow = Boolean(
    publishQuiz &&
      canPublish &&
      publishQuiz.scoreRelease === 'after_publish' &&
      (!publishQuiz.resultsPublishedAt || pendingWithheld),
  );
  const canUnpublishNow = Boolean(
    publishQuiz &&
      canPublish &&
      publishQuiz.scoreRelease === 'after_publish' &&
      publishQuiz.resultsPublishedAt,
  );

  function quizNeedsPublish(quiz: QuizReportQuiz) {
    return (
      quiz.scoreRelease === 'after_publish' &&
      (!quiz.resultsPublishedAt || quiz.withheldCount > 0)
    );
  }

  const releasePool =
    activityIds.length === 0
      ? quizChoices
      : quizChoices.filter((quiz) => activityIds.includes(quiz.id));
  /** Every after_publish quiz in scope — includes fully published ones so Unpublish stays available. */
  const releaseQuizzes = releasePool.filter((quiz) => quiz.scoreRelease === 'after_publish');
  const showReleaseCard = releaseQuizzes.length > 0;

  async function onPublish(quiz: QuizReportQuiz) {
    if (!canPublish) return;
    const releasingNew = Boolean(quiz.resultsPublishedAt) && quiz.withheldCount > 0;
    const ok = await confirm({
      title: `Publish results for ${quiz.name}?`,
      description: releasingNew
        ? `Publish ${quiz.withheldCount} new attempt${quiz.withheldCount === 1 ? '' : 's'} submitted since the last publish. Students with those attempts will see their scores.`
        : 'Every student who has submitted will be able to see their score and result. You can unpublish later to hide them again.',
      confirmLabel: 'Publish results',
    });
    if (ok !== true) return;
    setPublishing(true);
    try {
      await publishQuizResults(quiz.id);
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

  async function onUnpublish(quiz: QuizReportQuiz) {
    if (!canPublish) return;
    const ok = await confirm({
      title: `Unpublish results for ${quiz.name}?`,
      description:
        'All published scores for this quiz will be hidden from students until you publish again. This applies to everyone.',
      confirmLabel: 'Unpublish results',
      destructive: true,
    });
    if (ok !== true) return;
    setUnpublishing(true);
    try {
      await unpublishQuizResults(quiz.id);
      toast.success('Results unpublished');
      await refetch();
    } catch {
      toast.error("Couldn't unpublish results. Try again.");
    } finally {
      setUnpublishing(false);
    }
  }

  return (
    <div ref={ref} className="flex flex-col gap-4">
      <PageHeaderActions>
        <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {canPublishNow && publishQuiz ? (
            <Button
              type="button"
              disabled={publishing || unpublishing}
              aria-busy={publishing}
              onClick={() => void onPublish(publishQuiz)}
            >
              Publish results
            </Button>
          ) : null}
          {canUnpublishNow && publishQuiz ? (
            <Button
              type="button"
              variant="outline"
              disabled={publishing || unpublishing}
              aria-busy={unpublishing}
              onClick={() => void onUnpublish(publishQuiz)}
            >
              Unpublish results
            </Button>
          ) : null}
          <div className="flex w-full flex-col items-stretch gap-1 sm:w-auto sm:items-end">
            {data && activityIds.length !== 1 ? (
              <p
                id="quiz-download-hint"
                className="text-xs text-muted-foreground sm:max-w-xs sm:text-right"
              >
                Choose one quiz in the Quiz filter to download its report.
              </p>
            ) : null}
            <Button
              type="button"
              disabled={!data || isError || activityIds.length !== 1}
              aria-describedby={data && activityIds.length !== 1 ? 'quiz-download-hint' : undefined}
              onClick={() => setDownloadOpen(true)}
            >
              <DownloadIcon data-icon="inline-start" />
              Download report
            </Button>
          </div>
        </div>
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

          {showReleaseCard ? (
            <Card>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">Score release</p>
                  <p className="text-xs text-muted-foreground">
                    Publish releases held scores. Unpublish hides every published score for that quiz
                    until you publish again.
                  </p>
                </div>
                <ul className="flex flex-col">
                  {releaseQuizzes.map((quiz) => {
                    const needsPublish = quizNeedsPublish(quiz);
                    const isPublished = Boolean(quiz.resultsPublishedAt);
                    return (
                      <li
                        key={quiz.id}
                        className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-sm">{quiz.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {isPublished && quiz.resultsPublishedAt && quiz.withheldCount > 0
                              ? `Published ${formatReportDate(quiz.resultsPublishedAt)} · ${quiz.withheldCount} new attempt${quiz.withheldCount === 1 ? '' : 's'} waiting`
                              : isPublished && quiz.resultsPublishedAt
                                ? `Published ${formatReportDate(quiz.resultsPublishedAt)} · visible to students`
                                : 'Not published · scores held'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {canPublish && needsPublish ? (
                            <Button
                              type="button"
                              disabled={publishing || unpublishing}
                              aria-busy={publishing}
                              onClick={() => void onPublish(quiz)}
                            >
                              Publish results
                            </Button>
                          ) : null}
                          {canPublish && isPublished ? (
                            <Button
                              type="button"
                              variant="outline"
                              disabled={publishing || unpublishing}
                              aria-busy={unpublishing}
                              onClick={() => void onUnpublish(quiz)}
                            >
                              Unpublish results
                            </Button>
                          ) : null}
                          {!canPublish ? (
                            <span className="text-sm text-muted-foreground">
                              {needsPublish ? 'Waiting to publish' : 'Published'}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
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

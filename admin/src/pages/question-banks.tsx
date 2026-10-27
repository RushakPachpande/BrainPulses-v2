import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  FolderOpenIcon,
  InfoIcon,
  LayersIcon,
  PlusIcon,
  RotateCcwIcon,
  UploadIcon,
} from 'lucide-react';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { RecordSortSelect } from '@/components/record-sort-select';
import { ResponsiveRecords, type RecordColumn } from '@/components/responsive-records';
import { RowActions } from '@/components/row-actions';
import { FlowStatusPill } from '@/components/status-pill';
import { Toolbar, type ToolbarFilter } from '@/components/toolbar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { getQuestionBanks, type ActivityKind } from '@/services';
import { presentationTypes, questionTypes } from '@/services/fixtures';
import type { QuestionBank as Bank } from '@/services/types';

const EMPTY_BANKS: Bank[] = [];

type SortKey =
  'name' | 'description' | 'questions' | 'types' | 'presentation' | 'updated' | 'usedIn' | 'status';

function uniqueTypes(values: string[]) {
  return [...new Set(values.flatMap((value) => value.split(',').map((part) => part.trim())))];
}

function bankPlacement(key: SortKey): RecordColumn<Bank>['placement'] {
  if (key === 'name') return 'title';
  if (key === 'status') return 'status';
  if (key === 'questions' || key === 'updated') return 'primary';
  return 'details';
}

function renderBankCell(key: SortKey, row: Bank, usedNoun: string) {
  switch (key) {
    case 'name':
      return <span className="font-medium">{row.name}</span>;
    case 'description':
      return row.description;
    case 'questions':
      return row.questions;
    case 'types':
      return <TypeChips value={row.types} />;
    case 'presentation':
      return <TypeChips value={row.presentation} />;
    case 'updated':
      return row.updated;
    case 'usedIn':
      return (
        <>
          {row.usedIn} {usedNoun}
        </>
      );
    case 'status':
      return <FlowStatusPill status={row.status} />;
  }
}

function compareBanks(a: Bank, b: Bank, key: SortKey) {
  const left = a[key];
  const right = b[key];
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true });
}

function TypeChips({ value }: { value: string }) {
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((part) => (
        <Badge key={part} variant="outline" className="font-normal">
          {part}
        </Badge>
      ))}
    </div>
  );
}

export function QuestionBanksPage({ kind }: { kind: ActivityKind }) {
  const { narrow, ref } = useContainerNarrow();
  const navigate = useNavigate();
  const auth = useAuth();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canEdit = canEditKind(membership, kind);
  const isQuiz = kind === 'quiz';
  const banksBase = isQuiz ? '/quizzes/banks' : '/assessments/banks';
  const usedNoun = isQuiz ? 'quizzes' : 'assessments';
  const note = isQuiz
    ? 'Quiz question banks contain MCQs with options A, B, C, and D, and exactly one correct answer.'
    : 'Question banks are reusable across assessments. You can attach a bank to any assessment.';
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkSelectedId, setBulkSelectedId] = useState<string | null>(null);

  const typeOptions = useMemo(
    () => (isQuiz ? uniqueTypes(presentationTypes) : uniqueTypes(questionTypes)),
    [isQuiz],
  );

  const sortColumns: { key: SortKey; label: string }[] = isQuiz
    ? [
        { key: 'name', label: 'Question Bank Name' },
        { key: 'questions', label: 'Number of Questions' },
        { key: 'presentation', label: 'Presentation Types' },
        { key: 'updated', label: 'Last Updated' },
        { key: 'usedIn', label: 'Used In' },
        { key: 'status', label: 'Status' },
      ]
    : [
        { key: 'name', label: 'Question Bank Name' },
        { key: 'description', label: 'Description' },
        { key: 'questions', label: 'Number of Questions' },
        { key: 'types', label: 'Question Types' },
        { key: 'updated', label: 'Last Updated' },
        { key: 'usedIn', label: 'Used In' },
        { key: 'status', label: 'Status' },
      ];

  const recordColumns: RecordColumn<Bank>[] = sortColumns.map((column) => ({
    key: column.key,
    label: column.label,
    placement: bankPlacement(column.key),
    tableClassName: column.key === 'questions' ? 'tabular-nums' : undefined,
    render: (row) => renderBankCell(column.key, row, usedNoun),
  }));

  const orgId = useOrgId();
  const { data, isPending: loading } = useQuery({
    queryKey: adminQueryKeys.banks(orgId, kind),
    queryFn: () => getQuestionBanks(kind),
    enabled: Boolean(orgId),
  });
  const banks = data ?? EMPTY_BANKS;
  const [search, setSearch] = useState('');
  const [type, setType] = useState('All');
  const [status, setStatus] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const bulkBanks = useMemo(() => {
    const q = bulkSearch.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter(
      (bank) =>
        bank.name.toLowerCase().includes(q) ||
        (!isQuiz && bank.description.toLowerCase().includes(q)),
    );
  }, [banks, bulkSearch, isQuiz]);

  function openBulkUpload() {
    setBulkSearch('');
    setBulkSelectedId(null);
    setBulkOpen(true);
  }

  function confirmBulkUpload() {
    if (!bulkSelectedId) return;
    setBulkOpen(false);
    void navigate(`${banksBase}/${bulkSelectedId}/edit?import=1`);
  }

  const metrics = useMemo(() => {
    const total = banks.length;
    const active = banks.filter((bank) => bank.status === 'Active').length;
    const draft = banks.filter((bank) => bank.status === 'Draft').length;
    const questions = banks.reduce((sum, bank) => sum + bank.questions, 0);
    return [
      {
        label: 'Total Question Banks',
        value: String(total),
        icon: FolderOpenIcon,
        tone: 'bg-chart-2/15 text-chart-2',
      },
      {
        label: 'Active',
        value: String(active),
        icon: CheckCircle2Icon,
        tone: 'bg-success/15 text-success',
      },
      {
        label: 'Draft',
        value: String(draft),
        icon: CircleDashedIcon,
        tone: 'bg-warning/15 text-warning',
      },
      {
        label: 'Total Questions',
        value: questions.toLocaleString(),
        icon: LayersIcon,
        tone: 'bg-chart-3/15 text-chart-3',
      },
    ] as const;
  }, [banks]);

  const filters: ToolbarFilter[] = [
    {
      name: 'Type',
      options: ['All', ...typeOptions],
      value: type,
      onValueChange: (value) => {
        setType(value);
        setPage(1);
      },
    },
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
    let next = banks.filter((bank) => {
      if (status !== 'All' && bank.status !== status) return false;
      if (type !== 'All') {
        const haystack = isQuiz ? bank.presentation : bank.types;
        if (
          !haystack
            .split(',')
            .map((part) => part.trim())
            .includes(type)
        )
          return false;
      }
      if (!query) return true;
      return (
        bank.name.toLowerCase().includes(query) ||
        (!isQuiz && bank.description.toLowerCase().includes(query))
      );
    });

    if (sortKey) {
      next = [...next].sort((a, b) => {
        const result = compareBanks(a, b, sortKey);
        return sortDir === 'asc' ? result : -result;
      });
    }

    return next;
  }, [banks, search, type, status, sortKey, sortDir, isQuiz]);

  const size = Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * size;
  const pageRows = filtered.slice(start, start + size);
  const end = filtered.length === 0 ? 0 : Math.min(start + size, filtered.length);

  const pageIds = pageRows.map((row) => row.id);
  const records = useRecordSelection(
    orgId,
    `banks-${kind}`,
    'question banks',
    pageIds,
    filtered.map((row) => row.id),
  );

  function clearFilters() {
    setSearch('');
    setType('All');
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

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {canEdit ? (
          <PageHeaderActions>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={openBulkUpload}
            >
              <UploadIcon data-icon="inline-start" />
              Bulk Upload
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link to={`${banksBase}/new`}>
                <PlusIcon data-icon="inline-start" />
                Create Question Bank
              </Link>
            </Button>
          </PageHeaderActions>
        ) : null}
        <Alert>
          <InfoIcon />
          <AlertTitle className="sr-only">Note</AlertTitle>
          <AlertDescription>{note}</AlertDescription>
        </Alert>
        <ListPageSkeleton columns={7} />
      </div>
    );
  }

  return (
    <div ref={ref} className="flex flex-col gap-4">
      {canEdit ? (
        <PageHeaderActions>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={openBulkUpload}
          >
            <UploadIcon data-icon="inline-start" />
            Bulk Upload
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link to={`${banksBase}/new`}>
              <PlusIcon data-icon="inline-start" />
              Create Question Bank
            </Link>
          </Button>
        </PageHeaderActions>
      ) : null}

      <Alert>
        <InfoIcon />
        <AlertTitle className="sr-only">Note</AlertTitle>
        <AlertDescription>{note}</AlertDescription>
      </Alert>

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
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Toolbar
        filters={filters}
        searchPlaceholder="Search question banks..."
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
            caption={isQuiz ? 'Quiz question banks' : 'Assessment question banks'}
            rows={pageRows}
            getRowId={(row) => row.id}
            columns={recordColumns}
            narrow={narrow}
            empty="No question banks match the current filters."
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
                  to: isQuiz ? `/quizzes/banks/${row.id}` : `/assessments/banks/${row.id}`,
                }}
                edit={
                  canEdit
                    ? {
                        to: isQuiz
                          ? `/quizzes/banks/${row.id}/edit`
                          : `/assessments/banks/${row.id}/edit`,
                      }
                    : undefined
                }
              />
            )}
            onRowOpen={(row) =>
              navigate(isQuiz ? `/quizzes/banks/${row.id}` : `/assessments/banks/${row.id}`)
            }
          />

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : start + 1} to {end} of {filtered.length} question
              banks
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

      <Dialog
        open={bulkOpen}
        onOpenChange={(open) => {
          setBulkOpen(open);
          if (!open) {
            setBulkSearch('');
            setBulkSelectedId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Bulk upload questions</DialogTitle>
            <DialogDescription>
              Choose a question bank to import into. You will pick the CSV or Excel file on the next
              screen.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Search banks"
              value={bulkSearch}
              onChange={(e) => setBulkSearch(e.target.value)}
              aria-label="Search banks"
            />
            {bulkBanks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No banks yet.{' '}
                <Link
                  to={`${banksBase}/new`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Create a bank first
                </Link>
                , then use Bulk Upload.
              </p>
            ) : (
              <ul className="max-h-64 overflow-y-auto rounded-lg border border-border">
                {bulkBanks.map((bank) => {
                  const selectedBank = bulkSelectedId === bank.id;
                  return (
                    <li key={bank.id}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent',
                          selectedBank && 'bg-accent text-accent-foreground',
                        )}
                        onClick={() => setBulkSelectedId(bank.id)}
                      >
                        <span className="font-medium">{bank.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {bank.questions} question{bank.questions === 1 ? '' : 's'} · {bank.status}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button asChild type="button" variant="ghost" className="w-full sm:w-auto">
              <Link to={`${banksBase}/new`}>Create bank first</Link>
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={!bulkSelectedId}
              onClick={confirmBulkUpload}
            >
              Continue to import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useAsyncService } from '@/hooks/use-async-service';
import {
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  FolderOpenIcon,
  InfoIcon,
  LayersIcon,
  MoreVerticalIcon,
  PlusIcon,
  RotateCcwIcon,
  UploadIcon,
} from 'lucide-react';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { SortHeader } from '@/components/sort-header';
import { FlowStatusPill } from '@/components/status-pill';
import { Toolbar, type ToolbarFilter } from '@/components/toolbar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { getQuestionBanks, type ActivityKind } from '@/services';
import { presentationTypes, questionTypes } from '@/services/fixtures';
import type { QuestionBank as Bank } from '@/services/types';

const EMPTY_BANKS: Bank[] = [];

type SortKey =
  'name' | 'description' | 'questions' | 'types' | 'presentation' | 'updated' | 'usedIn' | 'status';

function uniqueTypes(values: string[]) {
  return [...new Set(values.flatMap((value) => value.split(',').map((part) => part.trim())))];
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
  const auth = useAuth();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canEdit = canEditKind(membership, kind);
  const isQuiz = kind === 'quiz';
  const usedNoun = isQuiz ? 'quizzes' : 'assessments';
  const note = isQuiz
    ? 'Quiz question banks contain MCQs with options A, B, C, and D, and exactly one correct answer.'
    : 'Question banks are reusable across assessments. You can attach a bank to any assessment.';

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

  const { data, loading } = useAsyncService(() => getQuestionBanks(kind), [kind]);
  const banks = data ?? EMPTY_BANKS;
  const [search, setSearch] = useState('');
  const [type, setType] = useState('All');
  const [status, setStatus] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

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
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));
  const colSpan = isQuiz ? 8 : 9;

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
        {canEdit ? (
          <PageHeaderActions>
            <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
              <UploadIcon data-icon="inline-start" />
              Bulk Upload
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link to={isQuiz ? '/quizzes/banks/new' : '/assessments/banks/new'}>
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
    <div className="flex flex-col gap-4">
      {canEdit ? (
        <PageHeaderActions>
          <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
            <UploadIcon data-icon="inline-start" />
            Bulk Upload
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link to={isQuiz ? '/quizzes/banks/new' : '/assessments/banks/new'}>
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
            <TableCaption className="sr-only">
              {isQuiz ? 'Quiz question banks' : 'Assessment question banks'}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                    onCheckedChange={(checked) => toggleAllPage(checked === true)}
                    aria-label="Select all question banks on this page"
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
                  <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
                    No question banks match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => (
                  <TableRow key={row.id} data-state={selected.has(row.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={(checked) => toggleOne(row.id, checked === true)}
                        aria-label={`Select ${row.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{row.name}</span>
                    </TableCell>
                    {isQuiz ? null : <TableCell>{row.description}</TableCell>}
                    <TableCell className="tabular-nums">{row.questions}</TableCell>
                    <TableCell>
                      <TypeChips value={isQuiz ? row.presentation : row.types} />
                    </TableCell>
                    <TableCell>{row.updated}</TableCell>
                    <TableCell>
                      {row.usedIn} {usedNoun}
                    </TableCell>
                    <TableCell>
                      <FlowStatusPill status={row.status} />
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
                                isQuiz ? `/quizzes/banks/${row.id}` : `/assessments/banks/${row.id}`
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
                                    ? `/quizzes/banks/${row.id}/edit`
                                    : `/assessments/banks/${row.id}/edit`
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
              Showing {filtered.length === 0 ? 0 : start + 1} to {end} of {filtered.length} question
              banks
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

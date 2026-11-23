import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeftIcon, ChevronRightIcon, CopyIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { GiveQuizDialog } from '@/components/give-quiz-dialog';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { RecordSortSelect } from '@/components/record-sort-select';
import { ResponsiveRecords, type RecordColumn } from '@/components/responsive-records';
import { RowActions } from '@/components/row-actions';
import { confirmSensitiveDelete, useConfirm } from '@/components/use-confirm';
import { Toolbar, type ToolbarFilter } from '@/components/toolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/auth-context';
import { PageHeaderActions } from '@/contexts/page-header';
import { useContainerNarrow } from '@/hooks/use-container-narrow';
import { useOrgId } from '@/hooks/use-org-id';
import { canMutateOrg } from '@/lib/access';
import { ApiError } from '@/lib/api-client';
import { registrationUrl, type ContestFormRecord } from '@/lib/contest-form';
import { selectionMatches } from '@/lib/multi-select';
import { deleteContestForm, getContestFormOverview } from '@/services/contest-forms';

type FormSortKey =
  | 'contestName'
  | 'sponsorName'
  | 'status'
  | 'quizCount'
  | 'assessmentCount'
  | 'registrationCount'
  | 'link';

type FormRow = ContestFormRecord & {
  quizCount: number;
  assessmentCount: number;
  link: string;
};

function toFormRow(form: ContestFormRecord): FormRow {
  const quizzes = form.quizzes.filter((item) => item.kind !== 'assessment');
  const assessments = form.quizzes.filter((item) => item.kind === 'assessment');
  return {
    ...form,
    quizCount: quizzes.length,
    assessmentCount: assessments.length,
    link: form.slug ? registrationUrl(form.slug) : '',
  };
}

function namedFilterOptions(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter((name) => name.length > 0))].sort(
    (a, b) => a.localeCompare(b),
  );
}

function compareForms(a: FormRow, b: FormRow, key: FormSortKey) {
  const left = a[key];
  const right = b[key];
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true });
}

export function ParticipantsPage() {
  const auth = useAuth();
  const orgId = useOrgId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { narrow, ref } = useContainerNarrow();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canMutate = canMutateOrg(membership);
  const isSuperAdmin = membership?.role === 'super_admin';
  const [giveForm, setGiveForm] = useState<ContestFormRecord | null>(null);
  const [highlight, setHighlight] = useState('');
  const [search, setSearch] = useState('');
  const [sponsor, setSponsor] = useState<string[]>([]);
  const [contest, setContest] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<FormSortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'contest-forms', orgId],
    queryFn: ({ signal }) => getContestFormOverview(signal),
    enabled: Boolean(orgId),
  });

  useEffect(() => {
    const id = sessionStorage.getItem('bp-new-form');
    if (!id) return;
    setHighlight(id);
    sessionStorage.removeItem('bp-new-form');
    const timer = window.setTimeout(() => setHighlight(''), 1600);
    return () => window.clearTimeout(timer);
  }, [data]);

  const forms = useMemo(() => (data?.forms ?? []).map(toFormRow), [data]);
  const kpis = data?.kpis;

  const sponsorOptions = useMemo(
    () => namedFilterOptions(forms.map((form) => form.sponsorName)),
    [forms],
  );
  const contestOptions = useMemo(
    () => namedFilterOptions(forms.map((form) => form.contestName)),
    [forms],
  );

  const formColumns: RecordColumn<FormRow>[] = useMemo(
    () => [
      {
        key: 'contestName',
        label: 'Contest',
        placement: 'title',
        render: (form) => (
          <span className={`font-medium ${highlight === form.id ? 'text-primary' : ''}`}>
            {form.contestName || 'Draft form'}
          </span>
        ),
      },
      {
        key: 'sponsorName',
        label: 'Sponsor',
        placement: 'primary',
        render: (form) => form.sponsorName || '—',
      },
      {
        key: 'status',
        label: 'Status',
        placement: 'status',
        render: (form) => (form.status === 'saved' ? 'Saved' : 'Draft'),
      },
      {
        key: 'quizCount',
        label: 'Quizzes',
        placement: 'details',
        tableClassName: 'tabular-nums',
        render: (form) => <span className="tabular-nums">{form.quizCount}</span>,
      },
      {
        key: 'assessmentCount',
        label: 'Assessments',
        placement: 'details',
        tableClassName: 'tabular-nums',
        render: (form) => <span className="tabular-nums">{form.assessmentCount}</span>,
      },
      {
        key: 'registrationCount',
        label: 'Registered',
        placement: 'details',
        tableClassName: 'tabular-nums',
        render: (form) => <span className="tabular-nums">{form.registrationCount}</span>,
      },
      {
        key: 'link',
        label: 'Link',
        placement: 'details',
        render: (form) =>
          form.link ? (
            <span className="truncate text-primary" title={form.link}>
              {form.link}
            </span>
          ) : (
            <span className="text-muted-foreground">Not live yet</span>
          ),
      },
    ],
    [highlight],
  );

  const filters: ToolbarFilter[] = [
    {
      name: 'Sponsor',
      options: sponsorOptions,
      values: sponsor,
      onValuesChange: (values) => {
        setSponsor(values);
        setPage(1);
      },
    },
    {
      name: 'Contest',
      options: contestOptions,
      values: contest,
      onValuesChange: (values) => {
        setContest(values);
        setPage(1);
      },
    },
  ];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let rows = forms.filter((form) => {
      if (!selectionMatches(sponsor, form.sponsorName)) return false;
      if (!selectionMatches(contest, form.contestName)) return false;
      if (!query) return true;
      return (
        form.contestName.toLowerCase().includes(query) ||
        form.sponsorName.toLowerCase().includes(query) ||
        form.link.toLowerCase().includes(query)
      );
    });
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const result = compareForms(a, b, sortKey);
        return sortDir === 'asc' ? result : -result;
      });
    }
    return rows;
  }, [forms, search, sponsor, contest, sortKey, sortDir]);

  const size = Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * size;
  const pageRows = filtered.slice(start, start + size);
  const end = filtered.length === 0 ? 0 : Math.min(start + size, filtered.length);

  function clearFilters() {
    setSearch('');
    setSponsor([]);
    setContest([]);
    setPage(1);
  }

  function toggleSort(key: FormSortKey) {
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

  async function onDeleteForm(form: ContestFormRecord) {
    if (!isSuperAdmin) return;
    const name = form.contestName || 'this registration form';
    const password = await confirmSensitiveDelete(confirm, {
      title: `Delete the registration form for “${name}”?`,
      description:
        'Permanently removes this form and everyone who registered through it. This cannot be undone.',
      details: [
        'The public registration link stops working.',
        'Those people are removed from every contest, quiz, and assessment, even if they also joined another contest.',
        'Their registrations, attempts, and reports are deleted.',
        'The quizzes and assessments themselves stay.',
      ],
      confirmLabel: 'Delete form',
    });
    if (!password) return;
    try {
      await deleteContestForm(form.id, password);
      toast.success('Registration form deleted.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'contest-forms'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'registrations'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'results'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'participants'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete registration form.');
    }
  }

  if (isPending) return <ListPageSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      <PageHeaderActions>
        {canMutate ? (
          <Button type="button" onClick={() => navigate('/participants/forms/new')}>
            <PlusIcon data-icon="inline-start" />
            Create registration form
          </Button>
        ) : null}
      </PageHeaderActions>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Registration forms" value={kpis?.forms ?? 0} />
        <Kpi label="Live links" value={kpis?.liveLinks ?? 0} />
        <Kpi label="Participants" value={kpis?.participants ?? 0} />
        <Kpi label="Forms with no activity yet" value={kpis?.formsWithoutActivity ?? 0} />
      </div>
      <div ref={ref} className="flex flex-col gap-4">
        <Toolbar
          filters={filters}
          searchPlaceholder="Search by contest, sponsor, or link..."
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          actions={
            <>
              {narrow ? (
                <RecordSortSelect
                  columns={formColumns}
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={(key) => toggleSort(key as FormSortKey)}
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
          <CardHeader>
            <CardTitle>
              {filtered.length} {filtered.length === 1 ? 'registration form' : 'registration forms'}
            </CardTitle>
            <CardDescription>
              One form per contest. Copy the live link, or open the form to see who registered.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ResponsiveRecords
              caption="Registration forms"
              rows={pageRows}
              getRowId={(form) => form.id}
              columns={formColumns}
              narrow={narrow}
              empty="No registration forms match the current filters."
              sort={{
                key: sortKey,
                direction: sortDir,
                onSort: (key) => toggleSort(key as FormSortKey),
              }}
              renderActions={(form) => (
                <div className="flex flex-wrap items-center gap-2">
                  {form.link ? (
                    narrow ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          void navigator.clipboard.writeText(form.link);
                          toast.success('Link copied');
                        }}
                      >
                        <CopyIcon data-icon="inline-start" aria-hidden="true" />
                        Copy link
                      </Button>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Copy link"
                            onClick={() => {
                              void navigator.clipboard.writeText(form.link);
                              toast.success('Link copied');
                            }}
                          >
                            <CopyIcon aria-hidden="true" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy link</TooltipContent>
                      </Tooltip>
                    )
                  ) : null}
                  <RowActions
                    view={{ to: `/participants/forms/${form.id}` }}
                    edit={canMutate ? { to: `/participants/forms/${form.id}/edit` } : undefined}
                    remove={
                      isSuperAdmin
                        ? { label: 'Delete', onClick: () => void onDeleteForm(form) }
                        : undefined
                    }
                    iconsOnly={!narrow}
                  />
                  {canMutate &&
                  form.quizCount + form.assessmentCount === 0 &&
                  form.status === 'saved' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size={narrow ? 'default' : 'icon'}
                      aria-label="Assign activity"
                      onClick={() => setGiveForm(form)}
                    >
                      <PlusIcon data-icon={narrow ? 'inline-start' : undefined} />
                      {narrow ? 'Assign activity' : null}
                    </Button>
                  ) : null}
                </div>
              )}
              onRowOpen={(form) => navigate(`/participants/forms/${form.id}`)}
            />
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filtered.length === 0 ? 0 : start + 1} to {end} of {filtered.length} forms
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
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
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
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  >
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <GiveQuizDialog
        form={giveForm}
        open={Boolean(giveForm)}
        onOpenChange={(open) => {
          if (!open) setGiveForm(null);
        }}
        onGiven={() => {
          void queryClient.invalidateQueries({ queryKey: ['admin', 'contest-forms'] });
        }}
      />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

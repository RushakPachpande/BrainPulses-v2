import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from 'lucide-react';
import { toast } from 'sonner';
import { GiveQuizDialog } from '@/components/give-quiz-dialog';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { RecordSortSelect } from '@/components/record-sort-select';
import { ResponsiveRecords, type RecordColumn } from '@/components/responsive-records';
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
import { useAuth } from '@/contexts/auth-context';
import { PageHeaderActions } from '@/contexts/page-header';
import { useContainerNarrow } from '@/hooks/use-container-narrow';
import { useOrgId } from '@/hooks/use-org-id';
import { canMutateOrg } from '@/lib/access';
import { ApiError } from '@/lib/api-client';
import { formatIst, registrationUrl, type ContestFormRecord } from '@/lib/contest-form';
import { selectionMatches } from '@/lib/multi-select';
import { deleteContestForm, getContestFormOverview } from '@/services/contest-forms';

type ContestPerson = {
  id: string;
  code: string;
  name: string;
  email: string;
  sponsorName: string;
  contestName: string;
  quizzesGiven: number;
  registeredAt: string;
};

type SortKey = keyof Pick<
  ContestPerson,
  'code' | 'name' | 'email' | 'sponsorName' | 'contestName' | 'quizzesGiven' | 'registeredAt'
>;

const personColumns: RecordColumn<ContestPerson>[] = [
  {
    key: 'code',
    label: 'Registration ID',
    placement: 'identity',
    identityPrefix: 'ID: ',
    tableClassName: 'tabular-nums',
    render: (person) => <span className="tabular-nums">{person.code}</span>,
  },
  {
    key: 'name',
    label: 'Name',
    placement: 'title',
    render: (person) => <span className="font-medium">{person.name}</span>,
  },
  {
    key: 'email',
    label: 'Email',
    placement: 'primary',
    render: (person) => person.email,
  },
  {
    key: 'sponsorName',
    label: 'Sponsor',
    placement: 'details',
    render: (person) => person.sponsorName,
  },
  {
    key: 'contestName',
    label: 'Contest',
    placement: 'details',
    render: (person) => person.contestName,
  },
  {
    key: 'quizzesGiven',
    label: 'Quizzes given',
    placement: 'details',
    tableClassName: 'tabular-nums',
    render: (person) => <span className="tabular-nums">{person.quizzesGiven}</span>,
  },
  {
    key: 'registeredAt',
    label: 'Registered',
    placement: 'details',
    render: (person) => formatIst(person.registeredAt),
  },
];

function namedFilterOptions(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter((name) => name.length > 0))].sort(
    (a, b) => a.localeCompare(b),
  );
}

function comparePeople(a: ContestPerson, b: ContestPerson, key: SortKey) {
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
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
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

  const forms = useMemo(() => data?.forms ?? [], [data]);
  const people = useMemo(() => data?.people ?? [], [data]);
  const kpis = data?.kpis;

  const sponsorOptions = useMemo(
    () => namedFilterOptions(people.map((person) => person.sponsorName)),
    [people],
  );
  const contestOptions = useMemo(
    () => namedFilterOptions(people.map((person) => person.contestName)),
    [people],
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
    let rows = people.filter((person) => {
      if (!selectionMatches(sponsor, person.sponsorName)) return false;
      if (!selectionMatches(contest, person.contestName)) return false;
      if (!query) return true;
      return (
        person.name.toLowerCase().includes(query) ||
        person.email.toLowerCase().includes(query) ||
        person.code.toLowerCase().includes(query)
      );
    });
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const result = comparePeople(a, b, sortKey);
        return sortDir === 'asc' ? result : -result;
      });
    }
    return rows;
  }, [people, search, sponsor, contest, sortKey, sortDir]);

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
        <Kpi label="Forms with no quiz yet" value={kpis?.formsWithoutQuiz ?? 0} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Registration forms</CardTitle>
          <CardDescription>
            One form per contest. Copy the live link, or edit the form.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {forms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No registration forms yet.</p>
          ) : (
            forms.map((form) => {
              const link = form.slug ? registrationUrl(form.slug) : '';
              const quizNames = form.quizzes.map((quiz) => quiz.name).join(', ');
              return (
                <article
                  key={form.id}
                  className={`flex flex-col gap-3 rounded-lg border border-border p-3 sm:p-4 ${highlight === form.id ? 'bg-accent' : ''}`}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Contest</p>
                      <p className="truncate font-medium">{form.contestName || 'Draft form'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Sponsor</p>
                      <p className="truncate">{form.sponsorName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p>{form.status === 'saved' ? 'Saved' : 'Draft'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Quizzes</p>
                      {form.quizzes.length === 0 ? (
                        <p className="text-warning">No quiz yet</p>
                      ) : (
                        <p className="truncate" title={quizNames}>
                          {form.quizzes.length} {form.quizzes.length === 1 ? 'quiz' : 'quizzes'}
                          <span className="text-muted-foreground"> · {quizNames}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  {link ? (
                    <p className="truncate text-sm text-primary" title={link}>
                      {link}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not live yet</p>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {link ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          void navigator.clipboard.writeText(link);
                          toast.success('Link copied');
                        }}
                      >
                        <CopyIcon data-icon="inline-start" aria-hidden="true" />
                        Copy link
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => navigate(`/participants/forms/${form.id}`)}
                    >
                      Open
                    </Button>
                    {canMutate ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => navigate(`/participants/forms/${form.id}/edit`)}
                      >
                        <PencilIcon data-icon="inline-start" aria-hidden="true" />
                        Edit
                      </Button>
                    ) : null}
                    {canMutate && form.quizzes.length === 0 && form.status === 'saved' ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => setGiveForm(form)}
                      >
                        Assign activity
                      </Button>
                    ) : null}
                    {isSuperAdmin ? (
                      <Button
                        type="button"
                        variant="destructive"
                        className="w-full sm:w-auto"
                        onClick={() => void onDeleteForm(form)}
                      >
                        <Trash2Icon data-icon="inline-start" aria-hidden="true" />
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </CardContent>
      </Card>
      <div ref={ref} className="flex flex-col gap-4">
        <Toolbar
          filters={filters}
          searchPlaceholder="Search by name, email, or registration ID..."
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          actions={
            <>
              {narrow ? (
                <RecordSortSelect
                  columns={personColumns}
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
          <CardHeader>
            <CardTitle>
              {filtered.length} {filtered.length === 1 ? 'participant' : 'participants'}
            </CardTitle>
            <CardDescription>Registered participants</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ResponsiveRecords
              caption="Registered participants"
              rows={pageRows}
              getRowId={(person) => person.id}
              columns={personColumns}
              narrow={narrow}
              empty="No one has registered through a form yet."
              sort={{
                key: sortKey,
                direction: sortDir,
                onSort: (key) => toggleSort(key as SortKey),
              }}
            />
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filtered.length === 0 ? 0 : start + 1} to {end} of {filtered.length}{' '}
                participants
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

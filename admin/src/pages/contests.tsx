import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2Icon, CalendarDaysIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { ListPager, MediaCard, MediaCardGrid } from '@/components/media-card-grid';
import { RecordSortSelect } from '@/components/record-sort-select';
import { Toolbar } from '@/components/toolbar';
import { confirmSensitiveDelete, useConfirm } from '@/components/use-confirm';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { PageHeaderActions } from '@/contexts/page-header';
import { useOrgId } from '@/hooks/use-org-id';
import { canManageUsersOrSettings, canMutateOrg } from '@/lib/access';
import { ApiError } from '@/lib/api-client';
import { adminQueryKeys } from '@/lib/query-keys';
import { ContestEditorDialog } from '@/pages/contest-editor-dialog';
import { ContestViewDialog } from '@/pages/contest-view-dialog';
import { deleteContest, getContest, getContests, type Contest } from '@/services';

const EMPTY: Contest[] = [];

const PAGE_SIZES = ['12', '24', '48'];

type SortKey = 'name' | 'sponsorName';

const contestSortColumns: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Contest Name' },
  { key: 'sponsorName', label: 'Sponsor' },
];

function compare(a: Contest, b: Contest, key: SortKey) {
  return a[key].localeCompare(b[key], undefined, { numeric: true });
}

function contestDeleteCopy(contest: Contest) {
  const form = contest.registrationForm;
  if (!form) {
    return {
      description: 'Permanently removes this contest. This cannot be undone.',
      details: undefined,
    };
  }
  const statusLabel = form.status === 'saved' ? 'saved' : 'draft';
  const details = [
    `The ${statusLabel} registration form for this contest will be deleted, including its public link.`,
  ];
  if (form.submissionCount > 0) {
    details.push(
      `${form.submissionCount} registration submission${form.submissionCount === 1 ? '' : 's'} will be deleted. Participant records stay.`,
    );
  }
  if (form.quizCount > 0) {
    details.push(
      `${form.quizCount} quiz link${form.quizCount === 1 ? '' : 's'} on that form will be removed. The quizzes themselves stay.`,
    );
  }
  return {
    description:
      'Permanently removes this contest and the registration form that belongs to it. This cannot be undone.',
    details,
  };
}

export function ContestsPage() {
  const auth = useAuth();
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canMutate = canMutateOrg(membership);
  const canDelete = canManageUsersOrSettings(membership);
  const [searchParams, setSearchParams] = useSearchParams();
  const [editor, setEditor] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const { data, isPending: loading } = useQuery({
    queryKey: adminQueryKeys.contests(orgId),
    queryFn: () => getContests(),
    enabled: Boolean(orgId),
  });
  const contests = data ?? EMPTY;

  async function onDeleteContest(contest: Contest) {
    if (!canDelete || contest.activityCount > 0) return;
    let current: Contest;
    try {
      current = await getContest(contest.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load this contest.');
      return;
    }
    if (current.activityCount > 0) {
      toast.error(
        `Cannot delete this contest while ${current.activityCount} activit${current.activityCount === 1 ? 'y' : 'ies'} still use it. Remove those links first.`,
      );
      await queryClient.invalidateQueries({ queryKey: ['admin', 'contests'] });
      return;
    }
    const copy = contestDeleteCopy(current);
    const password = await confirmSensitiveDelete(confirm, {
      title: `Delete “${current.name}”?`,
      description: copy.description,
      details: copy.details,
      confirmLabel: 'Delete permanently',
    });
    if (!password) return;
    try {
      await deleteContest(current.id, password);
      toast.success('Contest deleted.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'contests'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'contest-forms'] });
      if (viewId === current.id) setViewId(null);
      if (editor === current.id) setEditor(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete contest.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'contests'] });
    }
  }
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  useEffect(() => {
    const view = searchParams.get('view');
    const edit = searchParams.get('edit');
    const create = searchParams.get('create') === '1';
    if (!view && !edit && !create) return;
    if (view && loading) return;
    if (view) {
      if (contests.some((contest) => contest.id === view)) setViewId(view);
      else toast.error('Could not load contest.');
    }
    if (canMutate && create) setEditor('create');
    if (canMutate && edit) setEditor(edit);
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    next.delete('edit');
    next.delete('create');
    setSearchParams(next, { replace: true });
  }, [canMutate, contests, loading, searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let rows = contests.filter(
      (row) =>
        !query ||
        row.name.toLowerCase().includes(query) ||
        row.sponsorName.toLowerCase().includes(query),
    );
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const result = compare(a, b, sortKey);
        return sortDir === 'asc' ? result : -result;
      });
    }
    return rows;
  }, [contests, search, sortKey, sortDir]);

  const size = Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * size;
  const pageRows = filtered.slice(start, start + size);
  const end = filtered.length === 0 ? 0 : Math.min(start + size, filtered.length);

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

  const viewing = viewId ? contests.find((contest) => contest.id === viewId) : undefined;
  const viewDialog = viewing ? (
    <ContestViewDialog
      contest={viewing}
      canEdit={canMutate}
      onOpenChange={(open) => {
        if (!open) setViewId(null);
      }}
      onEdit={
        canMutate
          ? () => {
              setViewId(null);
              setEditor(viewing.id);
            }
          : undefined
      }
    />
  ) : null;

  const editorDialog =
    editor !== null ? (
      <ContestEditorDialog
        mode={editor === 'create' ? 'create' : 'edit'}
        contestId={editor === 'create' ? undefined : editor}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      />
    ) : null;

  const headerActions = canMutate ? (
    <PageHeaderActions>
      <Button type="button" className="w-full sm:w-auto" onClick={() => setEditor('create')}>
        <PlusIcon data-icon="inline-start" />
        Add Contest
      </Button>
    </PageHeaderActions>
  ) : null;

  if (loading) {
    return (
      <>
        <div className="flex flex-col gap-4">
          {headerActions}
          <ListPageSkeleton layout="cards" kpiCount={0} />
        </div>
        {viewDialog}
        {editorDialog}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {headerActions}

        <Toolbar
          filters={[]}
          searchPlaceholder="Search by contest or sponsor"
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          actions={
            <>
              <RecordSortSelect
                columns={contestSortColumns}
                activeKey={sortKey}
                direction={sortDir}
                onSort={(key) => toggleSort(key as SortKey)}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full sm:ml-auto sm:w-auto"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
              >
                <RotateCcwIcon data-icon="inline-start" />
                Clear Filters
              </Button>
            </>
          }
        />

        <MediaCardGrid
          label="Contests"
          items={pageRows}
          getKey={(contest) => contest.id}
          empty={search.trim() ? 'No contests match this search.' : 'No contests yet.'}
          renderItem={(contest) => (
            <MediaCard
              kind="contest"
              onView={() => setViewId(contest.id)}
              onEdit={canMutate ? () => setEditor(contest.id) : undefined}
              onDelete={
                canDelete && contest.activityCount === 0
                  ? () => void onDeleteContest(contest)
                  : undefined
              }
              title={contest.name}
              imageFileId={contest.imageFileId}
              organizer={{ name: contest.sponsorName }}
              description={contest.description}
              meta={[
                {
                  icon: <Building2Icon aria-hidden />,
                  label: contest.sponsorName,
                },
              ]}
              footerLabel={
                <>
                  <CalendarDaysIcon size={14} aria-hidden />
                  <span>Sponsor: {contest.sponsorName}</span>
                </>
              }
            />
          )}
        />

        <ListPager
          noun="contests"
          total={filtered.length}
          start={start}
          end={end}
          page={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZES}
          pageSizeLabel="Cards per page"
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
        />
      </div>
      {viewDialog}
      {editorDialog}
    </>
  );
}

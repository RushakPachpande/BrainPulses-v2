import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2Icon, CalendarDaysIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { ListPager, MediaCard, MediaCardGrid } from '@/components/media-card-grid';
import { RecordSortSelect } from '@/components/record-sort-select';
import { Toolbar } from '@/components/toolbar';
import { useConfirm } from '@/components/use-confirm';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { PageHeaderActions } from '@/contexts/page-header';
import { useOrgId } from '@/hooks/use-org-id';
import { canManageUsersOrSettings, canMutateOrg } from '@/lib/access';
import { ApiError } from '@/lib/api-client';
import { adminQueryKeys } from '@/lib/query-keys';
import { ContestEditorDialog } from '@/pages/contest-editor-dialog';
import { ContestViewDialog } from '@/pages/contest-view-dialog';
import { deleteContest, getContests, type Contest } from '@/services';

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
    if (!canDelete) return;
    const password = await confirm({
      title: `Delete “${contest.name}”?`,
      description:
        'Permanently removes this contest. Quizzes that still use it must be unlinked first. This cannot be undone.',
      confirmLabel: 'Delete permanently',
      destructive: true,
      requirePassword: true,
    });
    if (!password) return;
    try {
      await deleteContest(contest.id, password);
      toast.success('Contest deleted.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'contests'] });
      if (viewId === contest.id) setViewId(null);
      if (editor === contest.id) setEditor(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete contest.');
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
          <ListPageSkeleton layout="cards" kpiCount={1} />
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

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Total contests</CardDescription>
              <CardTitle className="text-2xl">{contests.length}</CardTitle>
            </CardHeader>
          </Card>
        </section>

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
              onDelete={canDelete ? () => void onDeleteContest(contest) : undefined}
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

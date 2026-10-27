import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarDaysIcon, PlusIcon, RotateCcwIcon, TrophyIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { ListPager, MediaCard, MediaCardGrid } from '@/components/media-card-grid';
import { RecordSortSelect } from '@/components/record-sort-select';
import { Toolbar } from '@/components/toolbar';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { PageHeaderActions } from '@/contexts/page-header';
import { useOrgId } from '@/hooks/use-org-id';
import { canMutateOrg } from '@/lib/access';
import { adminQueryKeys } from '@/lib/query-keys';
import { SponsorEditorDialog } from '@/pages/sponsor-editor-dialog';
import { SponsorViewDialog } from '@/pages/sponsor-view-dialog';
import { getSponsors, type Sponsor } from '@/services';

const EMPTY: Sponsor[] = [];

const PAGE_SIZES = ['12', '24', '48'];

const sponsorSortColumns = [{ key: 'name', label: 'Sponsor Name' }];

type SortKey = 'name';

function contestCount(count: number) {
  return count === 1 ? '1 contest' : `${count} contests`;
}

export function SponsorsPage() {
  const auth = useAuth();
  const orgId = useOrgId();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canMutate = canMutateOrg(membership);
  const [searchParams, setSearchParams] = useSearchParams();
  const [editor, setEditor] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const { data, isPending: loading } = useQuery({
    queryKey: adminQueryKeys.sponsors(orgId),
    queryFn: () => getSponsors(),
    enabled: Boolean(orgId),
  });
  const sponsors = data ?? EMPTY;
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
      if (sponsors.some((sponsor) => sponsor.id === view)) setViewId(view);
      else toast.error('Could not load sponsor.');
    }
    if (canMutate && create) setEditor('create');
    if (canMutate && edit) setEditor(edit);
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    next.delete('edit');
    next.delete('create');
    setSearchParams(next, { replace: true });
  }, [canMutate, loading, searchParams, setSearchParams, sponsors]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let rows = sponsors.filter((row) => !query || row.name.toLowerCase().includes(query));
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const result = a.name.localeCompare(b.name, undefined, { numeric: true });
        return sortDir === 'asc' ? result : -result;
      });
    }
    return rows;
  }, [sponsors, search, sortKey, sortDir]);

  const size = Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * size;
  const pageRows = filtered.slice(start, start + size);
  const end = filtered.length === 0 ? 0 : Math.min(start + size, filtered.length);

  function toggleSort() {
    if (sortKey !== 'name') {
      setSortKey('name');
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

  const viewing = viewId ? sponsors.find((sponsor) => sponsor.id === viewId) : undefined;
  const viewDialog = viewing ? (
    <SponsorViewDialog
      sponsor={viewing}
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
      <SponsorEditorDialog
        mode={editor === 'create' ? 'create' : 'edit'}
        sponsorId={editor === 'create' ? undefined : editor}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      />
    ) : null;

  const headerActions = canMutate ? (
    <PageHeaderActions>
      <Button type="button" className="w-full sm:w-auto" onClick={() => setEditor('create')}>
        <PlusIcon data-icon="inline-start" />
        Add Sponsor
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
              <CardDescription>Total sponsors</CardDescription>
              <CardTitle className="text-2xl">{sponsors.length}</CardTitle>
            </CardHeader>
          </Card>
        </section>

        <Toolbar
          filters={[]}
          searchPlaceholder="Search by sponsor name"
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          actions={
            <>
              <RecordSortSelect
                columns={sponsorSortColumns}
                activeKey={sortKey}
                direction={sortDir}
                onSort={() => toggleSort()}
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
          label="Sponsors"
          items={pageRows}
          getKey={(sponsor) => sponsor.id}
          empty={search.trim() ? 'No sponsors match this search.' : 'No sponsors yet.'}
          renderItem={(sponsor) => (
            <MediaCard
              kind="sponsor"
              onView={() => setViewId(sponsor.id)}
              onEdit={canMutate ? () => setEditor(sponsor.id) : undefined}
              title={sponsor.name}
              imageFileId={sponsor.imageFileId}
              badge={contestCount(sponsor.contests)}
              meta={[
                {
                  icon: <TrophyIcon aria-hidden />,
                  label: contestCount(sponsor.contests),
                },
              ]}
              footerLabel={
                <>
                  <CalendarDaysIcon size={14} aria-hidden />
                  <span>Catalog partner</span>
                </>
              }
            />
          )}
        />

        <ListPager
          noun="sponsors"
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

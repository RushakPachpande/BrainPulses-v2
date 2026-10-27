import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import { AuthImage } from '@/components/auth-image';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { RecordSortSelect } from '@/components/record-sort-select';
import { ResponsiveRecords, type RecordColumn } from '@/components/responsive-records';
import { RowActions } from '@/components/row-actions';
import { Toolbar } from '@/components/toolbar';
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
import { useRecordSelection } from '@/hooks/use-list-selection';
import { useOrgId } from '@/hooks/use-org-id';
import { canMutateOrg } from '@/lib/access';
import { adminQueryKeys } from '@/lib/query-keys';
import { getSponsors, type Sponsor } from '@/services';

const EMPTY: Sponsor[] = [];

const sponsorColumns: RecordColumn<Sponsor>[] = [
  {
    key: 'image',
    label: 'Image',
    placement: 'media',
    sortable: false,
    render: (sponsor) => <AuthImage fileId={sponsor.imageFileId} alt="" />,
  },
  {
    key: 'name',
    label: 'Sponsor Name',
    placement: 'title',
    tableClassName: 'font-medium',
    render: (sponsor) => sponsor.name,
  },
];

const sponsorSortColumns = sponsorColumns.filter((column) => column.sortable !== false);

type SortKey = 'name';

export function SponsorsPage() {
  const navigate = useNavigate();
  const { narrow, ref } = useContainerNarrow();
  const auth = useAuth();
  const orgId = useOrgId();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canMutate = canMutateOrg(membership);
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
  const [pageSize, setPageSize] = useState('10');

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
  const pageIds = pageRows.map((row) => row.id);
  const records = useRecordSelection(
    orgId,
    'sponsors',
    'sponsors',
    pageIds,
    filtered.map((row) => row.id),
  );

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

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {canMutate ? (
          <PageHeaderActions>
            <Button asChild className="w-full sm:w-auto">
              <Link to="/sponsors/new">
                <PlusIcon data-icon="inline-start" />
                Add Sponsor
              </Link>
            </Button>
          </PageHeaderActions>
        ) : null}
        <ListPageSkeleton columns={3} />
      </div>
    );
  }

  return (
    <div ref={ref} className="flex flex-col gap-4">
      {canMutate ? (
        <PageHeaderActions>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/sponsors/new">
              <PlusIcon data-icon="inline-start" />
              Add Sponsor
            </Link>
          </Button>
        </PageHeaderActions>
      ) : null}

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
            {narrow ? (
              <RecordSortSelect
                columns={sponsorSortColumns}
                activeKey={sortKey}
                direction={sortDir}
                onSort={() => toggleSort()}
              />
            ) : null}
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

      <Card>
        <CardContent className="flex flex-col gap-4">
          <ResponsiveRecords
            caption="Sponsors"
            rows={pageRows}
            getRowId={(sponsor) => sponsor.id}
            columns={sponsorColumns}
            narrow={narrow}
            empty={search.trim() ? 'No sponsors match this search.' : 'No sponsors yet.'}
            sort={{
              key: sortKey,
              direction: sortDir,
              onSort: () => toggleSort(),
            }}
            selection={{
              ...records,
              rowLabel: (sponsor) => `Select ${sponsor.name}`,
            }}
            renderActions={(sponsor) => (
              <RowActions
                view={{ to: `/sponsors/${sponsor.id}` }}
                edit={canMutate ? { to: `/sponsors/${sponsor.id}/edit` } : undefined}
              />
            )}
            onRowOpen={(sponsor) => navigate(`/sponsors/${sponsor.id}`)}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : start + 1} to {end} of {filtered.length} sponsors
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
    </div>
  );
}

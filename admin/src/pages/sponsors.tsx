import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import { AuthImage } from '@/components/auth-image';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { RowActions } from '@/components/row-actions';
import { SortHeader } from '@/components/sort-header';
import { Toolbar } from '@/components/toolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useOrgId } from '@/hooks/use-org-id';
import { canMutateOrg } from '@/lib/access';
import { adminQueryKeys } from '@/lib/query-keys';
import { getSponsors, type Sponsor } from '@/services';

const EMPTY: Sponsor[] = [];

type SortKey = 'name';

export function SponsorsPage() {
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
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
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
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

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
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableCaption className="sr-only">Sponsors</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                    onCheckedChange={(checked) => toggleAllPage(checked === true)}
                    aria-label="Select all sponsors on this page"
                  />
                </TableHead>
                <TableHead scope="col">Image</TableHead>
                <TableHead
                  scope="col"
                  aria-sort={
                    sortKey === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                >
                  <SortHeader
                    label="Sponsor Name"
                    active={sortKey === 'name'}
                    direction={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead scope="col">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    {search.trim() ? 'No sponsors match this search.' : 'No sponsors yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((sponsor) => (
                  <TableRow
                    key={sponsor.id}
                    data-state={selected.has(sponsor.id) ? 'selected' : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(sponsor.id)}
                        onCheckedChange={(checked) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (checked === true) next.add(sponsor.id);
                            else next.delete(sponsor.id);
                            return next;
                          });
                        }}
                        aria-label={`Select ${sponsor.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <AuthImage fileId={sponsor.imageFileId} alt="" />
                    </TableCell>
                    <TableCell className="font-medium">{sponsor.name}</TableCell>
                    <TableCell>
                      <RowActions
                        view={{ to: `/sponsors/${sponsor.id}` }}
                        edit={canMutate ? { to: `/sponsors/${sponsor.id}/edit` } : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : start + 1} to {end} of {filtered.length} sponsors
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

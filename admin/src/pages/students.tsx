import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  RotateCcwIcon,
  UploadIcon,
} from 'lucide-react';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { RecordSortSelect } from '@/components/record-sort-select';
import { ResponsiveRecords, type RecordColumn } from '@/components/responsive-records';
import { RowActions } from '@/components/row-actions';
import { AccountStatusPill } from '@/components/status-pill';
import { Toolbar, type ToolbarFilter } from '@/components/toolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { adminQueryKeys } from '@/lib/query-keys';
import { getStudents, type Student } from '@/services';
import { studentCities, studentCourses } from '@/services/fixtures';

const EMPTY_STUDENTS: Student[] = [];

type SortKey =
  'code' | 'name' | 'email' | 'phone' | 'registered' | 'activities' | 'status' | 'lastLogin';

const studentColumns: RecordColumn<Student>[] = [
  {
    key: 'code',
    label: 'Unique ID',
    placement: 'identity',
    tableClassName: 'tabular-nums',
    render: (student) => student.code,
  },
  {
    key: 'name',
    label: 'Student',
    placement: 'title',
    render: (student) => <span className="font-medium">{student.name}</span>,
  },
  { key: 'email', label: 'Email', placement: 'primary', render: (student) => student.email },
  {
    key: 'phone',
    label: 'Phone',
    placement: 'primary',
    tableClassName: 'tabular-nums',
    render: (student) => student.phone,
  },
  {
    key: 'registered',
    label: 'Registration Date',
    placement: 'details',
    render: (student) => student.registered,
  },
  {
    key: 'activities',
    label: 'Assigned Activities',
    placement: 'details',
    render: (student) => `${student.activities} active`,
  },
  {
    key: 'status',
    label: 'Status',
    placement: 'status',
    render: (student) => <AccountStatusPill value={student.status} />,
  },
  {
    key: 'lastLogin',
    label: 'Last Login',
    placement: 'details',
    render: (student) => student.lastLogin,
  },
];

function compareStudents(a: Student, b: Student, key: SortKey) {
  const left = a[key];
  const right = b[key];
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true });
}

export function StudentsPage() {
  const { narrow, ref } = useContainerNarrow();
  const auth = useAuth();
  const orgId = useOrgId();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canMutate = canMutateOrg(membership);
  const { data, isPending: loading } = useQuery({
    queryKey: adminQueryKeys.students(orgId),
    queryFn: () => getStudents(),
    enabled: Boolean(orgId),
  });
  const students = data ?? EMPTY_STUDENTS;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [course, setCourse] = useState('All');
  const [city, setCity] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const filters: ToolbarFilter[] = [
    {
      name: 'Status',
      options: ['All', 'Active', 'Inactive'],
      value: status,
      onValueChange: (value) => {
        setStatus(value);
        setPage(1);
      },
    },
    {
      name: 'Course',
      options: ['All', ...studentCourses],
      value: course,
      onValueChange: (value) => {
        setCourse(value);
        setPage(1);
      },
    },
    {
      name: 'City',
      options: ['All', ...studentCities],
      value: city,
      onValueChange: (value) => {
        setCity(value);
        setPage(1);
      },
    },
  ];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let rows = students.filter((student) => {
      if (status !== 'All' && student.status !== status) return false;
      if (course !== 'All' && student.course !== course) return false;
      if (city !== 'All' && student.city !== city) return false;
      if (!query) return true;
      return (
        student.code.toLowerCase().includes(query) ||
        student.name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query)
      );
    });

    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const result = compareStudents(a, b, sortKey);
        return sortDir === 'asc' ? result : -result;
      });
    }

    return rows;
  }, [students, search, status, course, city, sortKey, sortDir]);

  const size = Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * size;
  const pageRows = filtered.slice(start, start + size);
  const end = filtered.length === 0 ? 0 : Math.min(start + size, filtered.length);

  const pageIds = pageRows.map((row) => row.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

  function clearFilters() {
    setSearch('');
    setStatus('All');
    setCourse('All');
    setCity('All');
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
        {canMutate ? (
          <PageHeaderActions>
            <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
              <UploadIcon data-icon="inline-start" />
              Upload Students
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link to="/students/new">
                <PlusIcon data-icon="inline-start" />
                Add Student
              </Link>
            </Button>
          </PageHeaderActions>
        ) : null}
        <ListPageSkeleton columns={8} />
      </div>
    );
  }

  return (
    <div ref={ref} className="flex flex-col gap-4">
      {canMutate ? (
        <PageHeaderActions>
          <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
            <UploadIcon data-icon="inline-start" />
            Upload Students
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/students/new">
              <PlusIcon data-icon="inline-start" />
              Add Student
            </Link>
          </Button>
        </PageHeaderActions>
      ) : null}

      <Toolbar
        filters={filters}
        searchPlaceholder="Search by name, email or ID..."
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        actions={
          <>
            {narrow ? (
              <RecordSortSelect
                columns={studentColumns}
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
            caption="Students"
            rows={pageRows}
            getRowId={(student) => student.id}
            columns={studentColumns}
            narrow={narrow}
            empty="No students match the current filters."
            sort={{
              key: sortKey,
              direction: sortDir,
              onSort: (key) => toggleSort(key as SortKey),
            }}
            selection={{
              selected,
              allSelected: allPageSelected,
              someSelected: somePageSelected,
              onToggleAll: toggleAllPage,
              onToggleOne: toggleOne,
              allLabel: 'Select all students on this page',
              rowLabel: (student) => `Select ${student.name}`,
            }}
            renderActions={(student) => (
              <RowActions
                view={{ to: `/students/${student.id}` }}
                edit={canMutate ? { to: `/students/${student.id}/edit` } : undefined}
              />
            )}
          />

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : start + 1} to {end} of {filtered.length} students
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

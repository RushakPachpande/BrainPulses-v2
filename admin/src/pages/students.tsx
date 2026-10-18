import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useAsyncService } from '@/hooks/use-async-service';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreVerticalIcon,
  PlusIcon,
  RotateCcwIcon,
  UploadIcon,
} from 'lucide-react';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { SortHeader } from '@/components/sort-header';
import { AccountStatusPill } from '@/components/status-pill';
import { Toolbar, type ToolbarFilter } from '@/components/toolbar';
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
import { canMutateOrg } from '@/lib/access';
import { getStudents, type Student } from '@/services';
import { studentCities, studentCourses } from '@/services/fixtures';

const EMPTY_STUDENTS: Student[] = [];

type SortKey =
  'code' | 'name' | 'email' | 'phone' | 'registered' | 'activities' | 'status' | 'lastLogin';

const sortColumns: { key: SortKey; label: string }[] = [
  { key: 'code', label: 'Unique ID' },
  { key: 'name', label: 'Student' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'registered', label: 'Registration Date' },
  { key: 'activities', label: 'Assigned Activities' },
  { key: 'status', label: 'Status' },
  { key: 'lastLogin', label: 'Last Login' },
];

function compareStudents(a: Student, b: Student, key: SortKey) {
  const left = a[key];
  const right = b[key];
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true });
}

export function StudentsPage() {
  const auth = useAuth();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canMutate = canMutateOrg(membership);
  const { data, loading } = useAsyncService(() => getStudents(), []);
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

      <Toolbar
        filters={filters}
        searchPlaceholder="Search by name, email or ID..."
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
            <TableCaption className="sr-only">Students</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                    onCheckedChange={(checked) => toggleAllPage(checked === true)}
                    aria-label="Select all students on this page"
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
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    No students match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((student) => (
                  <TableRow
                    key={student.id}
                    data-state={selected.has(student.id) ? 'selected' : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(student.id)}
                        onCheckedChange={(checked) => toggleOne(student.id, checked === true)}
                        aria-label={`Select ${student.name}`}
                      />
                    </TableCell>
                    <TableCell className="tabular-nums">{student.code}</TableCell>
                    <TableCell>
                      <span className="font-medium">{student.name}</span>
                    </TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell className="tabular-nums">{student.phone}</TableCell>
                    <TableCell>{student.registered}</TableCell>
                    <TableCell>{student.activities} active</TableCell>
                    <TableCell>
                      <AccountStatusPill value={student.status} />
                    </TableCell>
                    <TableCell>{student.lastLogin}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${student.name}`}
                          >
                            <MoreVerticalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/students/${student.id}`}>View</Link>
                          </DropdownMenuItem>
                          {canMutate ? (
                            <DropdownMenuItem asChild>
                              <Link to={`/students/${student.id}/edit`}>Edit</Link>
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
              Showing {filtered.length === 0 ? 0 : start + 1} to {end} of {filtered.length} students
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

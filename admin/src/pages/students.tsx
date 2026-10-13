import { useMemo, useState } from 'react';
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreVerticalIcon,
  PlusIcon,
  RotateCcwIcon,
  UploadIcon,
} from 'lucide-react';
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
import { PageHeaderActions } from '@/contexts/page-header';
import { getStudents } from '@/services';
import { studentCities, studentCourses } from '@/services/fixtures';
import { cn } from '@/lib/utils';

type Student = ReturnType<typeof getStudents>[number];

type SortKey =
  'id' | 'name' | 'email' | 'phone' | 'registered' | 'activities' | 'status' | 'lastLogin';

const sortColumns: { key: SortKey; label: string }[] = [
  { key: 'id', label: 'Unique ID' },
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

function SortHeader({
  label,
  active,
  direction,
  onSort,
}: {
  label: string;
  active: boolean;
  direction: 'asc' | 'desc';
  onSort: () => void;
}) {
  const Icon = !active ? ArrowUpDownIcon : direction === 'asc' ? ArrowUpIcon : ArrowDownIcon;
  const nextHint = !active
    ? `Sort by ${label} ascending`
    : direction === 'asc'
      ? `Sort by ${label} descending`
      : `Clear ${label} sort`;
  return (
    <Button
      type="button"
      variant="ghost"
      className="-ml-2 h-auto gap-1 px-2 font-medium text-foreground hover:bg-transparent"
      onClick={onSort}
      aria-label={nextHint}
      title={nextHint}
    >
      {label}
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
    </Button>
  );
}

const studentsHeaderActions = (
  <>
    <Button type="button" variant="outline" className="w-full sm:w-auto">
      <UploadIcon data-icon="inline-start" />
      Upload Students
    </Button>
    <Button type="button" className="w-full sm:w-auto">
      <PlusIcon data-icon="inline-start" />
      Add Student
    </Button>
  </>
);

export function StudentsPage() {
  const students = useMemo(() => getStudents(), []);
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
        student.id.toLowerCase().includes(query) ||
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

  return (
    <div className="flex flex-col gap-4">
      <PageHeaderActions>{studentsHeaderActions}</PageHeaderActions>

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
                    <TableCell className="tabular-nums">{student.id}</TableCell>
                    <TableCell>
                      <span className="font-medium">{student.name}</span>
                    </TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell className="tabular-nums">{student.phone}</TableCell>
                    <TableCell>{student.registered}</TableCell>
                    <TableCell>{student.activities} active</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span
                          className={cn(
                            'size-1.5 rounded-full',
                            student.status === 'Active' ? 'bg-success' : 'bg-destructive',
                          )}
                          aria-hidden="true"
                        />
                        {student.status}
                      </span>
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
                          <DropdownMenuItem>View</DropdownMenuItem>
                          <DropdownMenuItem>Edit</DropdownMenuItem>
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

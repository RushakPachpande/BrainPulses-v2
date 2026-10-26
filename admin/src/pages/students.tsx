import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  MailIcon,
  PhoneIcon,
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
import { useConfirm } from '@/components/use-confirm';
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
import { useRecordSelection } from '@/hooks/use-list-selection';
import { useOrgId } from '@/hooks/use-org-id';
import { canManageUsersOrSettings, canMutateOrg } from '@/lib/access';
import { ApiError } from '@/lib/api-client';
import { adminQueryKeys } from '@/lib/query-keys';
import { activateStudents, deactivateStudents, getStudents, type Student } from '@/services';
import { StudentEditorDialog } from '@/pages/student-editor-dialog';
import { StudentViewDialog } from '@/pages/student-view-dialog';
import { studentCities, studentCourses } from '@/services/fixtures';

const EMPTY_STUDENTS: Student[] = [];

type SortKey =
  'code' | 'name' | 'email' | 'phone' | 'registered' | 'activities' | 'status' | 'lastLogin';

const studentColumns: RecordColumn<Student>[] = [
  {
    key: 'code',
    label: 'Unique ID',
    placement: 'identity',
    identityPrefix: 'ID: ',
    tableClassName: 'tabular-nums',
    render: (student) => student.code,
  },
  {
    key: 'name',
    label: 'Student',
    placement: 'title',
    render: (student) => <span className="font-medium">{student.name}</span>,
  },
  {
    key: 'email',
    label: 'Email',
    placement: 'wide',
    icon: MailIcon,
    render: (student) => student.email,
  },
  {
    key: 'phone',
    label: 'Phone',
    placement: 'wide',
    icon: PhoneIcon,
    tableClassName: 'tabular-nums',
    render: (student) => student.phone,
  },
  {
    key: 'registered',
    label: 'Registration Date',
    cardLabel: 'Registered',
    placement: 'half',
    icon: CalendarIcon,
    render: (student) => student.registered,
  },
  {
    key: 'activities',
    label: 'Assigned Activities',
    placement: 'pill',
    render: (student) => `${student.activities} active`,
    card: (student) =>
      `${student.activities} active ${student.activities === 1 ? 'activity' : 'activities'}`,
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
    cardLabel: 'Last login',
    placement: 'half',
    icon: ClockIcon,
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
  const canBulkStatus = canManageUsersOrSettings(membership);
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editor, setEditor] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<'disable' | 'enable' | null>(null);
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  useEffect(() => {
    const view = searchParams.get('view');
    const edit = searchParams.get('edit');
    const create = searchParams.get('create') === '1';
    if (!view && !edit && !create) return;
    if (view && loading) return;
    if (view) {
      if (students.some((student) => student.id === view)) setViewId(view);
      else toast.error('Could not load student.');
    }
    if (canMutate && create) setEditor('create');
    if (canMutate && edit) setEditor(edit);
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    next.delete('edit');
    next.delete('create');
    setSearchParams(next, { replace: true });
  }, [canMutate, loading, searchParams, setSearchParams, students]);

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
  const records = useRecordSelection(
    orgId,
    'students',
    'students',
    pageIds,
    filtered.map((row) => row.id),
  );

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

  const selectedRows = students.filter((student) => records.selected.has(student.id));
  const activeIds = selectedRows
    .filter((student) => student.status === 'Active')
    .map((student) => student.id);
  const inactiveIds = selectedRows
    .filter((student) => student.status !== 'Active')
    .map((student) => student.id);

  async function changeSelectedStatus(kind: 'disable' | 'enable') {
    const enabling = kind === 'enable';
    const ids = enabling ? inactiveIds : activeIds;
    if (ids.length === 0 || bulkAction) return;
    const ok = await confirm({
      title:
        ids.length === 1
          ? enabling
            ? 'Enable 1 student?'
            : 'Disable 1 student?'
          : enabling
            ? `Enable ${ids.length} students?`
            : `Disable ${ids.length} students?`,
      description: enabling
        ? 'They will be marked Active and can sign in.'
        : 'They will be marked Inactive and cannot sign in.',
      confirmLabel: enabling ? 'Enable' : 'Disable',
      destructive: !enabling,
    });
    if (!ok) return;
    setBulkAction(kind);
    try {
      if (enabling) await activateStudents(ids);
      else await deactivateStudents(ids);
      toast.success(
        ids.length === 1
          ? enabling
            ? 'Student enabled.'
            : 'Student disabled.'
          : enabling
            ? `${ids.length} students enabled.`
            : `${ids.length} students disabled.`,
      );
      records.onClear();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : enabling
            ? 'Could not enable students.'
            : 'Could not disable students.',
      );
    } finally {
      setBulkAction(null);
    }
  }

  const viewing = viewId ? students.find((student) => student.id === viewId) : undefined;
  const viewDialog = viewing ? (
    <StudentViewDialog
      student={viewing}
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
      <StudentEditorDialog
        mode={editor === 'create' ? 'create' : 'edit'}
        studentId={editor === 'create' ? undefined : editor}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      />
    ) : null;

  if (loading) {
    return (
      <>
        <div className="flex flex-col gap-4">
          {canMutate ? (
            <PageHeaderActions>
              <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
                <UploadIcon data-icon="inline-start" />
                Upload Students
              </Button>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => setEditor('create')}
              >
                <PlusIcon data-icon="inline-start" />
                Add Student
              </Button>
            </PageHeaderActions>
          ) : null}
          <ListPageSkeleton columns={8} />
        </div>
        {viewDialog}
        {editorDialog}
      </>
    );
  }

  return (
    <>
      <div ref={ref} className="flex flex-col gap-4">
        {canMutate ? (
          <PageHeaderActions>
            <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
              <UploadIcon data-icon="inline-start" />
              Upload Students
            </Button>
            <Button type="button" className="w-full sm:w-auto" onClick={() => setEditor('create')}>
              <PlusIcon data-icon="inline-start" />
              Add Student
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
                ...records,
                rowLabel: (student) => `Select ${student.name}`,
                actions:
                  canBulkStatus && (inactiveIds.length > 0 || activeIds.length > 0) ? (
                    <>
                      {inactiveIds.length > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void changeSelectedStatus('enable')}
                          disabled={bulkAction !== null}
                        >
                          {bulkAction === 'enable' ? 'Enabling…' : 'Enable'}
                        </Button>
                      ) : null}
                      {activeIds.length > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void changeSelectedStatus('disable')}
                          disabled={bulkAction !== null}
                        >
                          {bulkAction === 'disable' ? 'Disabling…' : 'Disable'}
                        </Button>
                      ) : null}
                    </>
                  ) : undefined,
              }}
              renderActions={(student) => (
                <RowActions
                  view={{ onClick: () => setViewId(student.id) }}
                  edit={canMutate ? { onClick: () => setEditor(student.id) } : undefined}
                />
              )}
            />

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filtered.length === 0 ? 0 : start + 1} to {end} of {filtered.length}{' '}
                students
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
      {viewDialog}
      {editorDialog}
    </>
  );
}

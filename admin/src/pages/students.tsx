import { PlusIcon, UploadIcon } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { RowActions } from '@/components/row-actions';
import { StatusBadge } from '@/components/status-badge';
import { Toolbar } from '@/components/toolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getStudents } from '@/services';

const columns = [
  'Unique ID',
  'Student Name',
  'Email',
  'Phone',
  'Registration Date',
  'Assigned Activities',
  'Status',
  'Last Login',
  'Actions',
];

export function StudentsPage() {
  const rows = getStudents().map((student) => [
    <span key="id" className="tabular-nums">
      {student.id}
    </span>,
    <span key="name" className="font-medium">
      {student.name}
    </span>,
    student.email,
    <span key="phone" className="tabular-nums">
      {student.phone}
    </span>,
    student.registered,
    `${student.activities} active`,
    <StatusBadge key="status" value={student.status} />,
    student.lastLogin,
    <RowActions key="actions" />,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        filters={['Status', 'Course', 'City']}
        actions={
          <>
            <Button type="button" variant="outline">
              <UploadIcon data-icon="inline-start" />
              Upload Students
            </Button>
            <Button type="button">
              <PlusIcon data-icon="inline-start" />
              Add Student
            </Button>
          </>
        }
      />
      <Card>
        <CardContent>
          <DataTable caption="Students" columns={columns} rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}

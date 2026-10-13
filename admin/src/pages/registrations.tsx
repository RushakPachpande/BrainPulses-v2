import { DownloadIcon } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { Toolbar } from '@/components/toolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getRegistrations, type ActivityKind } from '@/services';

export function RegistrationsPage({ kind }: { kind: ActivityKind }) {
  const label = kind === 'quiz' ? 'Quiz' : 'Assessment';
  const extra = kind === 'quiz' ? 'Attempt Status' : 'Student Status';
  const columns = [
    'Unique ID',
    'Student Name',
    'Email',
    'Phone',
    'Registration Date',
    label,
    'Assigned Question Bank',
    'Assignment Status',
    'Attempt Status',
  ];

  const rows = getRegistrations(kind).map((row) => [
    <span key="id" className="tabular-nums">
      {row.id}
    </span>,
    <span key="name" className="font-medium">
      {row.name}
    </span>,
    row.email,
    <span key="phone" className="tabular-nums">
      {row.phone}
    </span>,
    row.registered,
    row.activity,
    row.bank,
    <StatusBadge key="assignment" value={row.assignment} />,
    <StatusBadge key="attempt" value={row.attempt} />,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        filters={[label, 'City', 'Course', 'Registration Date', 'Assignment Status', extra]}
        actions={
          <Button type="button">
            <DownloadIcon data-icon="inline-start" />
            Download Filtered Data
          </Button>
        }
      />
      <Card>
        <CardContent>
          <DataTable caption={`${label} registrations`} columns={columns} rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}

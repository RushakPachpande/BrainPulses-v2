import { PlusIcon } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { RowActions } from '@/components/row-actions';
import { StatusBadge } from '@/components/status-badge';
import { Toolbar } from '@/components/toolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getUsers } from '@/services';

const columns = [
  'Name',
  'Email',
  'Role',
  'Assessment Access',
  'Quiz Access',
  'Status',
  'Last Login',
  'Actions',
];

export function UsersPage() {
  const rows = getUsers().map((user) => [
    <span key="name" className="font-medium">
      {user.name}
    </span>,
    user.email,
    <StatusBadge key="role" value={user.role} />,
    user.assessmentAccess,
    user.quizAccess,
    <StatusBadge key="status" value={user.status} />,
    user.lastLogin,
    <RowActions key="actions" />,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        filters={['Role', 'Status']}
        actions={
          <Button type="button">
            <PlusIcon data-icon="inline-start" />
            Add User
          </Button>
        }
      />
      <Card>
        <CardContent>
          <DataTable caption="Admin users" columns={columns} rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}

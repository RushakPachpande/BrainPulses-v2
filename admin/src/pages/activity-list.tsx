import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { PlusIcon } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { RowActions } from '@/components/row-actions';
import { StatusBadge } from '@/components/status-badge';
import { Toolbar } from '@/components/toolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getActivities, type ActivityKind } from '@/services';

export function ActivityListPage({ kind }: { kind: ActivityKind }) {
  const isQuiz = kind === 'quiz';
  const label = isQuiz ? 'Quiz Name' : 'Assessment Name';
  const columns = isQuiz
    ? [
        label,
        'Status',
        'Question Banks',
        'Registered Students',
        'Assigned Students',
        'Attempts',
        'Start Date',
        'End Date',
        'Actions',
      ]
    : [
        label,
        'Status',
        'Registered Students',
        'Assigned Students',
        'Question Banks',
        'Attempts',
        'Start Date',
        'End Date',
        'Actions',
      ];
  const counts = isQuiz
    ? ['All (32)', 'Active (26)', 'Draft (4)', 'Completed (2)']
    : ['All (24)', 'Active (14)', 'Draft (6)', 'Completed (4)'];
  const href = isQuiz ? '/quizzes/new' : '/assessments/new';

  const rows = getActivities(kind).map((item) => {
    const cells: Record<string, ReactNode> = {
      [label]: <span className="font-medium">{item.name}</span>,
      Status: <StatusBadge value={item.status} />,
      'Registered Students': <span className="tabular-nums">{item.registered}</span>,
      'Assigned Students': <span className="tabular-nums">{item.assigned}</span>,
      'Question Banks': <span className="tabular-nums">{item.banks}</span>,
      Attempts: <span className="tabular-nums">{item.attempts}</span>,
      'Start Date': item.start,
      'End Date': item.end,
      Actions: <RowActions />,
    };
    return columns.map((column) => cells[column]);
  });

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue={counts[0]}>
        <TabsList className="h-auto w-full flex-wrap justify-start">
          {counts.map((count) => (
            <TabsTrigger key={count} value={count}>
              {count}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Toolbar
        filters={['Status', 'Date']}
        actions={
          <Button asChild>
            <Link to={href}>
              <PlusIcon data-icon="inline-start" />
              Create {isQuiz ? 'Quiz' : 'Assessment'}
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent>
          <DataTable caption={isQuiz ? 'Quizzes' : 'Assessments'} columns={columns} rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}

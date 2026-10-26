import { useMemo, useState } from 'react';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { ResponsiveRecords, type RecordColumn } from '@/components/responsive-records';
import { Toolbar, type ToolbarFilter } from '@/components/toolbar';
import { Card, CardContent } from '@/components/ui/card';
import { useAsyncService } from '@/hooks/use-async-service';
import { useContainerNarrow } from '@/hooks/use-container-narrow';
import { getActivities, getActivityLeaderboard } from '@/services';
import type { Activity } from '@/services/types';

const EMPTY_ACTIVITIES: Activity[] = [];

type Scope = 'daily' | 'overall';
type Kind = 'individual' | 'group';

type IndividualEntry = {
  rank: number;
  studentName: string;
  studentCode: string;
  cohort?: string | null;
  percent: number;
};

type GroupEntry = {
  rank: number;
  cohort: string;
  members: number;
  avgPercent: number;
  bestPercent: number;
};

const individualColumns: RecordColumn<IndividualEntry>[] = [
  {
    key: 'rank',
    label: 'Rank',
    placement: 'lead',
    sortable: false,
    tableClassName: 'tabular-nums',
    render: (row) => row.rank,
  },
  {
    key: 'student',
    label: 'Student',
    placement: 'title',
    sortable: false,
    tableClassName: 'font-medium',
    render: (row) => row.studentName,
  },
  {
    key: 'code',
    label: 'Unique ID',
    placement: 'identity',
    sortable: false,
    render: (row) => row.studentCode,
  },
  {
    key: 'cohort',
    label: 'Cohort',
    placement: 'identity',
    sortable: false,
    render: (row) => row.cohort?.trim() || '—',
  },
  {
    key: 'score',
    label: 'Score',
    placement: 'status',
    sortable: false,
    headClassName: 'text-right',
    tableClassName: 'text-right tabular-nums',
    render: (row) => `${Math.round(row.percent)}%`,
  },
];

const groupColumns: RecordColumn<GroupEntry>[] = [
  {
    key: 'rank',
    label: 'Rank',
    placement: 'lead',
    sortable: false,
    tableClassName: 'tabular-nums',
    render: (row) => row.rank,
  },
  {
    key: 'cohort',
    label: 'Cohort',
    placement: 'title',
    sortable: false,
    tableClassName: 'font-medium',
    render: (row) => row.cohort,
  },
  {
    key: 'members',
    label: 'Members',
    placement: 'primary',
    sortable: false,
    headClassName: 'text-right',
    tableClassName: 'text-right tabular-nums',
    render: (row) => row.members,
  },
  {
    key: 'avg',
    label: 'Avg %',
    placement: 'primary',
    sortable: false,
    headClassName: 'text-right',
    tableClassName: 'text-right tabular-nums',
    render: (row) => `${Math.round(row.avgPercent)}%`,
  },
  {
    key: 'best',
    label: 'Best %',
    placement: 'primary',
    sortable: false,
    headClassName: 'text-right',
    tableClassName: 'text-right tabular-nums',
    render: (row) => `${Math.round(row.bestPercent)}%`,
  },
];

export function QuizLeaderboardPage() {
  const { narrow, ref } = useContainerNarrow();
  const [activityName, setActivityName] = useState('');
  const [scopeLabel, setScopeLabel] = useState('Overall');
  const [kindLabel, setKindLabel] = useState('Individual');

  const { data: activitiesData, loading: activitiesLoading } = useAsyncService(
    () => getActivities('quiz'),
    [],
  );
  const activities = activitiesData ?? EMPTY_ACTIVITIES;

  const selectedName = activityName || activities[0]?.name || '';
  const effectiveActivityId = activities.find((a) => a.name === selectedName)?.id ?? '';
  const scope: Scope = scopeLabel === 'Daily' ? 'daily' : 'overall';
  const kind: Kind = kindLabel === 'Group' ? 'group' : 'individual';

  const { data: board, loading: boardLoading } = useAsyncService(
    () =>
      effectiveActivityId
        ? getActivityLeaderboard(effectiveActivityId, { scope, kind })
        : Promise.resolve(null),
    [effectiveActivityId, scope, kind],
  );

  const entries = useMemo(() => (board?.entries ?? []) as Record<string, unknown>[], [board]);
  const loading = activitiesLoading || (Boolean(effectiveActivityId) && boardLoading);

  const filters: ToolbarFilter[] = [
    {
      name: 'Quiz',
      options: activities.map((a) => a.name),
      value: selectedName || '—',
      onValueChange: setActivityName,
    },
    {
      name: 'Scope',
      options: ['Overall', 'Daily'],
      value: scopeLabel,
      onValueChange: setScopeLabel,
    },
    {
      name: 'Type',
      options: ['Individual', 'Group'],
      value: kindLabel,
      onValueChange: setKindLabel,
    },
  ];

  if (activitiesLoading && activities.length === 0) {
    return <ListPageSkeleton columns={5} />;
  }

  return (
    <div ref={ref} className="flex min-w-0 flex-col gap-4">
      <Toolbar filters={filters} searchPlaceholder="Search leaderboard" />

      {loading ? (
        <ListPageSkeleton columns={kind === 'group' ? 4 : 5} />
      ) : !effectiveActivityId ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Create a quiz to view leaderboards.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {kind === 'individual' ? (
              <ResponsiveRecords
                caption={`${board?.activityName ?? selectedName} · ${scopeLabel} · ${kindLabel}`}
                captionClassName="px-4 py-3 text-left"
                rows={entries as unknown as IndividualEntry[]}
                getRowId={(row) => `${row.rank}-${row.studentCode}`}
                columns={individualColumns}
                narrow={narrow}
                empty="No entries yet."
                emptyClassName="py-10 text-center text-muted-foreground"
              />
            ) : (
              <ResponsiveRecords
                caption={`${board?.activityName ?? selectedName} · ${scopeLabel} · ${kindLabel}`}
                captionClassName="px-4 py-3 text-left"
                rows={entries as unknown as GroupEntry[]}
                getRowId={(row) => `${row.rank}-${row.cohort}`}
                columns={groupColumns}
                narrow={narrow}
                empty="No entries yet."
                emptyClassName="py-10 text-center text-muted-foreground"
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

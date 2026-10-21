import { useMemo, useState } from 'react';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { Toolbar, type ToolbarFilter } from '@/components/toolbar';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAsyncService } from '@/hooks/use-async-service';
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

export function QuizLeaderboardPage() {
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
    <div className="flex min-w-0 flex-col gap-4">
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
            <Table>
              <TableCaption className="px-4 py-3 text-left">
                {board?.activityName ?? selectedName} · {scopeLabel} · {kindLabel}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  {kind === 'individual' ? (
                    <>
                      <TableHead>Student</TableHead>
                      <TableHead>Unique ID</TableHead>
                      <TableHead>Cohort</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Cohort</TableHead>
                      <TableHead className="text-right">Members</TableHead>
                      <TableHead className="text-right">Avg %</TableHead>
                      <TableHead className="text-right">Best %</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={kind === 'group' ? 4 : 5}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No entries yet.
                    </TableCell>
                  </TableRow>
                ) : kind === 'individual' ? (
                  (entries as unknown as IndividualEntry[]).map((row) => (
                    <TableRow key={`${row.rank}-${row.studentCode}`}>
                      <TableCell className="tabular-nums">{row.rank}</TableCell>
                      <TableCell className="font-medium">{row.studentName}</TableCell>
                      <TableCell>{row.studentCode}</TableCell>
                      <TableCell>{row.cohort?.trim() || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Math.round(row.percent)}%
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  (entries as unknown as GroupEntry[]).map((row) => (
                    <TableRow key={`${row.rank}-${row.cohort}`}>
                      <TableCell className="tabular-nums">{row.rank}</TableCell>
                      <TableCell className="font-medium">{row.cohort}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.members}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Math.round(row.avgPercent)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Math.round(row.bestPercent)}%
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

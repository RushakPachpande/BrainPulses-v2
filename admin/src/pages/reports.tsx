import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { DownloadIcon } from 'lucide-react';
import { BarChartCard } from '@/components/bar-chart-card';
import { DateRangeFilter } from '@/components/date-range-filter';
import { ResponsiveRecords, type RecordColumn } from '@/components/responsive-records';
import { KpiGrid } from '@/components/kpi-grid';
import { StatusBadge } from '@/components/status-badge';
import { Toolbar } from '@/components/toolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ALL_DATE_RANGE,
  isDateInRange,
  parseFixtureDate,
  type DateRangeValue,
} from '@/lib/date-range';
import { useQuery } from '@tanstack/react-query';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { useContainerNarrow } from '@/hooks/use-container-narrow';
import { useOrgId } from '@/hooks/use-org-id';
import { adminQueryKeys } from '@/lib/query-keys';
import { getReportSummary, getResults, type ActivityKind } from '@/services';
import type { ReportSummaryRow, ResultRow } from '@/services/types';

const EMPTY_RESULTS: ResultRow[] = [];
const EMPTY_SUMMARY: ReportSummaryRow[] = [];

export function ReportsPage({ kind }: { kind: ActivityKind }) {
  const navigate = useNavigate();
  const { narrow, ref } = useContainerNarrow();
  const orgId = useOrgId();
  const label = kind === 'quiz' ? 'Quiz' : 'Assessment';
  const reportsBase = kind === 'quiz' ? '/quizzes/reports' : '/assessments/reports';
  const [dateRange, setDateRange] = useState<DateRangeValue>(ALL_DATE_RANGE);

  const { data: resultsData, isPending: resultsLoading } = useQuery({
    queryKey: adminQueryKeys.results(orgId, kind),
    queryFn: () => getResults(kind),
    enabled: Boolean(orgId),
  });
  const { data: summaryData, isPending: summaryLoading } = useQuery({
    queryKey: adminQueryKeys.resultsSummary(orgId, kind),
    queryFn: () => getReportSummary(kind),
    enabled: Boolean(orgId),
  });
  const allResults = resultsData ?? EMPTY_RESULTS;
  const summary = summaryData ?? EMPTY_SUMMARY;
  const loading = resultsLoading || summaryLoading;

  const results = useMemo((): ResultRow[] => {
    return allResults.filter((row) => isDateInRange(parseFixtureDate(row.submitted), dateRange));
  }, [allResults, dateRange]);

  const activityNames = useMemo(
    () => [...new Set(allResults.map((row) => row.activity).filter(Boolean))],
    [allResults],
  );
  const activityFilter = activityNames.length === 1 ? activityNames[0] : 'All';
  const distribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const row of results) {
      const pct = row.percent ?? row.score;
      const index = pct >= 100 ? 4 : Math.max(0, Math.min(4, Math.floor(pct / 20)));
      counts[index] += 1;
    }
    return counts;
  }, [results]);

  const reportColumns: RecordColumn<ResultRow>[] = [
    {
      key: 'student',
      label: 'Student',
      placement: 'title',
      sortable: false,
      render: (row) => <span className="font-medium">{row.student}</span>,
    },
    {
      key: 'activity',
      label,
      placement: 'primary',
      sortable: false,
      render: (row) => row.activity,
    },
    {
      key: 'attempt',
      label: 'Attempt',
      placement: 'details',
      sortable: false,
      render: (row) => row.attempt,
    },
    {
      key: 'score',
      label: 'Score',
      placement: 'primary',
      sortable: false,
      tableClassName: 'tabular-nums',
      render: (row) => (
        <span className="tabular-nums">
          {row.maxScore != null ? `${row.score} / ${row.maxScore}` : row.score}
        </span>
      ),
    },
    {
      key: 'percent',
      label: 'Percentage',
      placement: 'primary',
      sortable: false,
      tableClassName: 'tabular-nums',
      render: (row) => <span className="tabular-nums">{row.percent ?? row.score}%</span>,
    },
    {
      key: 'status',
      label: 'Status',
      placement: 'status',
      sortable: false,
      render: (row) => <StatusBadge value={row.status} />,
    },
    {
      key: 'submitted',
      label: 'Submitted On',
      placement: 'details',
      sortable: false,
      render: (row) => row.submitted,
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Toolbar
          filters={[`${label}: ${activityFilter}`, 'Student', 'Status']}
          dateRange={<DateRangeFilter value={dateRange} onApply={setDateRange} />}
          actions={
            <>
              <Button type="button">Generate Report</Button>
              <Button type="button" variant="outline">
                <DownloadIcon data-icon="inline-start" />
                Export
              </Button>
            </>
          }
        />
        <ListPageSkeleton columns={8} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        filters={[`${label}: ${activityFilter}`, 'Student', 'Status']}
        dateRange={<DateRangeFilter value={dateRange} onApply={setDateRange} />}
        actions={
          <>
            <Button type="button">Generate Report</Button>
            <Button type="button" variant="outline">
              <DownloadIcon data-icon="inline-start" />
              Export
            </Button>
          </>
        }
      />
      <KpiGrid items={summary} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,22rem)_1fr]">
        <BarChartCard
          title="Score distribution"
          values={distribution}
          color="var(--primary)"
          caption="Submitted scores grouped by percentage."
          labels={['0–20', '20–40', '40–60', '60–80', '80–100']}
          emphasizeLast={false}
        />
        <Card ref={ref}>
          <CardContent>
            <ResponsiveRecords
              caption={`${label} results`}
              rows={results}
              getRowId={(row) => row.id}
              columns={reportColumns}
              narrow={narrow}
              empty="No results match the current filters."
              actionsLabel="View Result"
              renderActions={(row) => (
                <Button asChild variant="link">
                  <Link to={`${reportsBase}/${row.id}`}>View result</Link>
                </Button>
              )}
              onRowOpen={(row) => navigate(`${reportsBase}/${row.id}`)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

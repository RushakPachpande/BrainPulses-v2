import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { DownloadIcon } from 'lucide-react';
import { BarChartCard } from '@/components/bar-chart-card';
import { DataTable } from '@/components/data-table';
import { DateRangeFilter } from '@/components/date-range-filter';
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
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { useAsyncService } from '@/hooks/use-async-service';
import { getReportSummary, getResults, type ActivityKind } from '@/services';
import type { ReportSummaryRow, ResultRow } from '@/services/types';

const EMPTY_RESULTS: ResultRow[] = [];
const EMPTY_SUMMARY: ReportSummaryRow[] = [];

export function ReportsPage({ kind }: { kind: ActivityKind }) {
  const label = kind === 'quiz' ? 'Quiz' : 'Assessment';
  const reportsBase = kind === 'quiz' ? '/quizzes/reports' : '/assessments/reports';
  const current = kind === 'quiz' ? 'Weekly GK Quiz' : 'JEE Mock Series 2026';
  const [dateRange, setDateRange] = useState<DateRangeValue>(ALL_DATE_RANGE);

  const { data: resultsData, loading: resultsLoading } = useAsyncService(
    () => getResults(kind),
    [kind],
  );
  const { data: summaryData, loading: summaryLoading } = useAsyncService(
    () => getReportSummary(kind),
    [kind],
  );
  const allResults = resultsData ?? EMPTY_RESULTS;
  const summary = summaryData ?? EMPTY_SUMMARY;
  const loading = resultsLoading || summaryLoading;

  const columns = [
    'Student',
    label,
    'Attempt',
    'Score',
    'Percentage',
    'Status',
    'Submitted On',
    'View Result',
  ];

  const results = useMemo(() => {
    return allResults.filter((row) => isDateInRange(parseFixtureDate(row.submitted), dateRange));
  }, [allResults, dateRange]);

  const rows = results.map((row) => [
    <span key="student" className="font-medium">
      {row.student}
    </span>,
    row.activity,
    row.attempt,
    <span key="score" className="tabular-nums">
      {row.score}/100
    </span>,
    <span key="percent" className="tabular-nums">
      {row.score}%
    </span>,
    <StatusBadge key="status" value={row.status} />,
    row.submitted,
    <Button key="view" asChild variant="link">
      <Link to={`${reportsBase}/${row.id}`}>View result</Link>
    </Button>,
  ]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Toolbar
          filters={[`${label}: ${current}`, 'Student', 'Status']}
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
        filters={[`${label}: ${current}`, 'Student', 'Status']}
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
          values={[20, 45, 90, 70, 35]}
          color="var(--primary)"
          caption="Most attempts fall between 40 and 60."
          labels={['0–20', '20–40', '40–60', '60–80', '80–100']}
          emphasizeLast={false}
        />
        <Card>
          <CardContent>
            <DataTable caption={`${label} results`} columns={columns} rows={rows} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

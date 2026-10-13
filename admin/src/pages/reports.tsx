import { DownloadIcon } from 'lucide-react';
import { BarChartCard } from '@/components/bar-chart-card';
import { DataTable } from '@/components/data-table';
import { KpiGrid } from '@/components/kpi-grid';
import { StatusBadge } from '@/components/status-badge';
import { Toolbar } from '@/components/toolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getReportSummary, getResults, type ActivityKind } from '@/services';

export function ReportsPage({ kind }: { kind: ActivityKind }) {
  const label = kind === 'quiz' ? 'Quiz' : 'Assessment';
  const current = kind === 'quiz' ? 'Weekly GK Quiz' : 'JEE Mock Series 2026';
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

  const rows = getResults(kind).map((row) => [
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
    <Button key="view" type="button" variant="link">
      View result
    </Button>,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        filters={[`${label}: ${current}`, 'Date range', 'Student', 'Status']}
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
      <KpiGrid items={getReportSummary()} />
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

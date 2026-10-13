import { Link } from "react-router";
import { PlusIcon, UploadIcon } from "lucide-react";
import { BarChartCard } from "@/components/bar-chart-card";
import { KpiGrid } from "@/components/kpi-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboard } from "@/services";

export function DashboardPage() {
  const data = getDashboard();

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid items={data.kpis} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {data.charts.map((chart) => (
          <BarChartCard key={chart.title} {...chart} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent activities</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {data.activity.map(([text, time]) => (
                <li key={text} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span>{text}</span>
                  <time className="shrink-0 text-sm text-muted-foreground">{time}</time>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button asChild>
                <Link to="/assessments/new">
                  <PlusIcon data-icon="inline-start" />
                  Create Assessment
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/quizzes/new">
                  <PlusIcon data-icon="inline-start" />
                  Create Quiz
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/students">
                  <UploadIcon data-icon="inline-start" />
                  Upload Students
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/users">
                  <PlusIcon data-icon="inline-start" />
                  Add User
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

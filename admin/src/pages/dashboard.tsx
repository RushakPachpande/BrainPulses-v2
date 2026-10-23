import { Link } from 'react-router';
import { PlusIcon, UploadIcon } from 'lucide-react';
import { BarChartCard } from '@/components/bar-chart-card';
import { KpiGrid } from '@/components/kpi-grid';
import { DashboardSkeleton } from '@/components/loading-skeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { useOrgId } from '@/hooks/use-org-id';
import { canEditKind, canManageUsersOrSettings, canMutateOrg } from '@/lib/access';
import { adminQueryKeys } from '@/lib/query-keys';
import { getDashboard } from '@/services';

export function DashboardPage() {
  const auth = useAuth();
  const orgId = useOrgId();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const { data, isPending: loading } = useQuery({
    queryKey: adminQueryKeys.dashboard(orgId),
    queryFn: () => getDashboard(),
    enabled: Boolean(orgId),
  });

  const showAssessment = canEditKind(membership, 'assessment');
  const showQuiz = canEditKind(membership, 'quiz');
  const showStudents = canMutateOrg(membership);
  const showUsers = canManageUsersOrSettings(membership);
  const hasQuickActions = showAssessment || showQuiz || showStudents || showUsers;

  if (loading || !data) {
    return <DashboardSkeleton />;
  }

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
              {data.activity.map(([id, text, time]) => (
                <li
                  key={id}
                  className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <span>{text}</span>
                  <time className="shrink-0 text-sm text-muted-foreground">{time}</time>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        {hasQuickActions ? (
          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {showAssessment ? (
                  <Button asChild>
                    <Link to="/assessments/new">
                      <PlusIcon data-icon="inline-start" />
                      Create Assessment
                    </Link>
                  </Button>
                ) : null}
                {showQuiz ? (
                  <Button asChild variant="outline">
                    <Link to="/quizzes/new">
                      <PlusIcon data-icon="inline-start" />
                      Create Quiz
                    </Link>
                  </Button>
                ) : null}
                {showStudents ? (
                  <Button asChild variant="outline">
                    <Link to="/students">
                      <UploadIcon data-icon="inline-start" />
                      Upload Students
                    </Link>
                  </Button>
                ) : null}
                {showUsers ? (
                  <Button asChild variant="outline">
                    <Link to="/users">
                      <PlusIcon data-icon="inline-start" />
                      Add User
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

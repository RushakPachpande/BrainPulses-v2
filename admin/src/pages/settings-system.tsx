import { KpiGrid } from "@/components/kpi-grid";
import { StatusBadge } from "@/components/status-badge";
import { ToggleRow } from "@/components/toggle-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuditLogs } from "@/services";

export function SystemSettingsPage() {
  const logs = getAuditLogs();

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid
        items={[
          ["System Status", "Healthy", "All services operational", 1],
          ["Last Backup", "Today 02:00", "Size 1.8 GB", 0],
          ["Uptime", "99.98%", "Last 30 days", 3],
        ]}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ToggleRow label="Two-factor authentication" hint="Required for all admins" defaultOn />
            <ToggleRow label="Password expiry (90 days)" hint="Force periodic reset" defaultOn />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Session / Login</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ToggleRow label="Auto logout after 30 min" hint="Idle session timeout" defaultOn />
            <ToggleRow label="Limit failed logins (5)" hint="Lock account temporarily" defaultOn />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Backup & data retention</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ToggleRow label="Daily automated backup" hint="Retained for 30 days" defaultOn />
            <div className="flex items-center justify-between gap-3">
              <span>Student data retention</span>
              <StatusBadge value="3 years" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Audit logs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {logs.map(([text, time]) => (
                <li key={text} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span>{text}</span>
                  <time className="shrink-0 text-sm text-muted-foreground">{time}</time>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { ActivityIcon, ArchiveIcon, CheckCircle2Icon, Clock3Icon, DatabaseBackupIcon, LockKeyholeIcon, SaveIcon, ShieldCheckIcon } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { getAuditLogs } from '@/services';

const initialSecurity = [true, true, true, true, true];
const settingLabels = [
  { label: 'Require two-factor authentication', hint: 'Require an additional verification step for administrator accounts.' },
  { label: 'Password expiry', hint: 'Prompt administrators to rotate passwords every 90 days.' },
  { label: 'Automatic session timeout', hint: 'End inactive sessions after 30 minutes.' },
  { label: 'Limit failed login attempts', hint: 'Temporarily lock login after 5 consecutive failures.' },
  { label: 'Daily automated backups', hint: 'Create a daily backup and retain it for 30 days.' },
];

export function SystemSettingsPage() {
  const logs = getAuditLogs();
  const [security, setSecurity] = useState(initialSecurity);
  const [saved, setSaved] = useState(false);
  function toggle(index: number, next: boolean) {
    setSecurity((current) => current.map((value, i) => i === index ? next : value));
    setSaved(false);
  }
  return <div className="flex min-w-0 flex-col gap-5">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {[{ title: 'System status', value: 'Healthy', note: 'All services operational', icon: ActivityIcon, tone: 'text-emerald-600 bg-emerald-500/10' }, { title: 'Last backup', value: 'Today, 02:00', note: 'Reported size: 1.8 GB', icon: DatabaseBackupIcon, tone: 'text-primary bg-primary/10' }, { title: 'Platform uptime', value: '99.98%', note: 'Rolling 30-day window', icon: Clock3Icon, tone: 'text-sky-600 bg-sky-500/10' }].map((item) => { const Icon = item.icon; return <Card key={item.title}><CardContent className="flex items-start gap-3 p-4 sm:p-5"><span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${item.tone}`}><Icon className="size-5" /></span><div className="min-w-0"><p className="text-sm text-muted-foreground">{item.title}</p><p className="mt-1 text-xl font-semibold tracking-tight">{item.value}</p><p className="mt-1 text-xs text-muted-foreground">{item.note}</p></div></CardContent></Card>; })}
    </div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card><CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6"><div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><LockKeyholeIcon className="size-5" /></span><div><CardTitle>Security & sign-in</CardTitle><CardDescription className="mt-1">Set baseline protections for administrator accounts and sessions.</CardDescription></div></div></CardHeader><CardContent className="px-5 py-1 sm:px-6">{settingLabels.slice(0, 4).map((item, index) => <div key={item.label} className="flex items-center justify-between gap-4 border-b border-border/70 py-4 last:border-0"><div className="min-w-0"><p className="text-sm font-medium">{item.label}</p><p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">{item.hint}</p></div><Switch checked={security[index]} onCheckedChange={(next) => toggle(index, next)} aria-label={item.label} /></div>)}</CardContent></Card>
        <Card><CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6"><div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><ArchiveIcon className="size-5" /></span><div><CardTitle>Backup & retention</CardTitle><CardDescription className="mt-1">Review the current backup policy and data retention window.</CardDescription></div></div></CardHeader><CardContent className="px-5 py-1 sm:px-6"><div className="flex items-center justify-between gap-4 border-b border-border/70 py-4"><div><p className="text-sm font-medium">Daily automated backups</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{settingLabels[4].hint}</p></div><Switch checked={security[4]} onCheckedChange={(next) => toggle(4, next)} aria-label="Daily automated backups" /></div><div className="flex items-center justify-between gap-3 py-4"><div><p className="text-sm font-medium">Student data retention</p><p className="mt-1 text-xs text-muted-foreground">Current configured policy</p></div><StatusBadge value="3 years" /></div></CardContent></Card>
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        <Card><CardHeader className="border-b border-border/70 px-5 py-4"><div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheckIcon className="size-5" /></span><div><CardTitle>Service health</CardTitle><CardDescription className="mt-1">Latest status snapshot for core services.</CardDescription></div></div></CardHeader><CardContent className="px-5 py-2">{[['Application', 'Operational'], ['Authentication', 'Operational'], ['Database', 'Operational'], ['Scheduled backups', security[4] ? 'Enabled' : 'Disabled']].map(([name, status], index) => <div key={name}>{index > 0 ? <Separator /> : null}<div className="flex items-center justify-between gap-3 py-3"><span className="text-sm">{name}</span><StatusBadge value={status} /></div></div>)}</CardContent></Card>
        <Card><CardHeader className="border-b border-border/70 px-5 py-4"><CardTitle>Recent audit activity</CardTitle><CardDescription>Latest administrative events.</CardDescription></CardHeader><CardContent className="px-5 py-2"><ol className="flex flex-col">{logs.map(([text, time], index) => <li key={text} className="relative flex gap-3 py-3"><span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground"><ActivityIcon className="size-3.5" /></span><div className="min-w-0 flex-1"><p className="text-sm leading-5">{text}</p><time className="mt-1 block text-xs text-muted-foreground">{time}</time></div>{index < logs.length - 1 ? <span className="absolute bottom-0 left-[13px] top-10 w-px bg-border" /> : null}</li>)}</ol></CardContent></Card>
      </div>
    </div>
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"><p className="text-sm text-muted-foreground" aria-live="polite">{saved ? <span className="inline-flex items-center gap-2 text-emerald-600"><CheckCircle2Icon className="size-4" /> Settings staged in this prototype.</span> : 'Changes are a UI preview and do not update server security policies.'}</p><Button type="button" onClick={() => setSaved(true)}><SaveIcon data-icon="inline-start" /> Save system settings</Button></div>
  </div>;
}

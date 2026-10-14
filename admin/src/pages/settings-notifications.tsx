import { useState } from 'react';
import { BellRingIcon, CheckCircle2Icon, MailIcon, SaveIcon, SmartphoneIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { getNotifications } from '@/services';

export function NotificationSettingsPage() {
  const [notifications, setNotifications] = useState(() => getNotifications().map(([title, hint, enabled]) => ({ title, hint, enabled })));
  const [saved, setSaved] = useState(false);
  function toggle(index: number) {
    setNotifications((current) => current.map((item, i) => i === index ? { ...item, enabled: !item.enabled } : item));
    setSaved(false);
  }
  return <div className="flex min-w-0 flex-col gap-5">
    <Card>
      <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><BellRingIcon className="size-5" /></span><div><CardTitle>Notification preferences</CardTitle><CardDescription className="mt-1">Choose which events should generate notifications for administrators.</CardDescription></div></div></CardHeader>
      <CardContent className="px-5 py-2 sm:px-6">
        {notifications.map((item, index) => <div key={item.title} className="flex flex-col gap-3 border-b border-border/70 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">{index === 4 || index === 5 ? <MailIcon className="size-4" /> : <BellRingIcon className="size-4" />}</div><div className="min-w-0"><p className="text-sm font-medium">{item.title}</p><p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{item.hint}</p><div className="mt-2 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"><MailIcon className="size-3" /> Email</span><span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"><SmartphoneIcon className="size-3" /> In-app</span></div></div></div><div className="flex items-center justify-between gap-3 sm:justify-end"><span className="text-xs text-muted-foreground">{item.enabled ? 'Enabled' : 'Disabled'}</span><Switch checked={item.enabled} onCheckedChange={() => toggle(index)} aria-label={`${item.title} notifications`} /></div></div>)}
      </CardContent>
    </Card>
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"><div className="text-sm" aria-live="polite">{saved ? <span className="inline-flex items-center gap-2 text-emerald-600"><CheckCircle2Icon className="size-4" /> Preferences saved in this prototype.</span> : <span className="text-muted-foreground">Notification preferences are local until connected to your notification service.</span>}</div><Button type="button" onClick={() => setSaved(true)}><SaveIcon data-icon="inline-start" /> Save preferences</Button></div>
  </div>;
}

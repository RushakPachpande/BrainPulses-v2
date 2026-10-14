import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Building2Icon, CheckCircle2Icon, ImageIcon, LanguagesIcon, SaveIcon, UploadIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const initialSettings = {
  platformName: 'BrainPulses', organization: 'BrainPulses Learning Pvt. Ltd.',
  timezone: 'Asia/Kolkata', dateFormat: 'DD MMM YYYY', timeFormat: '12-hour', language: 'English',
};

function SettingField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <Field className="gap-2"><FieldLabel className="text-sm font-medium">{label}</FieldLabel>{children}{hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}</Field>;
}

export function GeneralSettingsPage() {
  const [settings, setSettings] = useState(initialSettings);
  const [saved, setSaved] = useState(false);
  const [logoName, setLogoName] = useState('brainpulses-logo.svg');
  const [faviconName, setFaviconName] = useState('favicon-32.png');
  const logoInput = useRef<HTMLInputElement>(null);
  const faviconInput = useRef<HTMLInputElement>(null);

  function update(key: keyof typeof initialSettings, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }
  function onFileChange(event: ChangeEvent<HTMLInputElement>, setName: (name: string) => void) {
    const file = event.target.files?.[0];
    if (file) setName(file.name);
    setSaved(false);
  }
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
  }
  function reset() {
    setSettings(initialSettings);
    setLogoName('brainpulses-logo.svg');
    setFaviconName('favicon-32.png');
    setSaved(false);
  }

  return <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-5">
    <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card>
          <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2Icon className="size-5" /></span><div><CardTitle>Organization details</CardTitle><CardDescription className="mt-1">Set the name and identity used throughout your workspace.</CardDescription></div></div>
          </CardHeader>
          <CardContent className="px-5 py-5 sm:px-6">
            <FieldGroup className="gap-5">
              <SettingField label="Platform name" hint="Displayed in the application header and browser title."><Input value={settings.platformName} onChange={(e) => update('platformName', e.target.value)} autoComplete="organization-title" required /></SettingField>
              <SettingField label="Organization name" hint="The organization that owns this BrainPulses workspace."><Input value={settings.organization} onChange={(e) => update('organization', e.target.value)} autoComplete="organization" required /></SettingField>
            </FieldGroup>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><LanguagesIcon className="size-5" /></span><div><CardTitle>Regional preferences</CardTitle><CardDescription className="mt-1">Choose how dates, times and language appear across the platform.</CardDescription></div></div>
          </CardHeader>
          <CardContent className="px-5 py-5 sm:px-6">
            <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
              <SettingField label="Time zone"><Select value={settings.timezone} onValueChange={(v) => update('timezone', v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="Asia/Kolkata">India Standard Time (UTC+05:30)</SelectItem><SelectItem value="UTC">Coordinated Universal Time (UTC)</SelectItem><SelectItem value="Europe/London">London (UTC+00:00 / UTC+01:00)</SelectItem><SelectItem value="America/New_York">New York (UTC−05:00 / UTC−04:00)</SelectItem><SelectItem value="Asia/Singapore">Singapore (UTC+08:00)</SelectItem></SelectGroup></SelectContent></Select></SettingField>
              <SettingField label="Date format"><Select value={settings.dateFormat} onValueChange={(v) => update('dateFormat', v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DD MMM YYYY">DD MMM YYYY · 13 Oct 2026</SelectItem><SelectItem value="DD/MM/YYYY">DD/MM/YYYY · 13/10/2026</SelectItem><SelectItem value="MM/DD/YYYY">MM/DD/YYYY · 10/13/2026</SelectItem><SelectItem value="YYYY-MM-DD">YYYY-MM-DD · 2026-10-13</SelectItem></SelectContent></Select></SettingField>
              <SettingField label="Time format"><Select value={settings.timeFormat} onValueChange={(v) => update('timeFormat', v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="12-hour">12-hour · 2:30 PM</SelectItem><SelectItem value="24-hour">24-hour · 14:30</SelectItem></SelectContent></Select></SettingField>
              <SettingField label="Language"><Select value={settings.language} onValueChange={(v) => update('language', v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="English">English</SelectItem><SelectItem value="Hindi">Hindi</SelectItem><SelectItem value="Marathi">Marathi</SelectItem></SelectContent></Select></SettingField>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        <Card>
          <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ImageIcon className="size-5" /></span><div><CardTitle>Brand assets</CardTitle><CardDescription className="mt-1">Manage the logo and browser favicon for your workspace.</CardDescription></div></div></CardHeader>
          <CardContent className="flex flex-col gap-5 px-5 py-5 sm:px-6">
            <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/70 p-4 sm:flex-row sm:items-center">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-[#45058F] p-2"><img src="/brand.svg" alt="BrainPulses logo preview" className="size-full object-contain" /></div>
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">Application logo</p><p className="mt-1 truncate text-xs text-muted-foreground">{logoName}</p><p className="mt-1 text-xs text-muted-foreground">SVG or PNG · Use a transparent background</p></div>
              <Button type="button" variant="outline" onClick={() => logoInput.current?.click()}><UploadIcon data-icon="inline-start" /> Change</Button>
              <input ref={logoInput} type="file" accept="image/svg+xml,image/png" className="sr-only" onChange={(e) => onFileChange(e, setLogoName)} aria-label="Choose application logo" />
            </div>
            <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/70 p-4 sm:flex-row sm:items-center">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-primary"><img src="/brand.svg" alt="Favicon preview" className="size-8 object-contain" /></div>
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">Browser favicon</p><p className="mt-1 truncate text-xs text-muted-foreground">{faviconName}</p><p className="mt-1 text-xs text-muted-foreground">PNG or ICO · Recommended 32 × 32 px</p></div>
              <Button type="button" variant="outline" onClick={() => faviconInput.current?.click()}><UploadIcon data-icon="inline-start" /> Change</Button>
              <input ref={faviconInput} type="file" accept="image/png,image/x-icon,image/vnd.microsoft.icon" className="sr-only" onChange={(e) => onFileChange(e, setFaviconName)} aria-label="Choose browser favicon" />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">File selection updates this preview only. Connect your asset storage to publish uploads.</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/35">
          <CardContent className="flex gap-3 p-4"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground"><CheckCircle2Icon className="size-4" /></div><div><p className="text-sm font-medium">Workspace defaults</p><p className="mt-1 text-xs leading-5 text-muted-foreground">These preferences establish the default display format for administrators. User-specific preferences may override them where supported.</p></div></CardContent>
        </Card>
      </div>
    </div>
    <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="min-h-5 text-sm" aria-live="polite">{saved ? <span className="inline-flex items-center gap-2 text-emerald-600"><CheckCircle2Icon className="size-4" /> Changes saved in this prototype.</span> : <span className="text-muted-foreground">Changes are local to this prototype until connected to a settings API.</span>}</div>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={reset}><XIcon data-icon="inline-start" /> Reset</Button><Button type="submit"><SaveIcon data-icon="inline-start" /> Save changes</Button></div>
    </div>
  </form>;
}

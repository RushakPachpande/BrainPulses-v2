import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api-client';
import { Building2Icon, CheckCircle2Icon, LanguagesIcon, SaveIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/auth-context';
import { canManageUsersOrSettings } from '@/lib/access';
import { getSettingsGroup, patchSettingsGroup } from '@/services';

const initialSettings = {
  platformName: 'BrainPulses',
  organization: 'BrainPulses Learning Pvt. Ltd.',
  timezone: 'Asia/Kolkata',
  dateFormat: 'DD MMM YYYY',
  timeFormat: '12-hour',
  language: 'English',
};

const LOCALE_TO_LANGUAGE: Record<string, string> = {
  'en-IN': 'English',
  en: 'English',
  'hi-IN': 'Hindi',
  hi: 'Hindi',
  'mr-IN': 'Marathi',
  mr: 'Marathi',
};

const LANGUAGE_TO_LOCALE: Record<string, string> = {
  English: 'en-IN',
  Hindi: 'hi-IN',
  Marathi: 'mr-IN',
};

function localeToLanguage(locale: string, fallback: string) {
  return LOCALE_TO_LANGUAGE[locale] ?? LOCALE_TO_LANGUAGE[locale.split('-')[0] ?? ''] ?? fallback;
}

function languageToLocale(language: string) {
  return LANGUAGE_TO_LOCALE[language] ?? language;
}

function SettingField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Field className="gap-2">
      <FieldLabel className="text-sm font-medium">{label}</FieldLabel>
      {children}
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </Field>
  );
}

export function GeneralSettingsPage() {
  const auth = useAuth();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canManage = canManageUsersOrSettings(membership);
  const [settings, setSettings] = useState(initialSettings);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getSettingsGroup('general')
      .then(({ values }) => {
        setSettings((current) => ({
          ...current,
          platformName: String(values.orgDisplayName ?? current.platformName),
          organization: String(values.organizationName ?? current.organization),
          timezone: String(values.timezone ?? current.timezone),
          dateFormat: String(values.dateFormat ?? current.dateFormat),
          timeFormat: String(values.timeFormat ?? current.timeFormat),
          language: localeToLanguage(String(values.locale ?? ''), current.language),
        }));
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  function update(key: keyof typeof initialSettings, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true);
    try {
      await patchSettingsGroup('general', {
        orgDisplayName: settings.platformName,
        organizationName: settings.organization,
        timezone: settings.timezone,
        dateFormat: settings.dateFormat,
        timeFormat: settings.timeFormat,
        locale: languageToLocale(settings.language),
      });
      setSaved(true);
      toast.success('General settings saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }
  function reset() {
    setSettings(initialSettings);
    setSaved(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-5">
      <Card className="bg-muted/35">
        <CardContent className="flex gap-3 p-4 sm:items-center">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
            <CheckCircle2Icon className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Workspace defaults</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              These preferences set the default display format for administrators. User-specific
              preferences may override them where supported.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2Icon className="size-5" />
            </span>
            <div>
              <CardTitle>Organization details</CardTitle>
              <CardDescription className="mt-1">
                Set the name and identity used throughout your workspace.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-5 sm:px-6">
          <FieldGroup className="gap-5 md:grid md:grid-cols-2 md:gap-x-5">
            <SettingField
              label="Platform name"
              hint="Shown on the organization chooser as product branding."
            >
              <Input
                value={settings.platformName}
                onChange={(e) => update('platformName', e.target.value)}
                autoComplete="organization-title"
                required
              />
            </SettingField>
            <SettingField
              label="Organization name"
              hint="Shown when choosing an organization after sign-in."
            >
              <Input
                value={settings.organization}
                onChange={(e) => update('organization', e.target.value)}
                autoComplete="organization"
                required
              />
            </SettingField>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LanguagesIcon className="size-5" />
            </span>
            <div>
              <CardTitle>Regional preferences</CardTitle>
              <CardDescription className="mt-1">
                Choose how dates, times and language appear across the platform.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
            <SettingField label="Time zone">
              <Select value={settings.timezone} onValueChange={(v) => update('timezone', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Asia/Kolkata">India Standard Time (UTC+05:30)</SelectItem>
                    <SelectItem value="UTC">Coordinated Universal Time (UTC)</SelectItem>
                    <SelectItem value="Europe/London">London (UTC+00:00 / UTC+01:00)</SelectItem>
                    <SelectItem value="America/New_York">
                      New York (UTC−05:00 / UTC−04:00)
                    </SelectItem>
                    <SelectItem value="Asia/Singapore">Singapore (UTC+08:00)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </SettingField>
            <SettingField label="Date format">
              <Select value={settings.dateFormat} onValueChange={(v) => update('dateFormat', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD MMM YYYY">DD MMM YYYY · 13 Oct 2026</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY · 13/10/2026</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY · 10/13/2026</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD · 2026-10-13</SelectItem>
                </SelectContent>
              </Select>
            </SettingField>
            <SettingField label="Time format">
              <Select value={settings.timeFormat} onValueChange={(v) => update('timeFormat', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12-hour">12-hour · 2:30 PM</SelectItem>
                  <SelectItem value="24-hour">24-hour · 14:30</SelectItem>
                </SelectContent>
              </Select>
            </SettingField>
            <SettingField label="Language">
              <Select value={settings.language} onValueChange={(v) => update('language', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Hindi">Hindi</SelectItem>
                  <SelectItem value="Marathi">Marathi</SelectItem>
                </SelectContent>
              </Select>
            </SettingField>
          </div>
        </CardContent>
      </Card>
      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-h-5 text-sm" aria-live="polite">
          {saved ? (
            <span className="inline-flex items-center gap-2 text-emerald-600">
              <CheckCircle2Icon className="size-4" /> Changes saved in this prototype.
            </span>
          ) : (
            <span className="text-muted-foreground">
              Changes are saved to the organization settings API.
            </span>
          )}
        </div>
        <div className="flex justify-end gap-2">
          {canManage ? (
            <>
              <Button type="button" variant="outline" onClick={reset}>
                <XIcon data-icon="inline-start" /> Reset
              </Button>
              <Button type="submit" disabled={saving}>
                <SaveIcon data-icon="inline-start" /> Save changes
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">View only — settings cannot be changed.</p>
          )}
        </div>
      </div>
    </form>
  );
}

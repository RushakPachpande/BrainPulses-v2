import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api-client';
import {
  Building2Icon,
  CheckCircle2Icon,
  ImageIcon,
  LanguagesIcon,
  PanelsTopLeftIcon,
  SaveIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
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
import { Switch } from '@/components/ui/switch';
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

const studentPageToggles = [
  {
    key: 'overview',
    label: 'Overview',
    hint: 'Home page with progress, goals, and recent activity.',
  },
  {
    key: 'quizzes',
    label: 'My quizzes',
    hint: 'Quiz list, quiz details, and quiz attempts.',
  },
  {
    key: 'assessments',
    label: 'Assessments',
    hint: 'Assessment list, details, and assessment attempts.',
  },
  {
    key: 'results',
    label: 'My results',
    hint: 'Scores and result details.',
  },
  {
    key: 'profile',
    label: 'My profile',
    hint: 'Name and account details.',
  },
  {
    key: 'help',
    label: 'Help centre',
    hint: 'Help articles for students.',
  },
] as const;

type StudentPageKey = (typeof studentPageToggles)[number]['key'];

const initialPages: Record<StudentPageKey, boolean> = {
  overview: true,
  quizzes: true,
  assessments: true,
  results: true,
  profile: true,
  help: true,
};

function pageEnabled(value: unknown) {
  return typeof value === 'boolean' ? value : true;
}

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
  const [pages, setPages] = useState(initialPages);
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
        setPages({
          overview: pageEnabled(values.studentPageOverview),
          quizzes: pageEnabled(values.studentPageQuizzes),
          assessments: pageEnabled(values.studentPageAssessments),
          results: pageEnabled(values.studentPageResults),
          profile: pageEnabled(values.studentPageProfile),
          help: pageEnabled(values.studentPageHelp),
        });
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const faviconInput = useRef<HTMLInputElement>(null);
  const logoName = logoFile?.name ?? 'brainpulses-logo.svg';
  const faviconName = faviconFile?.name ?? 'favicon-32.png';

  useEffect(() => {
    if (!logoFile) return;
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => {
      URL.revokeObjectURL(url);
      setLogoPreview(null);
    };
  }, [logoFile]);

  useEffect(() => {
    if (!faviconFile) return;
    const url = URL.createObjectURL(faviconFile);
    setFaviconPreview(url);
    return () => {
      URL.revokeObjectURL(url);
      setFaviconPreview(null);
    };
  }, [faviconFile]);

  function update(key: keyof typeof initialSettings, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }
  function onFileChange(event: ChangeEvent<HTMLInputElement>, setFile: (file: File) => void) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFile(file);
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
        studentPageOverview: pages.overview,
        studentPageQuizzes: pages.quizzes,
        studentPageAssessments: pages.assessments,
        studentPageResults: pages.results,
        studentPageProfile: pages.profile,
        studentPageHelp: pages.help,
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
    setPages(initialPages);
    setLogoFile(null);
    setFaviconFile(null);
    if (logoInput.current) logoInput.current.value = '';
    if (faviconInput.current) faviconInput.current.value = '';
    setSaved(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-5">
      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
        <div className="flex min-w-0 flex-col gap-5">
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
              <FieldGroup className="gap-5">
                <SettingField
                  label="Platform name"
                  hint="Displayed in the application header and browser title."
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
                  hint="The organization that owns this BrainPulses workspace."
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
                  <PanelsTopLeftIcon className="size-5" />
                </span>
                <div>
                  <CardTitle>Student portal pages</CardTitle>
                  <CardDescription className="mt-1">
                    Turn student navigation pages on or off. A page stays hidden until you turn it
                    back on.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 py-1 sm:px-6">
              {studentPageToggles.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-4 border-b border-border/70 py-4 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                      {item.hint}
                    </p>
                  </div>
                  <Switch
                    checked={pages[item.key]}
                    onCheckedChange={(next) => {
                      setPages((current) => ({ ...current, [item.key]: next }));
                      setSaved(false);
                    }}
                    disabled={!canManage}
                    aria-label={item.label}
                  />
                </div>
              ))}
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
              <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
                <SettingField label="Time zone">
                  <Select value={settings.timezone} onValueChange={(v) => update('timezone', v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="Asia/Kolkata">
                          India Standard Time (UTC+05:30)
                        </SelectItem>
                        <SelectItem value="UTC">Coordinated Universal Time (UTC)</SelectItem>
                        <SelectItem value="Europe/London">
                          London (UTC+00:00 / UTC+01:00)
                        </SelectItem>
                        <SelectItem value="America/New_York">
                          New York (UTC−05:00 / UTC−04:00)
                        </SelectItem>
                        <SelectItem value="Asia/Singapore">Singapore (UTC+08:00)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </SettingField>
                <SettingField label="Date format">
                  <Select
                    value={settings.dateFormat}
                    onValueChange={(v) => update('dateFormat', v)}
                  >
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
                  <Select
                    value={settings.timeFormat}
                    onValueChange={(v) => update('timeFormat', v)}
                  >
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
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ImageIcon className="size-5" />
                </span>
                <div>
                  <CardTitle>Brand assets</CardTitle>
                  <CardDescription className="mt-1">
                    Manage the logo and browser favicon for your workspace.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 px-5 py-5 sm:px-6">
              <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/70 p-4 sm:flex-row sm:items-center">
                <div className="w-24 shrink-0">
                  <AspectRatio
                    ratio={1}
                    className="overflow-hidden rounded-xl border border-border bg-primary"
                  >
                    <img
                      src={logoPreview ?? '/brand.svg'}
                      alt="BrainPulses logo preview"
                      className="size-full object-contain p-2"
                    />
                  </AspectRatio>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Application logo</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{logoName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    SVG or PNG · Use a transparent background
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={() => logoInput.current?.click()}>
                  <UploadIcon data-icon="inline-start" /> Change
                </Button>
                <input
                  ref={logoInput}
                  type="file"
                  accept="image/svg+xml,image/png"
                  className="sr-only"
                  onChange={(e) => onFileChange(e, setLogoFile)}
                  aria-label="Choose application logo"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/70 p-4 sm:flex-row sm:items-center">
                <div className="w-24 shrink-0">
                  <AspectRatio
                    ratio={1}
                    className="overflow-hidden rounded-xl border border-border bg-muted"
                  >
                    <img
                      src={faviconPreview ?? '/brand.svg'}
                      alt="Favicon preview"
                      className="size-full object-contain p-4"
                    />
                  </AspectRatio>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Browser favicon</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{faviconName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG or ICO · Recommended 32 × 32 px
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => faviconInput.current?.click()}
                >
                  <UploadIcon data-icon="inline-start" /> Change
                </Button>
                <input
                  ref={faviconInput}
                  type="file"
                  accept="image/png,image/x-icon,image/vnd.microsoft.icon"
                  className="sr-only"
                  onChange={(e) => onFileChange(e, setFaviconFile)}
                  aria-label="Choose browser favicon"
                />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                File selection updates this preview only. Connect your asset storage to publish
                uploads.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-muted/35">
            <CardContent className="flex gap-3 p-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
                <CheckCircle2Icon className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Workspace defaults</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  These preferences establish the default display format for administrators.
                  User-specific preferences may override them where supported.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
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

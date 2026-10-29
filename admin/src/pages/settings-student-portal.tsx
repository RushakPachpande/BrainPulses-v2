import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { CheckCircle2Icon, PanelsTopLeftIcon, SaveIcon, XIcon } from 'lucide-react';
import { SettingsListSkeleton } from '@/components/loading-skeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api-client';
import { canManageUsersOrSettings } from '@/lib/access';
import { getSettingsGroup, patchSettingsGroup } from '@/services';

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

export function StudentPortalSettingsPage() {
  const auth = useAuth();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canManage = canManageUsersOrSettings(membership);
  const [pages, setPages] = useState(initialPages);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getSettingsGroup('general')
      .then(({ values }) => {
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
      })
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true);
    try {
      await patchSettingsGroup('general', {
        studentPageOverview: pages.overview,
        studentPageQuizzes: pages.quizzes,
        studentPageAssessments: pages.assessments,
        studentPageResults: pages.results,
        studentPageProfile: pages.profile,
        studentPageHelp: pages.help,
      });
      setSaved(true);
      toast.success('Student portal settings saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setPages(initialPages);
    setSaved(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-5">
      <Card>
        <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PanelsTopLeftIcon className="size-5" />
            </span>
            <div>
              <CardTitle>Student portal pages</CardTitle>
              <CardDescription className="mt-1">
                Turn student navigation pages on or off. A page stays hidden until you turn it back
                on.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-1 sm:px-6">
          {loading ? (
            <SettingsListSkeleton rows={6} />
          ) : (
            studentPageToggles.map((item) => (
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
            ))
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-h-5 text-sm" aria-live="polite">
          {saved ? (
            <span className="inline-flex items-center gap-2 text-emerald-600">
              <CheckCircle2Icon className="size-4" /> Changes saved.
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
              <Button type="button" variant="outline" onClick={reset} disabled={loading}>
                <XIcon data-icon="inline-start" /> Reset
              </Button>
              <Button type="submit" disabled={saving || loading}>
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

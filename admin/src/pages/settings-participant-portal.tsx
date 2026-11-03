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

const participantPageToggles = [
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
    hint: 'Help articles for participants.',
  },
] as const;

type ParticipantPageKey = (typeof participantPageToggles)[number]['key'];

const initialPages: Record<ParticipantPageKey, boolean> = {
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

export function ParticipantPortalSettingsPage() {
  const auth = useAuth();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canManage = canManageUsersOrSettings(membership);
  const [pages, setPages] = useState(initialPages);
  const [phoneLogin, setPhoneLogin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getSettingsGroup('general')
      .then(({ values }) => {
        setPages({
          overview: pageEnabled(values.participantPageOverview),
          quizzes: pageEnabled(values.participantPageQuizzes),
          assessments: pageEnabled(values.participantPageAssessments),
          results: pageEnabled(values.participantPageResults),
          profile: pageEnabled(values.participantPageProfile),
          help: pageEnabled(values.participantPageHelp),
        });
        setPhoneLogin(pageEnabled(values.participantPhoneLogin));
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
        participantPageOverview: pages.overview,
        participantPageQuizzes: pages.quizzes,
        participantPageAssessments: pages.assessments,
        participantPageResults: pages.results,
        participantPageProfile: pages.profile,
        participantPageHelp: pages.help,
        participantPhoneLogin: phoneLogin,
      });
      setSaved(true);
      toast.success('Participant portal settings saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setPages(initialPages);
    setPhoneLogin(true);
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
              <CardTitle>Participant portal pages</CardTitle>
              <CardDescription className="mt-1">
                Turn participant navigation pages on or off. A page stays hidden until you turn it
                back on.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-1 sm:px-6">
          {loading ? (
            <SettingsListSkeleton rows={6} />
          ) : (
            participantPageToggles.map((item) => (
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

      <Card>
        <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PanelsTopLeftIcon className="size-5" />
            </span>
            <div>
              <CardTitle>Sign-in methods</CardTitle>
              <CardDescription className="mt-1">
                Choose how participants can sign in to the portal.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-1 sm:px-6">
          {loading ? (
            <SettingsListSkeleton rows={1} />
          ) : (
            <div className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Phone login</p>
                <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                  Allow participants to sign in with a mobile number and OTP. Unique ID sign-in stays
                  available.
                </p>
              </div>
              <Switch
                checked={phoneLogin}
                onCheckedChange={(next) => {
                  setPhoneLogin(next);
                  setSaved(false);
                }}
                disabled={!canManage}
                aria-label="Phone login"
              />
            </div>
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

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleXIcon,
  EyeIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SaveIcon,
  SendIcon,
  SmartphoneIcon,
  SunIcon,
  TriangleAlertIcon,
  UnlockIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminPasswordDialog } from '@/components/admin-password-dialog';
import { ContestFormBuilder } from '@/components/contest-form-builder';
import { ContestFormCreateDialog } from '@/components/contest-form-create-dialog';
import { ContestFormPreview } from '@/components/contest-form-preview';
import { ContestFormRules, Note } from '@/components/contest-form-rules';
import { ContestFormSettingsPanel } from '@/components/contest-form-settings-panel';
import { ContestFormShareCard } from '@/components/contest-form-share-card';
import { ContestFormSummary } from '@/components/contest-form-summary';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { ToggleRow } from '@/components/toggle-row';
import { useConfirm } from '@/components/use-confirm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { PageHeaderActions } from '@/contexts/page-header';
import { useOrgId } from '@/hooks/use-org-id';
import { ApiError } from '@/lib/api-client';
import { isInstructionsEmpty, sanitizeInstructionsHtml } from '@/lib/sanitize-html';
import {
  cleanDomain,
  domainMessagePreview,
  emptyDraft,
  emptyThankYou,
  endsBeforeClose,
  formActivityIds,
  normalizeFields,
  normalizeRule,
  validateBuilder,
  type ContestFormQuiz,
  type ContestFormRecord,
  type FieldIssue,
} from '@/lib/contest-form';
import { adminQueryKeys, STALE_MS } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { getContests, getSponsors } from '@/services';
import {
  confirmContestFormPassword,
  createContestForm,
  getContestForm,
  getContestQuizzes,
  regenerateContestFormLink,
  updateContestForm,
  type SaveContestFormPayload,
} from '@/services/contest-forms';

type Draft = ReturnType<typeof emptyDraft> & { id?: string };
type Step = 1 | 2 | 3;

const STEPS: { n: Step; title: string; sub: string }[] = [
  { n: 1, title: 'Build Registration Form', sub: 'Create and design the registration form' },
  { n: 2, title: 'Contest & Quiz Mapping', sub: 'Assign quizzes based on registration responses' },
  { n: 3, title: 'Review & Publish', sub: 'Verify details and publish' },
];
const STEP_TEXT: Record<Step, [string, string]> = {
  1: [
    'Build Registration Form',
    'Add fields, set the registration window and write the thank-you message.',
  ],
  2: [
    'Contest & Quiz Mapping',
    'Choose how quizzes and assessments will be assigned to participants.',
  ],
  3: ['Review & Publish Registration Form', 'Check the details, then publish to get the link.'],
};
const STEP2_ISSUES = ['rules', 'allowedDomains', 'domainMessage'];

export function ContestFormWizardPage({ mode }: { mode: 'create' | 'edit' }) {
  const { formId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const orgId = useOrgId();
  const [step, setStep] = useState<Step>(params.get('step') === '2' ? 2 : 1);
  const [draft, setDraft] = useState<Draft>(() => ({
    ...emptyDraft(),
    sponsorId: params.get('sponsor'),
    contestId: params.get('contest'),
  }));
  const [saved, setSaved] = useState<Draft | null>(null);
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [busy, setBusy] = useState(false);
  const [coreUnlocked, setCoreUnlocked] = useState(false);
  const [editUnlocked, setEditUnlocked] = useState(mode === 'create');
  const [password, setPassword] = useState<null | 'edit' | 'core'>(null);
  const [passwordError, setPasswordError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const editing = mode === 'edit';

  const sponsors = useQuery({
    queryKey: adminQueryKeys.sponsors(orgId),
    queryFn: ({ signal }) => getSponsors(signal),
    enabled: Boolean(orgId),
    staleTime: STALE_MS,
  });
  const contests = useQuery({
    queryKey: adminQueryKeys.contests(orgId),
    queryFn: ({ signal }) => getContests(undefined, signal),
    enabled: Boolean(orgId),
    staleTime: STALE_MS,
  });
  const existing = useQuery({
    queryKey: ['admin', 'contest-form', formId],
    queryFn: ({ signal }) => getContestForm(formId, signal),
    enabled: editing && Boolean(formId),
  });
  const activitiesQuery = useQuery({
    queryKey: ['admin', 'contest-quizzes', draft.contestId],
    queryFn: ({ signal }) => getContestQuizzes(draft.contestId!, signal),
    enabled: Boolean(draft.contestId),
  });
  const activities = activitiesQuery.data ?? [];

  useEffect(() => {
    if (!existing.data) return;
    const next = recordToDraft(existing.data);
    setDraft(next);
    setSaved(next);
    // Drafts need no gate. Published forms ask once per edit session (remount resets).
    if (existing.data.status !== 'saved') setEditUnlocked(true);
    else if (!editUnlocked) setPassword((current) => current ?? 'edit');
  }, [existing.data, editUnlocked]);

  const sponsorName =
    sponsors.data?.find((sponsor) => sponsor.id === draft.sponsorId)?.name ?? draft.sponsorName;
  const contest = contests.data?.find((item) => item.id === draft.contestId);
  const contestName = contest?.name ?? draft.contestName;
  const contestImage = contest?.imageFileId ?? draft.contestImageFileId;
  const published = draft.status === 'saved';

  const issueMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const issue of issues) if (!map[issue.field]) map[issue.field] = issue.message;
    return map;
  }, [issues]);

  function patch(partial: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function check(saveMode: 'draft' | 'step1' | 'save') {
    const seats = draft.seats == null || Number.isNaN(draft.seats) ? null : draft.seats;
    return validateBuilder({
      mode: saveMode,
      sponsorId: draft.sponsorId,
      contestId: draft.contestId,
      opensAt: draft.opensAt,
      closesAt: draft.closesAt,
      seats,
      fields: draft.fields,
      domainRestriction: draft.domainRestriction,
      allowedDomains: draft.allowedDomains,
      domainMessage: draft.domainMessage,
      assignmentMode: draft.assignmentMode,
      rules: draft.rules,
      ...thankYouFromDraft(draft),
    });
  }

  function showIssues(found: FieldIssue[]) {
    setIssues(found);
    const first = found[0]!;
    const target: Step =
      STEP2_ISSUES.includes(first.field) || first.field.startsWith('rule:') ? 2 : 1;
    setStep(target);
    window.setTimeout(() => {
      document.querySelector(`[data-field="${CSS.escape(first.field)}"]`)?.scrollIntoView({
        block: 'center',
      });
    }, 50);
  }

  async function persist(saveMode: 'draft' | 'step1' | 'save') {
    const found = check(saveMode);
    if (found.length) {
      showIssues(found);
      return null;
    }
    setIssues([]);
    const thankYou = thankYouFromDraft(draft);
    const thankYouHtml = sanitizeInstructionsHtml(thankYou.thankYouHtml);
    const payload: SaveContestFormPayload = {
      mode: saveMode,
      sponsorId: draft.sponsorId,
      contestId: draft.contestId,
      opensAt: draft.opensAt,
      closesAt: draft.closesAt,
      seats: draft.seats == null || Number.isNaN(draft.seats) ? null : draft.seats,
      welcomeMessage: draft.welcomeMessage,
      showContestImage: draft.showContestImage,
      showSponsorName: draft.showSponsorName,
      showRegistrationCloses: draft.showRegistrationCloses,
      showSeatsLeft: draft.showSeatsLeft,
      fields: draft.fields,
      linkActive: draft.linkActive,
      domainRestriction: draft.domainRestriction,
      allowedDomains: draft.allowedDomains,
      domainMessage: draft.domainMessage,
      keepExistingId: draft.keepExistingId,
      matchRule: draft.matchRule,
      assignmentMode: draft.assignmentMode,
      rules: draft.rules,
      fallbackActivityIds: draft.fallbackActivityIds,
      ...(draft.assignmentMode === 'all' ? { quizIds: draft.quizzes.map((quiz) => quiz.id) } : {}),
      thankYouEnabled: thankYou.thankYouEnabled,
      thankYouKind: thankYou.thankYouKind,
      thankYouTitle: thankYou.thankYouTitle.trim() || null,
      thankYouHtml: isInstructionsEmpty(thankYouHtml) ? null : thankYouHtml,
      thankYouImageFileId: thankYou.thankYouImageFileId,
      thankYouShowNextSteps: thankYou.thankYouShowNextSteps,
      thankYouShowQuizzes: thankYou.thankYouShowQuizzes,
      thankYouButtonLabel: thankYou.thankYouButtonLabel.trim() || null,
      thankYouButtonUrl: thankYou.thankYouButtonUrl.trim() || null,
    };
    setBusy(true);
    try {
      const result = draft.id
        ? await updateContestForm(draft.id, payload)
        : await createContestForm(payload);
      const next = recordToDraft(result);
      setDraft(next);
      setSaved(next);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'contest-forms'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'contest-form', result.id] });
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'contest-form-registrants', result.id],
      });
      return result;
    } catch (err) {
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length) {
        showIssues(Object.entries(err.fields).map(([field, message]) => ({ field, message })));
      }
      toast.error(err instanceof ApiError ? err.message : 'Could not save the form.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function goTo(target: Step) {
    if (target === step) return;
    if (target === 1) {
      setStep(1);
      return;
    }
    if (step === 1) {
      // Leaving the builder saves the form so Step 2 can use its fields.
      const result = await persist(published ? 'save' : 'step1');
      if (!result) return;
      if (!draft.id) toast.success('Registration form saved. Next: Contest & Quiz Mapping');
    }
    setIssues([]);
    setStep(target);
  }

  async function onSaveDraft() {
    const result = await persist(published ? 'save' : 'draft');
    if (result) toast.success(published ? 'Changes saved.' : 'Draft saved');
  }

  function mappingChanged() {
    if (!saved) return false;
    const pick = (d: Draft) =>
      JSON.stringify([
        d.assignmentMode,
        d.quizzes.map((quiz) => quiz.id).sort(),
        d.rules,
        [...d.fallbackActivityIds].sort(),
      ]);
    return pick(saved) !== pick(draft);
  }

  async function onPublish() {
    if (published && draft.registrationCount > 0 && mappingChanged()) {
      const people =
        draft.registrationCount === 1 ? '1 person has' : `${draft.registrationCount} people have`;
      const ok = await confirm({
        title: 'Change who gets which quizzes?',
        description: `${people} already registered. When you save, everyone is checked against the new settings.`,
        details: [
          'People get any activity the new settings give them.',
          'Activities the new settings no longer give them are taken away.',
          'Activities someone has already started always stay.',
        ],
        confirmLabel: 'Save changes',
      });
      if (!ok) return;
    }
    const result = await persist('save');
    if (!result) return;
    sessionStorage.setItem('bp-new-form', result.id);
    if (editing) {
      toast.success('Changes saved.');
      navigate(`/participants/forms/${result.id}`);
      return;
    }
    toast.success(`Registration form for ${result.contestName} published. The link is live.`);
    setJustPublished(true);
  }

  async function onRegenerate() {
    if (!draft.id) return;
    const ok = await confirm({
      title: 'Create a new link?',
      description:
        'The old link stops working at once. People who already registered are not affected.',
      confirmLabel: 'Regenerate link',
    });
    if (!ok) return;
    try {
      const next = recordToDraft(await regenerateContestFormLink(draft.id));
      setDraft((current) => ({ ...current, slug: next.slug }));
      toast.success('New link created. The old link no longer works.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create a new link.');
    }
  }

  async function onLinkActive(linkActive: boolean) {
    if (!draft.id) return;
    setBusy(true);
    try {
      const next = recordToDraft(await updateContestForm(draft.id, { mode: 'save', linkActive }));
      setDraft((current) => ({ ...current, linkActive: next.linkActive }));
      toast.success(linkActive ? 'Link turned on.' : 'Link turned off.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not change the link.');
    } finally {
      setBusy(false);
    }
  }

  async function onPassword(value: string) {
    if (!value.trim()) {
      setPasswordError('Enter your password.');
      return;
    }
    setPasswordBusy(true);
    setPasswordError('');
    try {
      await confirmContestFormPassword(value);
      if (password === 'edit') setEditUnlocked(true);
      if (password === 'core') {
        setCoreUnlocked(true);
        toast.success('Contact fields unlocked.');
      }
      setPassword(null);
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Could not check the password.');
    } finally {
      setPasswordBusy(false);
    }
  }

  function leave() {
    navigate(editing && formId ? `/participants/forms/${formId}` : '/participants');
  }

  if (mode === 'create' && (!draft.sponsorId || !draft.contestId)) {
    return (
      <ContestFormCreateDialog
        open
        onOpenChange={(open) => {
          if (!open) navigate('/participants');
        }}
      />
    );
  }
  if (editing && (existing.isPending || !existing.data)) return <ListPageSkeleton />;
  if (!editUnlocked) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>Edit {contestName || 'registration form'}</CardTitle>
            <CardDescription>
              This form is published. Enter your admin password to edit it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button type="button" onClick={() => setPassword('edit')}>
              <UnlockIcon data-icon="inline-start" />
              Enter password
            </Button>
            <Button type="button" variant="outline" onClick={leave}>
              Cancel
            </Button>
          </CardContent>
        </Card>
        <PasswordDialog
          kind={password}
          error={passwordError}
          busy={passwordBusy}
          onClose={() => {
            setPassword(null);
            setPasswordError('');
          }}
          onConfirm={(value) => void onPassword(value)}
        />
      </>
    );
  }

  const thankYou = thankYouFromDraft(draft);
  const formSettings = (
    <ContestFormSettingsPanel
      value={draft}
      issues={issueMap}
      onChange={(partial) => patch(partial)}
    />
  );
  const usedIds = formActivityIds(draft);
  const used = usedIds
    .map((id) => activities.find((activity) => activity.id === id))
    .filter((activity): activity is ContestFormQuiz => Boolean(activity));

  return (
    <div className="flex flex-col gap-4">
      <PageHeaderActions>
        <Button type="button" variant="outline" onClick={leave}>
          Cancel
        </Button>
      </PageHeaderActions>

      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{contestName || 'Contest'}</span>
          {sponsorName ? ` · ${sponsorName}` : ''}
          {published ? ' · Published' : ' · Draft'}
        </p>
        {!justPublished ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void onSaveDraft()}
            >
              <SaveIcon data-icon="inline-start" />
              {published ? 'Save' : 'Save draft'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setPreview(true)}>
              <EyeIcon data-icon="inline-start" />
              Preview
            </Button>
            {step < 3 ? (
              <Button type="button" disabled={busy} onClick={() => void goTo((step + 1) as Step)}>
                {step === 1 ? 'Continue to Mapping' : 'Review & Publish'}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {editing && published ? (
        <Note tone="info" icon={UnlockIcon}>
          You're editing a published form. Changes go live when you press <b>Save changes</b> in
          Step 3. The sponsor and contest can't change.
        </Note>
      ) : null}

      <nav aria-label="Steps" className="rounded-xl border border-border bg-card p-2">
        <ol className="grid gap-1 sm:grid-cols-3">
          {STEPS.map((item) => {
            const current = item.n === step;
            const done = item.n < step || justPublished;
            const reachable = item.n === 1 || Boolean(draft.id) || item.n === step + 1;
            return (
              <li key={item.n}>
                <button
                  type="button"
                  disabled={!reachable || justPublished}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => void goTo(item.n)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg p-2 text-left',
                    current && 'bg-accent',
                    !reachable && 'opacity-60',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                      current || done
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground',
                    )}
                  >
                    {done && !current ? <CheckIcon className="size-4" aria-hidden /> : item.n}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span className="hidden text-xs text-muted-foreground lg:block">
                      {item.sub}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div>
        <h2 className="text-xl font-bold tracking-tight">{STEP_TEXT[step][0]}</h2>
        <p className="mt-1 text-muted-foreground">{STEP_TEXT[step][1]}</p>
      </div>

      {issues.length > 0 ? (
        <p
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          Fix {issues.length} {issues.length === 1 ? 'item' : 'items'} before continuing. They are
          marked in red.
        </p>
      ) : null}

      {step === 1 ? (
        <ContestFormBuilder
          fields={draft.fields}
          contestName={contestName}
          sponsorName={sponsorName}
          welcomeMessage={draft.welcomeMessage}
          showSponsorName={draft.showSponsorName}
          registeredCount={draft.registrationCount}
          issues={issueMap}
          thankYou={thankYou}
          rules={draft.rules}
          coreUnlocked={coreUnlocked}
          formSettings={formSettings}
          onFields={(fields) => patch({ fields })}
          onThankYou={(partial) => patch(partial)}
          onUnlockCore={() => {
            if (!coreUnlocked) setPassword('core');
          }}
        />
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Contest</CardTitle>
              <CardDescription>
                Chosen when you started this form.{' '}
                {published
                  ? "It can't change after publishing."
                  : 'To change it, go back to Registration Forms and start a new form.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{contestName}</p>
              <p className="text-sm text-muted-foreground">
                Sponsor: {sponsorName} · {activities.length} quizzes and assessments in this contest
              </p>
            </CardContent>
          </Card>
          <ContestFormRules
            value={draft}
            fields={draft.fields}
            activities={activities}
            closesAt={draft.closesAt}
            registrationCount={draft.registrationCount}
            live={published}
            issues={issueMap}
            onChange={(partial) => patch(partial)}
            onBackToFields={() => setStep(1)}
          />
          <WhoCanRegister draft={draft} issues={issueMap} onChange={patch} />
          <RegistrationIdSettings draft={draft} onChange={patch} />
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              <ArrowLeftIcon data-icon="inline-start" />
              Back to Form Builder
            </Button>
            <Button type="button" onClick={() => void goTo(3)}>
              Review & Publish
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="flex min-w-0 flex-col gap-4">
            {justPublished && draft.slug ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CircleCheckIcon className="size-5 text-success" aria-hidden />
                      Published
                    </CardTitle>
                    <CardDescription>The form is live. Share the link below.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate('/participants')}
                    >
                      <ArrowLeftIcon data-icon="inline-start" />
                      Back to Registration Forms
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(`/participants/forms/${draft.id}`)}
                    >
                      View form
                    </Button>
                  </CardContent>
                </Card>
                <ContestFormShareCard
                  slug={draft.slug}
                  linkActive={draft.linkActive}
                  contestName={contestName}
                  canMutate
                  busy={busy}
                  onLinkActive={(active) => void onLinkActive(active)}
                  onRegenerate={() => void onRegenerate()}
                />
              </>
            ) : (
              <Checklist
                draft={draft}
                found={check('save')}
                used={used}
                saving={published}
                busy={busy}
                onFix={(target) => setStep(target)}
                onPublish={() => void onPublish()}
              />
            )}
            <Card className="p-0">
              <ContestFormSummary
                form={draft}
                sponsorName={sponsorName}
                contestName={contestName}
                activities={activities}
                onEdit={justPublished ? undefined : (target) => setStep(target)}
              />
            </Card>
          </div>
          <Card className="xl:sticky xl:top-4">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>Form preview</CardTitle>
                  <CardDescription>What participants see on a phone.</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Open full preview"
                  onClick={() => setPreview(true)}
                >
                  <EyeIcon />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ContestFormPreview
                form={{ ...draft, contestImageFileId: contestImage }}
                sponsorName={sponsorName}
                contestName={contestName}
                device="mobile"
                theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                page="form"
                quizzes={used}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      <PreviewDialog
        open={preview}
        onOpenChange={setPreview}
        form={{ ...draft, contestImageFileId: contestImage }}
        sponsorName={sponsorName}
        contestName={contestName}
        quizzes={used}
      />
      <PasswordDialog
        kind={password}
        error={passwordError}
        busy={passwordBusy}
        onClose={() => {
          setPassword(null);
          setPasswordError('');
        }}
        onConfirm={(value) => void onPassword(value)}
      />
    </div>
  );
}

function PasswordDialog({
  kind,
  error,
  busy,
  onClose,
  onConfirm,
}: {
  kind: null | 'edit' | 'core';
  error: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
}) {
  return (
    <AdminPasswordDialog
      open={kind !== null}
      title={kind === 'core' ? 'Unlock contact fields' : 'Edit a published form'}
      description={
        kind === 'core'
          ? 'Enter your admin password to change First name, Last name, Email or Mobile.'
          : 'People may already be registered. Enter your admin password to edit this form.'
      }
      confirmLabel={kind === 'core' ? 'Unlock' : 'Continue to edit'}
      error={error}
      busy={busy}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onConfirm={onConfirm}
    />
  );
}

function Checklist({
  draft,
  found,
  used,
  saving,
  busy,
  onFix,
  onPublish,
}: {
  draft: Draft;
  found: FieldIssue[];
  used: ContestFormQuiz[];
  saving: boolean;
  busy: boolean;
  onFix: (step: Step) => void;
  onPublish: () => void;
}) {
  const has = (test: (field: string) => boolean) => found.some((issue) => test(issue.field));
  const known = new Set([
    'sponsorId',
    'contestId',
    'opensAt',
    'closesAt',
    'seats',
    'rules',
    'allowedDomains',
    'domainMessage',
    'thankYouHtml',
    'thankYouImageFileId',
    'thankYouButtonLabel',
    'thankYouButtonUrl',
  ]);
  const early = used.filter(
    (activity) => activity.availability !== 'Ended' && endsBeforeClose(activity, draft.closesAt),
  );
  const items: { ok: boolean; text: string; step: Step; warn?: boolean }[] = [
    { ok: !has((f) => f === 'sponsorId' || f === 'contestId'), text: 'Contest chosen', step: 1 },
    {
      ok: !has((f) => f === 'opensAt' || f === 'closesAt' || f === 'seats'),
      text: 'Registration window and seats set',
      step: 1,
    },
    {
      ok: !has((f) => !known.has(f) && !f.startsWith('rule:')),
      text: 'Every field is complete',
      step: 1,
    },
    { ok: !has((f) => f.startsWith('thankYou')), text: 'Thank-you page is complete', step: 1 },
  ];
  if (draft.assignmentMode === 'rules') {
    items.push({
      ok: !has((f) => f === 'rules' || f.startsWith('rule:')),
      text: 'Every rule has a field, an answer and at least one activity',
      step: 2,
    });
  } else {
    items.push({
      ok: draft.quizzes.length > 0,
      text: 'Activities chosen (optional: you can add them later)',
      step: 2,
      warn: true,
    });
  }
  if (draft.domainRestriction) {
    items.push({
      ok: !has((f) => f === 'allowedDomains' || f === 'domainMessage'),
      text: 'Allowed email domains and message set',
      step: 2,
    });
  }
  items.push({
    ok: early.length === 0,
    text: early.length
      ? `${early.map((activity) => activity.name).join(', ')} ends before registration closes`
      : 'No activity ends before registration closes',
    step: 2,
    warn: true,
  });
  const blocking = items.filter((item) => !item.ok && !item.warn).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Before you {saving ? 'save' : 'publish'}</CardTitle>
        <CardDescription>
          {blocking
            ? `Fix ${blocking} ${blocking === 1 ? 'item' : 'items'} first.`
            : 'Everything needed is in place.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {items.map((item) => (
          <div key={item.text} className="flex min-h-11 items-center gap-2 text-sm">
            {item.ok ? (
              <CircleCheckIcon className="size-4 shrink-0 text-success" aria-label="Done" />
            ) : item.warn ? (
              <TriangleAlertIcon className="size-4 shrink-0 text-warning" aria-label="Check" />
            ) : (
              <CircleXIcon className="size-4 shrink-0 text-destructive" aria-label="To fix" />
            )}
            <span className="min-w-0 flex-1">{item.text}</span>
            {!item.ok ? (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                onClick={() => onFix(item.step)}
              >
                Fix in Step {item.step}
              </Button>
            ) : null}
          </div>
        ))}
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <Button type="button" variant="outline" onClick={() => onFix(2)}>
            <ArrowLeftIcon data-icon="inline-start" />
            Back to Mapping
          </Button>
          <Button type="button" disabled={blocking > 0 || busy} onClick={onPublish}>
            {saving ? <SaveIcon data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
            {saving ? 'Save changes' : 'Publish Registration Form'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WhoCanRegister({
  draft,
  issues,
  onChange,
}: {
  draft: Draft;
  issues: Record<string, string>;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const [entry, setEntry] = useState('');
  function addDomain(raw: string) {
    const cleaned = cleanDomain(raw);
    if (!cleaned) {
      toast.error(`"${raw.trim()}" isn't a valid domain. Use a form like brainpulses.com.`);
      return;
    }
    if (draft.allowedDomains.includes(cleaned)) {
      toast.message(`@${cleaned} is already listed`);
      return;
    }
    onChange({ allowedDomains: [...draft.allowedDomains, cleaned] });
    setEntry('');
  }
  return (
    <Card data-field="allowedDomains">
      <CardHeader>
        <CardTitle>Who can register</CardTitle>
        <CardDescription>Anyone with the link. Dates and seats are set in Step 1.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ToggleRow
          label="Only allow emails from certain domains"
          checked={draft.domainRestriction}
          onCheckedChange={(domainRestriction) => onChange({ domainRestriction })}
        />
        {draft.domainRestriction ? (
          <>
            <Label htmlFor="domains">
              Allowed domains <span className="text-destructive">*</span>
            </Label>
            {draft.allowedDomains.length ? (
              <ul className="flex flex-wrap gap-2">
                {draft.allowedDomains.map((domain) => (
                  <li
                    key={domain}
                    className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-2.5 text-sm"
                  >
                    @{domain}
                    <button
                      type="button"
                      className="inline-flex size-6 items-center justify-center rounded-full"
                      aria-label={`Remove @${domain}`}
                      onClick={() =>
                        onChange({
                          allowedDomains: draft.allowedDomains.filter((item) => item !== domain),
                        })
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="domains"
                value={entry}
                placeholder={draft.allowedDomains.length ? 'Add another' : 'brainpulses.com'}
                aria-invalid={Boolean(issues.allowedDomains) || undefined}
                aria-describedby="domains-hint"
                className="min-w-0 flex-1"
                onChange={(event) => setEntry(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
                    event.preventDefault();
                    if (entry.trim()) addDomain(entry);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={!entry.trim()}
                onClick={() => addDomain(entry)}
              >
                <PlusIcon data-icon="inline-start" />
                Add
              </Button>
            </div>
            <p id="domains-hint" className="text-sm text-muted-foreground">
              Press Enter, comma or space, or use Add. Example: brainpulses.com
            </p>
            {issues.allowedDomains ? (
              <p className="text-sm text-destructive">{issues.allowedDomains}</p>
            ) : null}
            <Label htmlFor="domain-message">
              Message when the domain isn't allowed <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="domain-message"
              data-field="domainMessage"
              maxLength={160}
              value={draft.domainMessage}
              aria-invalid={Boolean(issues.domainMessage) || undefined}
              onChange={(event) => onChange({ domainMessage: event.target.value })}
            />
            {issues.domainMessage ? (
              <p className="text-sm text-destructive">{issues.domainMessage}</p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Participants see:{' '}
              <b>
                {domainMessagePreview(
                  draft.domainMessage,
                  draft.allowedDomains.length ? draft.allowedDomains : ['yourdomain.com'],
                )}
              </b>
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RegistrationIdSettings({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration ID and returning participants</CardTitle>
        <CardDescription>
          Format BP + 8 digits. It is the only login, shown after registering.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ToggleRow
          label="Give returning participants their existing Registration ID"
          checked={draft.keepExistingId}
          onCheckedChange={(keepExistingId) => onChange({ keepExistingId })}
        />
        <RadioGroup
          value={draft.matchRule}
          disabled={!draft.keepExistingId}
          onValueChange={(value) => onChange({ matchRule: value as Draft['matchRule'] })}
          className="grid gap-3 md:grid-cols-2"
        >
          <label
            className={cn(
              'flex gap-3 rounded-xl border p-4 text-sm',
              draft.matchRule === 'name_and_contact' ? 'border-primary' : 'border-border',
              !draft.keepExistingId && 'opacity-60',
            )}
          >
            <RadioGroupItem value="name_and_contact" className="mt-0.5" />
            <span>
              <span className="font-semibold">Name + contact</span>
              <span className="mt-1 block text-muted-foreground">
                First name AND (Email OR Mobile). Safer when people share an email or phone, like
                siblings.
              </span>
            </span>
          </label>
          <label
            className={cn(
              'flex gap-3 rounded-xl border p-4 text-sm',
              draft.matchRule === 'contact_only' ? 'border-primary' : 'border-border',
              !draft.keepExistingId && 'opacity-60',
            )}
          >
            <RadioGroupItem value="contact_only" className="mt-0.5" />
            <span>
              <span className="font-semibold">Contact only</span>
              <span className="mt-1 block text-muted-foreground">
                Email OR Mobile. Catches people who type their name differently. Names aren't
                checked.
              </span>
            </span>
          </label>
        </RadioGroup>
        {draft.keepExistingId && draft.matchRule === 'contact_only' ? (
          <Note tone="warn">
            Because names aren't checked, two people who register with the same email or mobile (for
            example siblings using a parent's number) get the same Registration ID and share one
            login.
          </Note>
        ) : null}
        <p className="text-sm text-muted-foreground">
          A login stays active until an admin deactivates it. It doesn't expire when quizzes end.
        </p>
      </CardContent>
    </Card>
  );
}

function PreviewDialog({
  open,
  onOpenChange,
  form,
  sponsorName,
  contestName,
  quizzes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: Draft;
  sponsorName: string;
  contestName: string;
  quizzes: ContestFormQuiz[];
}) {
  const [page, setPage] = useState<'form' | 'thanks'>('form');
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[92vh] overflow-auto',
          device === 'mobile' ? 'sm:max-w-xl' : 'sm:max-w-5xl',
        )}
      >
        <DialogHeader>
          <DialogTitle>Preview</DialogTitle>
          <DialogDescription>
            Exactly what participants see. Nothing here is submitted.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented
            label="Page"
            value={page}
            onChange={setPage}
            items={[
              ['form', 'Registration page'],
              ['thanks', 'After registering'],
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Segmented
              label="Theme"
              value={theme}
              onChange={setTheme}
              items={[
                ['light', 'Light', SunIcon],
                ['dark', 'Dark', MoonIcon],
              ]}
            />
            <Segmented
              label="Device"
              value={device}
              onChange={setDevice}
              items={[
                ['desktop', 'Desktop', MonitorIcon],
                ['mobile', 'Mobile', SmartphoneIcon],
              ]}
            />
          </div>
        </div>
        <ContestFormPreview
          form={form}
          sponsorName={sponsorName}
          contestName={contestName}
          device={device}
          theme={theme}
          page={page}
          quizzes={quizzes}
        />
        {page === 'form' ? (
          <p className="text-sm text-muted-foreground">
            Press Register to check the required fields. Nothing is saved.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Shows sample details. The real page shows the person's name and Registration ID.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Segmented<T extends string>({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: T;
  items: [T, string, typeof SunIcon?][];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-lg border border-border bg-muted p-1"
    >
      {items.map(([key, text, Icon]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          className={cn(
            'inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium',
            value === key ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground',
          )}
          onClick={() => onChange(key)}
        >
          {Icon ? <Icon className="size-4" aria-hidden /> : null}
          {text}
        </button>
      ))}
    </div>
  );
}

function thankYouFromDraft(draft: Draft) {
  return {
    thankYouEnabled: draft.thankYouEnabled,
    thankYouKind: draft.thankYouKind,
    thankYouTitle: draft.thankYouTitle ?? '',
    thankYouHtml: draft.thankYouHtml ?? '',
    thankYouImageFileId: draft.thankYouImageFileId,
    thankYouShowNextSteps: draft.thankYouShowNextSteps,
    thankYouShowQuizzes: draft.thankYouShowQuizzes,
    thankYouButtonLabel: draft.thankYouButtonLabel ?? '',
    thankYouButtonUrl: draft.thankYouButtonUrl ?? '',
  };
}

function recordToDraft(record: ContestFormRecord): Draft {
  return {
    id: record.id,
    status: record.status,
    sponsorId: record.sponsorId,
    sponsorName: record.sponsorName,
    sponsorImageFileId: record.sponsorImageFileId,
    contestId: record.contestId,
    contestName: record.contestName,
    contestImageFileId: record.contestImageFileId,
    opensAt: record.opensAt,
    closesAt: record.closesAt,
    seats: record.seats,
    welcomeMessage: record.welcomeMessage ?? '',
    showContestImage: record.showContestImage,
    showSponsorName: record.showSponsorName,
    showRegistrationCloses: record.showRegistrationCloses,
    showSeatsLeft: record.showSeatsLeft,
    fields: normalizeFields(record.fields),
    slug: record.slug,
    linkActive: record.linkActive,
    domainRestriction: record.domainRestriction,
    allowedDomains: record.allowedDomains,
    domainMessage: record.domainMessage,
    keepExistingId: record.keepExistingId,
    matchRule: record.matchRule,
    assignmentMode: record.assignmentMode ?? 'all',
    rules: (record.rules ?? []).map((rule) => normalizeRule(rule)),
    fallbackActivityIds: record.fallbackActivityIds ?? [],
    ...emptyThankYou(),
    thankYouEnabled: record.thankYouEnabled ?? false,
    thankYouKind: record.thankYouKind ?? 'template',
    thankYouTitle: record.thankYouTitle ?? '',
    thankYouHtml: record.thankYouHtml ?? '',
    thankYouImageFileId: record.thankYouImageFileId ?? null,
    thankYouShowNextSteps: record.thankYouShowNextSteps ?? false,
    thankYouShowQuizzes: record.thankYouShowQuizzes ?? false,
    thankYouButtonLabel: record.thankYouButtonLabel ?? '',
    thankYouButtonUrl: record.thankYouButtonUrl ?? '',
    registrationCount: record.registrationCount,
    // In rules mode the server's list is everything the rules can give; the ticked list starts empty.
    quizzes: (record.assignmentMode ?? 'all') === 'all' ? record.quizzes : [],
  };
}

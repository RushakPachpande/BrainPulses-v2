import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AdminPasswordDialog } from '@/components/admin-password-dialog';
import { ContestFormFields } from '@/components/contest-form-fields';
import { ContestFormPreview } from '@/components/contest-form-preview';
import { useConfirm } from '@/components/use-confirm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import {
  PREVIEW_WIDTH_KEY,
  cleanDomain,
  domainMessagePreview,
  emptyDraft,
  formatIst,
  fromIstInput,
  registrationUrl,
  toIstInput,
  validateBuilder,
  type ContestFormQuiz,
  type ContestFormRecord,
  type FieldIssue,
} from '@/lib/contest-form';
import { adminQueryKeys, STALE_MS } from '@/lib/query-keys';
import { useOrgId } from '@/hooks/use-org-id';
import { getContests, getSponsors } from '@/services';
import {
  createContestForm,
  getContestForm,
  getContestFormOverview,
  getContestQuizzes,
  regenerateContestFormLink,
  updateContestForm,
  verifyContestFormPassword,
  type SaveContestFormPayload,
} from '@/services/contest-forms';

type Draft = ReturnType<typeof emptyDraft> & { id?: string };

export function ContestFormWizardPage({ mode }: { mode: 'create' | 'edit' }) {
  const { formId = '' } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const orgId = useOrgId();
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(mode === 'edit');
  const passwordAccepted = useRef(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [previewWidth, setPreviewWidth] = useState(520);
  const [fullPreview, setFullPreview] = useState(false);
  const [domainDraft, setDomainDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const editingSaved = mode === 'edit';

  const sponsors = useQuery({
    queryKey: adminQueryKeys.sponsors(orgId),
    queryFn: () => getSponsors(),
    enabled: Boolean(orgId),
    staleTime: STALE_MS,
  });
  const contests = useQuery({
    queryKey: adminQueryKeys.contests(orgId),
    queryFn: () => getContests(),
    enabled: Boolean(orgId),
    staleTime: STALE_MS,
  });
  const overview = useQuery({
    queryKey: ['admin', 'contest-forms', orgId],
    queryFn: () => getContestFormOverview(),
    enabled: Boolean(orgId),
  });
  const existing = useQuery({
    queryKey: ['admin', 'contest-form', formId],
    queryFn: () => getContestForm(formId),
    enabled: mode === 'edit' && Boolean(formId) && Boolean(password),
  });

  useEffect(() => {
    const stored = Number(localStorage.getItem(PREVIEW_WIDTH_KEY));
    if (stored >= 340) setPreviewWidth(stored);
  }, []);

  useEffect(() => {
    if (!existing.data) return;
    setDraft(recordToDraft(existing.data));
  }, [existing.data]);

  const takenContests = new Set(
    (overview.data?.forms ?? [])
      .filter((form) => form.contestId && form.id !== draft.id)
      .map((form) => form.contestId),
  );
  const sponsorContests = (contests.data ?? []).filter(
    (contest) => contest.sponsorId === draft.sponsorId,
  );
  const sponsorName =
    sponsors.data?.find((sponsor) => sponsor.id === draft.sponsorId)?.name ?? draft.sponsorName;
  const contestName =
    contests.data?.find((contest) => contest.id === draft.contestId)?.name ?? draft.contestName;
  const contestImage =
    contests.data?.find((contest) => contest.id === draft.contestId)?.imageFileId ??
    draft.contestImageFileId;

  const quizzes = useQuery({
    queryKey: ['admin', 'contest-quizzes', draft.contestId],
    queryFn: () => getContestQuizzes(draft.contestId!),
    enabled: Boolean(draft.contestId) && step === 2,
  });

  const issueMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const issue of issues) if (!map[issue.field]) map[issue.field] = issue.message;
    return map;
  }, [issues]);

  function patch(partial: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function rememberWidth(width: number) {
    const next = Math.max(340, Math.min(width, 900));
    setPreviewWidth(next);
    localStorage.setItem(PREVIEW_WIDTH_KEY, String(next));
  }

  async function persist(saveMode: 'draft' | 'step1' | 'save') {
    const seats = draft.seats == null || Number.isNaN(draft.seats) ? null : draft.seats;
    const check = validateBuilder({
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
    });
    if (check.length) {
      setIssues(check);
      const first = document.querySelector(`[data-field="${check[0]!.field}"]`);
      first?.scrollIntoView({ block: 'center' });
      return null;
    }
    setIssues([]);
    const payload: SaveContestFormPayload = {
      mode: saveMode,
      password: password || undefined,
      sponsorId: draft.sponsorId,
      contestId: draft.contestId,
      opensAt: draft.opensAt,
      closesAt: draft.closesAt,
      seats,
      welcomeMessage: draft.welcomeMessage,
      showContestImage: draft.showContestImage,
      showSponsorName: draft.showSponsorName,
      showRegistrationCloses: draft.showRegistrationCloses,
      showSeatsLeft: draft.showSeatsLeft,
      fields: draft.fields,
      linkActive: draft.linkActive,
      emailOnQuiz: draft.emailOnQuiz,
      domainRestriction: draft.domainRestriction,
      allowedDomains: draft.allowedDomains,
      domainMessage: draft.domainMessage,
      keepExistingId: draft.keepExistingId,
      matchRule: draft.matchRule,
      quizIds: draft.quizzes.map((quiz) => quiz.id),
    };
    setBusy(true);
    try {
      const saved = draft.id
        ? await updateContestForm(draft.id, payload)
        : await createContestForm(payload);
      setDraft(recordToDraft(saved));
      setUnlocked(false);
      return saved;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not save the form.';
      toast.error(message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onContinue() {
    const saved = await persist('step1');
    if (!saved) return;
    toast.success('Registration form saved. Next: Assignment Rules');
    setStep(2);
  }

  async function onDraft() {
    const saved = await persist('draft');
    if (saved) toast.success('Draft saved');
  }

  async function onSave() {
    const saved = await persist('save');
    if (!saved) return;
    sessionStorage.setItem('bp-new-form', saved.id);
    if (mode === 'edit') {
      toast.success('Changes saved.');
      navigate(`/participants/forms/${saved.id}`);
      return;
    }
    const quizNote =
      saved.quizzes.length === 0
        ? ' The link is live; give a quiz later from the form.'
        : ' The link is live.';
    toast.success(`Registration form for ${saved.contestName} saved.${quizNote}`);
    navigate('/participants');
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
      const saved = await regenerateContestFormLink(draft.id);
      setDraft(recordToDraft(saved));
      toast.success('New link created. The old link no longer works.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create a new link.');
    }
  }

  async function copyLink() {
    if (!draft.slug) return;
    await navigator.clipboard.writeText(registrationUrl(draft.slug));
    toast.success('Link copied');
  }

  function addDomain(raw: string) {
    const cleaned = cleanDomain(raw);
    if (!cleaned) {
      toast.error(`"${raw.trim()}" isn't a valid domain. Use a form like infosys.com.`);
      return;
    }
    if (draft.allowedDomains.includes(cleaned)) {
      toast.message(`@${cleaned} is already listed`);
      return;
    }
    patch({ allowedDomains: [...draft.allowedDomains, cleaned] });
    setDomainDraft('');
  }

  if (mode === 'edit' && !password) {
    return (
      <AdminPasswordDialog
        open={passwordOpen}
        title="Enter your admin password"
        description="Editing needs the password you use to sign in to the admin portal."
        confirmLabel="Continue to edit"
        error={passwordError}
        busy={passwordBusy}
        onOpenChange={(open) => {
          setPasswordOpen(open);
          if (!open && !passwordAccepted.current) {
            navigate(formId ? `/participants/forms/${formId}` : '/participants');
          }
        }}
        onConfirm={(value) => {
          if (!value.trim()) {
            setPasswordError('Enter your password.');
            return;
          }
          setPasswordBusy(true);
          void verifyContestFormPassword(value)
            .then(() => {
              passwordAccepted.current = true;
              setPassword(value);
              setPasswordError('');
              setPasswordOpen(false);
            })
            .catch((err: unknown) => {
              setPassword('');
              setPasswordError(err instanceof ApiError ? err.message : 'Incorrect password.');
            })
            .finally(() => setPasswordBusy(false));
        }}
      />
    );
  }

  const linkLabel = draft.slug ? registrationUrl(draft.slug) : 'Live after you save';

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Steps">
        <li>
          <button
            type="button"
            className={step === 1 ? 'font-semibold' : 'text-muted-foreground'}
            onClick={() => setStep(1)}
          >
            1 Registration Form
          </button>
        </li>
        <li aria-hidden>/</li>
        <li>
          <button
            type="button"
            className={step === 2 ? 'font-semibold' : 'text-muted-foreground'}
            disabled={step === 1 && !draft.id}
            onClick={() => draft.id && setStep(2)}
          >
            2 Assignment Rules
          </button>
        </li>
      </ol>
      {issues.length > 0 ? (
        <p
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          Fix {issues.length} fields before continuing. They are marked in red below.
        </p>
      ) : null}
      {step === 1 ? (
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <Card className="min-w-0 flex-1">
            <CardHeader>
              <CardTitle>Registration Form · Step 1 of 2</CardTitle>
              <CardDescription>
                Participants fill this form once, when they first open the contest's link. Quizzes
                are given to them in the next step, now or later. The live preview shows exactly
                what they'll see.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="grid gap-4 md:grid-cols-2" data-field="sponsorId">
                <div>
                  <Label htmlFor="sponsor">Sponsor</Label>
                  <Select
                    value={draft.sponsorId ?? ''}
                    disabled={editingSaved}
                    onValueChange={(value) =>
                      patch({ sponsorId: value, contestId: null, contestName: '' })
                    }
                  >
                    <SelectTrigger
                      id="sponsor"
                      className="mt-1 w-full"
                      aria-invalid={Boolean(issueMap.sponsorId) || undefined}
                    >
                      <SelectValue placeholder="Choose a sponsor" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sponsors.data ?? []).map((sponsor) => (
                        <SelectItem key={sponsor.id} value={sponsor.id}>
                          {sponsor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editingSaved ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      The sponsor and contest can't change once the form is saved.
                    </p>
                  ) : null}
                  {issueMap.sponsorId ? (
                    <p className="mt-1 text-sm text-destructive">{issueMap.sponsorId}</p>
                  ) : null}
                </div>
                <div data-field="contestId">
                  <Label htmlFor="contest">Contest</Label>
                  <Select
                    value={draft.contestId ?? ''}
                    disabled={editingSaved || !draft.sponsorId}
                    onValueChange={(value) => patch({ contestId: value })}
                  >
                    <SelectTrigger
                      id="contest"
                      className="mt-1 w-full"
                      aria-invalid={Boolean(issueMap.contestId) || undefined}
                    >
                      <SelectValue
                        placeholder={
                          draft.sponsorId ? 'Choose a contest' : 'Choose a sponsor first'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {sponsorContests.map((contest) => (
                        <SelectItem
                          key={contest.id}
                          value={contest.id}
                          disabled={takenContests.has(contest.id)}
                        >
                          {takenContests.has(contest.id)
                            ? `${contest.name} (already has a form)`
                            : contest.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Only {sponsorName || 'that sponsor'}'s contests are listed. One registration
                    form per contest.
                  </p>
                  {issueMap.contestId ? (
                    <p className="mt-1 text-sm text-destructive">{issueMap.contestId}</p>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div data-field="opensAt">
                  <Label htmlFor="opens">Registration opens (IST)</Label>
                  <Input
                    id="opens"
                    className="mt-1"
                    type="datetime-local"
                    value={toIstInput(draft.opensAt)}
                    aria-invalid={Boolean(issueMap.opensAt) || undefined}
                    onChange={(event) => patch({ opensAt: fromIstInput(event.target.value) })}
                  />
                  {issueMap.opensAt ? (
                    <p className="mt-1 text-sm text-destructive">{issueMap.opensAt}</p>
                  ) : null}
                </div>
                <div data-field="closesAt">
                  <Label htmlFor="closes">Registration closes (IST)</Label>
                  <Input
                    id="closes"
                    className="mt-1"
                    type="datetime-local"
                    value={toIstInput(draft.closesAt)}
                    aria-invalid={Boolean(issueMap.closesAt) || undefined}
                    onChange={(event) => patch({ closesAt: fromIstInput(event.target.value) })}
                  />
                  <p className="mt-1 text-sm text-muted-foreground">
                    When a quiz is given to this form later, you're warned if it ends before
                    registration closes.
                  </p>
                  {issueMap.closesAt ? (
                    <p className="mt-1 text-sm text-destructive">{issueMap.closesAt}</p>
                  ) : null}
                </div>
                <div data-field="seats">
                  <Label htmlFor="seats">Number of seats</Label>
                  <Input
                    id="seats"
                    className="mt-1"
                    inputMode="numeric"
                    value={draft.seats ?? ''}
                    placeholder="Unlimited"
                    aria-invalid={Boolean(issueMap.seats) || undefined}
                    onChange={(event) =>
                      patch({
                        seats: event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                  />
                  <p className="mt-1 text-sm text-muted-foreground">
                    Leave empty for unlimited registrations while the form is open.
                  </p>
                  {issueMap.seats ? (
                    <p className="mt-1 text-sm text-destructive">{issueMap.seats}</p>
                  ) : null}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Open from {draft.opensAt ? formatIst(draft.opensAt) : '…'} to{' '}
                {draft.closesAt ? formatIst(draft.closesAt) : '…'} ·{' '}
                {draft.seats == null ? 'Unlimited seats' : `${draft.seats} seats`}
              </p>
              <div>
                <Label htmlFor="welcome">Welcome message</Label>
                <Textarea
                  id="welcome"
                  className="mt-1"
                  maxLength={300}
                  value={draft.welcomeMessage ?? ''}
                  onChange={(event) => patch({ welcomeMessage: event.target.value })}
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  {(draft.welcomeMessage ?? '').length} / 300 characters
                </p>
              </div>
              <fieldset className="flex flex-wrap gap-3">
                <legend className="mb-2 text-sm font-medium">Show on the form</legend>
                <Chip
                  checked={draft.showContestImage}
                  label="Contest image"
                  onChange={(checked) => patch({ showContestImage: checked })}
                />
                <Chip
                  checked={draft.showSponsorName}
                  label="Sponsor name"
                  onChange={(checked) => patch({ showSponsorName: checked })}
                />
                <Chip
                  checked={draft.showRegistrationCloses}
                  label="Registration closes"
                  onChange={(checked) => patch({ showRegistrationCloses: checked })}
                />
                <Chip
                  checked={draft.showSeatsLeft}
                  disabled={draft.seats == null}
                  label={draft.seats == null ? 'Seats left (no limit set)' : 'Seats left'}
                  onChange={(checked) => patch({ showSeatsLeft: checked })}
                />
              </fieldset>
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                From the contest: {contestName || 'title'}, {sponsorName || 'sponsor'}, and its
                image. The contest name is always the heading.
              </p>
              <ContestFormFields
                fields={draft.fields}
                unlocked={unlocked}
                registeredCount={draft.registrationCount}
                issues={issueMap}
                onChange={(fields) => patch({ fields })}
                onLock={() => setUnlocked(false)}
                onUnlock={() => setPasswordOpen(true)}
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled>
                  Back
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void onDraft()}
                >
                  Save as draft
                </Button>
                <Button type="button" disabled={busy} onClick={() => void onContinue()}>
                  Save & continue
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="flex w-full flex-col gap-2 xl:sticky xl:top-4 xl:w-auto">
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize preview"
              aria-valuemin={340}
              aria-valuemax={900}
              aria-valuenow={previewWidth}
              tabIndex={0}
              className="hidden h-8 cursor-col-resize rounded-lg border border-dashed border-border xl:block"
              onDoubleClick={() => {
                rememberWidth(520);
                toast.success('Preview size reset');
              }}
              onKeyDown={(event) => {
                const stepSize = event.shiftKey ? 80 : 20;
                if (event.key === 'ArrowLeft') rememberWidth(previewWidth + stepSize);
                if (event.key === 'ArrowRight') rememberWidth(previewWidth - stepSize);
                if (event.key === 'Home') rememberWidth(900);
                if (event.key === 'End') rememberWidth(340);
                if (event.key === 'Enter') {
                  rememberWidth(520);
                  toast.success('Preview size reset');
                }
              }}
            />
            <div style={{ width: '100%', maxWidth: previewWidth }}>
              <div className="mb-2 flex justify-end">
                <Button type="button" variant="outline" onClick={() => setFullPreview(true)}>
                  Full preview
                </Button>
              </div>
              <ContestFormPreview
                form={{ ...draft, contestImageFileId: contestImage }}
                sponsorName={sponsorName}
                contestName={contestName}
              />
            </div>
          </div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Assignment Rules · Step 2 of 2 · {sponsorName} · {contestName}
            </CardTitle>
            <CardDescription>
              Anyone with the contest's link can register. Here you manage the link, choose which
              quizzes registrants get (now or later), limit email domains if needed, and decide how
              Registration IDs are given.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-8">
            <section className="flex flex-col gap-3" data-field="link">
              <h2 className="font-medium">1. Contest registration link</h2>
              <p className="text-sm">
                {draft.status === 'saved' && draft.linkActive
                  ? 'Link active'
                  : draft.linkActive
                    ? 'Live after you save'
                    : 'Turned off'}
              </p>
              <p className="break-all font-medium text-primary">{linkLabel}</p>
              <p className="text-sm text-muted-foreground">
                You can share it before any quiz is given to this form.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!draft.slug}
                  onClick={() => void copyLink()}
                >
                  Copy link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!draft.slug}
                  onClick={() =>
                    draft.slug && window.open(registrationUrl(draft.slug), '_blank', 'noopener')
                  }
                >
                  Open as participant
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!draft.slug}
                  onClick={() => void onRegenerate()}
                >
                  Regenerate link
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.linkActive}
                  onCheckedChange={(checked) => patch({ linkActive: checked })}
                />
                Link is active
              </label>
              {!draft.linkActive ? (
                <p className="text-sm text-warning">
                  While the link is off, new people can't register. People already registered can
                  still log in.
                </p>
              ) : null}
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="font-medium">2. Quizzes this form gives access to</h2>
              {(quizzes.data ?? []).map((quiz) => (
                <QuizChoice
                  key={quiz.id}
                  quiz={quiz}
                  closesAt={draft.closesAt}
                  checked={draft.quizzes.some((item) => item.id === quiz.id)}
                  onChange={(checked) =>
                    patch({
                      quizzes: checked
                        ? [...draft.quizzes, quiz]
                        : draft.quizzes.filter((item) => item.id !== quiz.id),
                    })
                  }
                />
              ))}
              {draft.quizzes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No quiz yet. You can still share the link. People who register get their
                  Registration ID and see "No quizzes yet. You'll get an email when one is ready."
                  Come back to this page to give a quiz later.
                </p>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.emailOnQuiz}
                  onCheckedChange={(checked) => patch({ emailOnQuiz: checked })}
                />
                Email participants when a quiz is given
              </label>
            </section>
            <section className="flex flex-col gap-3" data-field="allowedDomains">
              <h2 className="font-medium">3. Who can register</h2>
              <p className="text-sm">Anyone with the link. Dates and seats come from Step 1.</p>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.domainRestriction}
                  onCheckedChange={(checked) => patch({ domainRestriction: checked })}
                />
                Only allow emails from certain domains
              </label>
              {draft.domainRestriction ? (
                <>
                  <Label htmlFor="domains">Allowed domains</Label>
                  <div className="flex flex-wrap gap-2">
                    {draft.allowedDomains.map((domain) => (
                      <span key={domain} className="rounded-full bg-accent px-2 py-1 text-sm">
                        @{domain}
                        <button
                          type="button"
                          className="ml-1"
                          aria-label={`Remove @${domain}`}
                          onClick={() =>
                            patch({
                              allowedDomains: draft.allowedDomains.filter(
                                (item) => item !== domain,
                              ),
                            })
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <Input
                    id="domains"
                    value={domainDraft}
                    aria-invalid={Boolean(issueMap.allowedDomains) || undefined}
                    placeholder="infosys.com"
                    onChange={(event) => setDomainDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
                        event.preventDefault();
                        if (domainDraft.trim()) addDomain(domainDraft);
                      }
                    }}
                  />
                  {issueMap.allowedDomains ? (
                    <p className="text-sm text-destructive">{issueMap.allowedDomains}</p>
                  ) : null}
                  <Label htmlFor="domain-message">Message when the domain isn't allowed</Label>
                  <Textarea
                    id="domain-message"
                    maxLength={160}
                    value={draft.domainMessage}
                    aria-invalid={Boolean(issueMap.domainMessage) || undefined}
                    onChange={(event) => patch({ domainMessage: event.target.value })}
                  />
                  {issueMap.domainMessage ? (
                    <p className="text-sm text-destructive">{issueMap.domainMessage}</p>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    Preview: {domainMessagePreview(draft.domainMessage, draft.allowedDomains)}
                  </p>
                </>
              ) : null}
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="font-medium">4. Registration ID and returning participants</h2>
              <p className="text-sm text-muted-foreground">
                Format BP + 8 digits. It is the only login, shown after registering.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.keepExistingId}
                  onCheckedChange={(checked) => patch({ keepExistingId: checked })}
                />
                Give returning participants their existing Registration ID
              </label>
              <RadioGroup
                value={draft.matchRule}
                disabled={!draft.keepExistingId}
                onValueChange={(value) => patch({ matchRule: value as Draft['matchRule'] })}
                className="grid gap-2"
              >
                <label className="flex gap-2 rounded-lg border border-border p-3 text-sm">
                  <RadioGroupItem value="name_and_contact" />
                  <span>
                    <span className="font-medium">Name + contact</span>
                    <span className="mt-1 block text-muted-foreground">
                      First name AND (Email OR Mobile). Safer when people share an email or phone,
                      like siblings.
                    </span>
                  </span>
                </label>
                <label className="flex gap-2 rounded-lg border border-border p-3 text-sm">
                  <RadioGroupItem value="contact_only" />
                  <span>
                    <span className="font-medium">Contact only</span>
                    <span className="mt-1 block text-muted-foreground">
                      Email OR Mobile. Catches people who type their name differently. Names aren't
                      checked.
                    </span>
                  </span>
                </label>
              </RadioGroup>
              {draft.keepExistingId && draft.matchRule === 'contact_only' ? (
                <p className="text-sm text-warning">
                  Because names aren't checked, two people who register with the same email or
                  mobile (for example siblings using a parent's number) get the same Registration ID
                  and share one login.
                </p>
              ) : null}
            </section>
            <section>
              <h2 className="font-medium">5. Logins</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                A login stays active until an admin deactivates it. It doesn't expire when quizzes
                end. Someone with no quiz yet still logs in and sees "No quizzes yet. You'll get an
                email when one is ready."
              </p>
            </section>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void onDraft()}
              >
                Save as draft
              </Button>
              <Button type="button" disabled={busy} onClick={() => void onSave()}>
                {editingSaved ? 'Save changes' : 'Save registration form'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Dialog open={fullPreview} onOpenChange={setFullPreview}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Full preview</DialogTitle>
          </DialogHeader>
          <ContestFormPreview
            full
            form={{ ...draft, contestImageFileId: contestImage }}
            sponsorName={sponsorName}
            contestName={contestName}
          />
        </DialogContent>
      </Dialog>
      <AdminPasswordDialog
        open={passwordOpen && Boolean(password || mode === 'create')}
        title="Unlock locked fields"
        description="Enter the password you use to sign in to the admin portal."
        confirmLabel="Unlock"
        error={passwordError}
        busy={passwordBusy}
        onOpenChange={setPasswordOpen}
        onConfirm={(value) => {
          if (!value.trim()) {
            setPasswordError('Enter your password.');
            return;
          }
          setPasswordBusy(true);
          void verifyContestFormPassword(value)
            .then(() => {
              setUnlocked(true);
              setPassword((current) => current || value);
              setPasswordError('');
              setPasswordOpen(false);
              toast.success('Fields unlocked');
            })
            .catch((err: unknown) => {
              setPasswordError(err instanceof ApiError ? err.message : 'Incorrect password.');
            })
            .finally(() => setPasswordBusy(false));
        }}
      />
    </div>
  );
}

function Chip({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm ${disabled ? 'opacity-50' : ''}`}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
      {label}
    </label>
  );
}

function QuizChoice({
  quiz,
  closesAt,
  checked,
  onChange,
}: {
  quiz: ContestFormQuiz;
  closesAt: string | null;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ended = quiz.availability === 'Ended';
  return (
    <label className={`rounded-lg border border-border p-3 text-sm ${ended ? 'opacity-60' : ''}`}>
      <span className="flex items-start gap-2">
        <Checkbox
          checked={checked}
          disabled={ended}
          onCheckedChange={(value) => onChange(value === true)}
        />
        <span>
          <span className="font-medium">{quiz.name}</span>
          <span className="mt-1 block text-muted-foreground">
            {quiz.availability}
            {quiz.startsAt ? ` · ${formatIst(quiz.startsAt)}` : ''}
            {quiz.endsAt ? ` – ${formatIst(quiz.endsAt)}` : ''}
          </span>
          {ended ? <span className="block">Ended: can't be given</span> : null}
          {closesAt && quiz.endsAt && new Date(quiz.endsAt) < new Date(closesAt) ? (
            <span className="block text-warning">
              {quiz.name} ends {formatIst(quiz.endsAt)}, before registration closes (
              {formatIst(closesAt)}). People who register after it ends won't be able to take it.
            </span>
          ) : null}
        </span>
      </span>
    </label>
  );
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
    fields: record.fields,
    slug: record.slug,
    linkActive: record.linkActive,
    emailOnQuiz: record.emailOnQuiz,
    domainRestriction: record.domainRestriction,
    allowedDomains: record.allowedDomains,
    domainMessage: record.domainMessage,
    keepExistingId: record.keepExistingId,
    matchRule: record.matchRule,
    registrationCount: record.registrationCount,
    quizzes: record.quizzes,
  };
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  Loader2Icon,
  PlusIcon,
  TrashIcon,
} from 'lucide-react';
import { DateTimePicker } from '@/components/date-time-picker';
import { QuestionImageField } from '@/components/question-image-field';
import { FormPageSkeleton } from '@/components/loading-skeletons';
import { useConfirm } from '@/components/use-confirm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/auth-context';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { ApiError } from '@/lib/api-client';
import { canEditKind } from '@/lib/access';
import { cn } from '@/lib/utils';
import {
  archiveActivity,
  assignRegistrations,
  createActivity,
  createRoundQuestion,
  deleteRoundQuestion,
  getActivity,
  getContests,
  getQuestionBanks,
  getSponsors,
  getStudents,
  publishActivity,
  updateActivity,
  type ActivityKind,
  type ActivityRegistrationField,
  type ActivityRoundLocalQuestion,
  type ActivitySettings,
  type QuizActivitySettings,
} from '@/services';

const defaultQuizSettings = (): QuizActivitySettings => ({
  shuffleQuestions: true,
  shuffleOptions: true,
  scoreVisibleToStudent: false,
  answersVisibleToStudent: false,
  dailyLeaderboardVisible: true,
  overallLeaderboardVisible: true,
  dailyGroupLeaderboardVisible: true,
  overallGroupLeaderboardVisible: true,
  countsForGroupLeaderboard: true,
  leaderboardReleasedAt: null,
});

type RoundDraft = {
  key: string;
  id?: string;
  name: string;
  bankIds: string[];
  localQuestions: ActivityRoundLocalQuestion[];
};

const emptyRound = (index: number): RoundDraft => ({
  key: `round_${Math.random().toString(36).slice(2, 9)}`,
  name: `Round ${index + 1}`,
  bankIds: [],
  localQuestions: [],
});

type WizardMode = 'create' | 'edit' | 'view';

type FieldDraft = ActivityRegistrationField;

const emptyField = (): FieldDraft => ({
  key: `field_${Math.random().toString(36).slice(2, 7)}`,
  label: '',
  type: 'text',
  required: false,
});

export function ActivityWizardPage({ kind, mode }: { kind: ActivityKind; mode: WizardMode }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const params = useParams();
  const auth = useAuth();
  const canEdit = canEditKind(auth.status === 'authenticated' ? auth.membership : null, kind);
  const activityIdParam = params.activityId ?? '';
  const isQuiz = kind === 'quiz';
  const noun = isQuiz ? 'Quiz' : 'Assessment';
  const listPath = isQuiz ? '/quizzes' : '/assessments';
  const readOnly = mode === 'view';
  const steps = useMemo(
    () =>
      [
        'Basic Details',
        'Registration Form',
        isQuiz ? 'Select Question Banks' : 'Define Rounds',
        'Assignment Rules',
        'Behaviour Settings',
        'Review & Publish',
      ] as const,
    [isQuiz],
  );

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(mode !== 'create');
  const [saving, setSaving] = useState(false);
  const [activityId, setActivityId] = useState<string | null>(
    mode === 'create' ? null : activityIdParam,
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [sponsorId, setSponsorId] = useState('');
  const [contestId, setContestId] = useState('');
  const [sponsors, setSponsors] = useState<{ id: string; name: string }[]>([]);
  const [contests, setContests] = useState<{ id: string; sponsorId: string; name: string }[]>([]);
  const [durationMode, setDurationMode] = useState<'overall' | 'per_question'>('overall');
  const [perQuestionSeconds, setPerQuestionSeconds] = useState('30');
  const [bankQuery, setBankQuery] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d;
  });
  const [statusKey, setStatusKey] = useState('draft');

  const [regFields, setRegFields] = useState<FieldDraft[]>([]);
  const [bankIds, setBankIds] = useState<string[]>([]);
  const [rounds, setRounds] = useState<RoundDraft[]>(() => [emptyRound(0)]);
  const [addingQuestionFor, setAddingQuestionFor] = useState<string | null>(null);
  const [newQuestionStem, setNewQuestionStem] = useState('');
  const [newQuestionImageUrl, setNewQuestionImageUrl] = useState('');
  const [newQuestionOptions, setNewQuestionOptions] = useState([
    { label: 'A', body: '', isCorrect: true, imageUrl: '' },
    { label: 'B', body: '', isCorrect: false, imageUrl: '' },
  ]);
  const [banks, setBanks] = useState<{ id: string; name: string; questions: number }[]>([]);
  const [assignMode, setAssignMode] = useState<'manual' | 'all_active_students'>('manual');
  const [assignNotes, setAssignNotes] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [passingPercent, setPassingPercent] = useState('40');
  const [presentation, setPresentation] = useState<'one_at_a_time' | 'all_on_page' | 'timed_card'>(
    'one_at_a_time',
  );
  const [quizSettings, setQuizSettings] = useState<QuizActivitySettings>(defaultQuizSettings);
  const [leaderboardReleaseLocal, setLeaderboardReleaseLocal] = useState('');
  const [baselineFp, setBaselineFp] = useState<string | null>(null);
  const publishIdempotencyKeyRef = useRef<string | null>(null);

  const draftFingerprint = useMemo(
    () =>
      JSON.stringify({
        name,
        description,
        code,
        sponsorId,
        contestId,
        durationMode,
        perQuestionSeconds,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        regFields,
        bankIds,
        rounds: rounds.map((r) => ({
          id: r.id,
          name: r.name,
          bankIds: r.bankIds,
          localQuestions: r.localQuestions,
        })),
        assignMode,
        assignNotes,
        durationMinutes,
        passingPercent,
        presentation,
        quizSettings,
        leaderboardReleaseLocal,
      }),
    [
      name,
      description,
      code,
      sponsorId,
      contestId,
      durationMode,
      perQuestionSeconds,
      startDate,
      endDate,
      regFields,
      bankIds,
      rounds,
      assignMode,
      assignNotes,
      durationMinutes,
      passingPercent,
      presentation,
      quizSettings,
      leaderboardReleaseLocal,
    ],
  );

  useEffect(() => {
    if (loading || readOnly) return;
    if (baselineFp === null) setBaselineFp(draftFingerprint);
  }, [loading, readOnly, draftFingerprint, baselineFp]);

  const dirty = !readOnly && baselineFp !== null && draftFingerprint !== baselineFp;
  const allowLeave = useLeaveGuard(dirty);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getQuestionBanks(kind);
        if (!cancelled) {
          setBanks(rows.map((b) => ({ id: b.id, name: b.name, questions: b.questions })));
        }
      } catch {
        if (!cancelled) setBanks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  useEffect(() => {
    if (!isQuiz) return;
    let cancelled = false;
    void (async () => {
      try {
        const [sponsorRows, contestRows] = await Promise.all([getSponsors(), getContests()]);
        if (cancelled) return;
        setSponsors(sponsorRows.map((row) => ({ id: row.id, name: row.name })));
        setContests(
          contestRows.map((row) => ({ id: row.id, sponsorId: row.sponsorId, name: row.name })),
        );
      } catch {
        if (!cancelled) {
          setSponsors([]);
          setContests([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isQuiz]);

  useEffect(() => {
    if (mode === 'create') return;
    let cancelled = false;
    (async () => {
      try {
        const activity = await getActivity(activityIdParam);
        if (cancelled) return;
        setActivityId(activity.id);
        setName(activity.name);
        setDescription(activity.subtitle);
        if (activity.kind !== 'quiz') setCode(activity.code);
        setSponsorId(activity.sponsorId ?? '');
        setContestId(activity.contestId ?? '');
        setDurationMode(activity.durationMode ?? 'overall');
        setPerQuestionSeconds(
          activity.perQuestionSeconds != null ? String(activity.perQuestionSeconds) : '30',
        );
        setStatusKey(activity.statusKey);
        if (activity.startsAt) setStartDate(new Date(activity.startsAt));
        if (activity.endsAt) setEndDate(new Date(activity.endsAt));
        setBankIds(activity.bankIds);
        if (activity.rounds && activity.rounds.length > 0) {
          setRounds(
            activity.rounds.map((r) => ({
              key: r.id,
              id: r.id,
              name: r.name,
              bankIds: r.bankIds,
              localQuestions: r.localQuestions ?? [],
            })),
          );
        } else if (activity.kind === 'assessment') {
          setRounds([
            {
              ...emptyRound(0),
              bankIds: activity.bankIds,
            },
          ]);
        }
        setDurationMinutes(
          activity.kind === 'quiz' && activity.durationMode === 'per_question'
            ? ''
            : String(activity.durationMinutes ?? 60),
        );
        setPassingPercent(String(activity.passingPercent ?? 40));
        setPresentation(activity.presentation);
        const settings = activity.settings;
        setRegFields(settings?.registrationForm?.fields ?? []);
        setAssignMode(settings?.assignmentRules?.mode ?? 'manual');
        setAssignNotes(settings?.assignmentRules?.notes ?? '');
        if (activity.kind === 'quiz') {
          const q = { ...defaultQuizSettings(), ...settings?.quiz };
          setQuizSettings(q);
          setLeaderboardReleaseLocal(
            q.leaderboardReleasedAt
              ? new Date(q.leaderboardReleasedAt).toISOString().slice(0, 16)
              : '',
          );
        }
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : `Could not load ${noun.toLowerCase()}.`,
        );
        void navigate(listPath);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activityIdParam, listPath, mode, navigate, noun]);

  const settingsPayload = useMemo((): ActivitySettings => {
    return {
      registrationForm: {
        fields: regFields
          .filter((f) => f.label.trim())
          .map((f) => ({
            ...f,
            label: f.label.trim(),
            key: f.key.trim() || emptyField().key,
          })),
      },
      assignmentRules: {
        mode: assignMode,
        notes: assignNotes.trim() || undefined,
      },
      ...(isQuiz
        ? {
            quiz: {
              ...quizSettings,
              leaderboardReleasedAt: leaderboardReleaseLocal
                ? new Date(leaderboardReleaseLocal).toISOString()
                : null,
            },
          }
        : {}),
    };
  }, [assignMode, assignNotes, isQuiz, leaderboardReleaseLocal, quizSettings, regFields]);

  async function syncRoundsFromServer(id: string): Promise<RoundDraft[]> {
    const activity = await getActivity(id);
    if (activity.rounds && activity.rounds.length > 0) {
      const next = activity.rounds.map((r) => ({
        key: r.id,
        id: r.id,
        name: r.name,
        bankIds: r.bankIds,
        localQuestions: r.localQuestions ?? [],
      }));
      setRounds(next);
      return next;
    }
    return [];
  }

  async function persist(opts?: { publish?: boolean; archive?: boolean; stay?: boolean }) {
    if (readOnly) return activityId;
    if (!name.trim()) {
      toast.error('Name is required.');
      setStep(0);
      return null;
    }
    if (!isQuiz && rounds.length === 0) {
      toast.error('Add at least one round.');
      setStep(2);
      return null;
    }
    if (!isQuiz && rounds.some((r) => !r.name.trim())) {
      toast.error('Each round needs a name.');
      setStep(2);
      return null;
    }
    if (isQuiz && (!sponsorId || !contestId)) {
      toast.error('Choose a sponsor and a contest.');
      setStep(0);
      return null;
    }
    const duration = Number(durationMinutes);
    const seconds = Number(perQuestionSeconds);
    if (isQuiz && durationMode === 'overall' && (!Number.isFinite(duration) || duration <= 0)) {
      toast.error('Enter the overall quiz duration in minutes.');
      setStep(4);
      return null;
    }
    if (isQuiz && durationMode === 'per_question' && (!Number.isFinite(seconds) || seconds <= 0)) {
      toast.error('Enter the time in seconds for each question.');
      setStep(4);
      return null;
    }
    setSaving(true);
    try {
      const passing = Number(passingPercent);
      const payload = {
        name: name.trim(),
        subtitle: description.trim() || undefined,
        startsAt: startDate,
        endsAt: endDate,
        passingPercent: Number.isFinite(passing) ? passing : undefined,
        presentation,
        ...(isQuiz
          ? {
              bankIds,
              sponsorId,
              contestId,
              durationMode,
              durationMinutes: durationMode === 'overall' ? duration : null,
              perQuestionSeconds: durationMode === 'per_question' ? seconds : null,
            }
          : {
              durationMinutes: Number.isFinite(duration) && duration > 0 ? duration : undefined,
              rounds: rounds.map((r, i) => ({
                ...(r.id ? { id: r.id } : {}),
                name: r.name.trim(),
                sortOrder: i,
                bankIds: r.bankIds,
              })),
            }),
        settings: settingsPayload,
        ...(!isQuiz && code.trim() ? { code: code.trim() } : {}),
      };

      let id = activityId;
      if (!id) {
        const created = await createActivity({ kind, ...payload });
        id = created.id;
        setActivityId(created.id);
        if (!isQuiz && created.code) setCode(created.code);
      } else {
        await updateActivity(id, payload);
      }

      if (!isQuiz) {
        await syncRoundsFromServer(id);
      }

      if (assignMode === 'all_active_students') {
        const students = await getStudents();
        const activeIds = students.filter((s) => s.status === 'Active').map((s) => s.id);
        if (activeIds.length > 0) {
          await assignRegistrations(id, activeIds);
        }
      }

      if (opts?.publish) {
        if (!publishIdempotencyKeyRef.current) {
          publishIdempotencyKeyRef.current = crypto.randomUUID();
        }
        await publishActivity(id, publishIdempotencyKeyRef.current);
        publishIdempotencyKeyRef.current = null;
        setStatusKey('active');
        toast.success(`${noun} published.`);
      } else if (opts?.archive) {
        await archiveActivity(id);
        setStatusKey('archived');
        toast.success(`${noun} archived.`);
      } else {
        toast.success(`${noun} saved.`);
      }

      setBaselineFp(null);
      if (!opts?.stay) {
        allowLeave();
        void navigate(listPath);
      }
      return id;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Could not save ${noun.toLowerCase()}.`);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleAddRoundQuestion(roundKey: string) {
    if (readOnly) return;
    const question = newQuestionStem.trim();
    if (!question) {
      toast.error('Question is required.');
      return;
    }
    const filled = newQuestionOptions.filter((o) => o.body.trim() || o.imageUrl.trim());
    if (filled.length < 2) {
      toast.error('Add at least two options (text, image URL, or both).');
      return;
    }
    if (!filled.some((o) => o.isCorrect)) {
      toast.error('Mark one correct option.');
      return;
    }

    const draftIndex = rounds.findIndex((r) => r.key === roundKey);
    const id = (await persist({ stay: true })) ?? null;
    if (!id) return;

    const synced = await syncRoundsFromServer(id);
    const roundId =
      synced[draftIndex]?.id ??
      synced.find((r) => r.key === roundKey || r.name === rounds[draftIndex]?.name)?.id;
    if (!roundId) {
      toast.error('Save the round before adding questions.');
      return;
    }

    const stemImage = newQuestionImageUrl.trim();
    const correctLabels = filled.filter((o) => o.isCorrect).map((o) => o.label);
    setSaving(true);
    try {
      await createRoundQuestion(id, roundId, {
        type: 'single_mcq',
        question,
        points: 1,
        options: filled.map((o) => ({
          label: o.label,
          body: o.body.trim(),
          isCorrect: o.isCorrect,
          ...(o.imageUrl.trim() ? { imageUrl: o.imageUrl.trim() } : {}),
        })),
        answerKey: {
          correctLabels,
          ...(stemImage ? { questionImageUrl: stemImage } : {}),
        },
      });
      await syncRoundsFromServer(id);
      setAddingQuestionFor(null);
      setNewQuestionStem('');
      setNewQuestionImageUrl('');
      setNewQuestionOptions([
        { label: 'A', body: '', isCorrect: true, imageUrl: '' },
        { label: 'B', body: '', isCorrect: false, imageUrl: '' },
      ]);
      toast.success('Question added to round.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not add question.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRoundQuestion(roundKey: string, questionId: string) {
    if (readOnly || !activityId) return;
    const round = rounds.find((r) => r.key === roundKey);
    if (!round?.id) return;
    const ok = await confirm({
      title: 'Delete this question?',
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await deleteRoundQuestion(activityId, round.id, questionId);
      await syncRoundsFromServer(activityId);
      toast.success('Question removed.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove question.');
    } finally {
      setSaving(false);
    }
  }

  async function goNext() {
    if (readOnly) {
      setStep((s) => Math.min(s + 1, steps.length - 1));
      return;
    }
    const id = await persist({ stay: true });
    if (id) setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  if (loading) return <FormPageSkeleton />;

  const editPath = `${listPath}/${activityIdParam}/edit`;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-3 mb-1">
            <Link to={listPath}>
              <ArrowLeftIcon data-icon="inline-start" /> Back to{' '}
              {isQuiz ? 'quizzes' : 'assessments'}
            </Link>
          </Button>
          <h2 className="text-xl font-semibold tracking-tight">
            {mode === 'create'
              ? `Create ${noun}`
              : mode === 'edit'
                ? `Edit ${noun}`
                : `View ${noun}`}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {readOnly
              ? 'Read-only activity configuration.'
              : 'Complete each step. Progress is saved when you continue.'}
          </p>
        </div>
        {mode === 'view' && activityId && canEdit ? (
          <Button asChild>
            <Link to={editPath}>Edit</Link>
          </Button>
        ) : null}
      </div>

      <nav aria-label="Wizard steps" className="flex flex-wrap gap-2">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
            aria-current={index === step ? 'step' : undefined}
            className={cn(
              'inline-flex min-h-(--control-h) items-center gap-2 rounded-lg border px-3 text-sm transition-colors',
              index === step
                ? 'border-primary bg-primary text-primary-foreground'
                : index < step
                  ? 'border-border bg-muted text-foreground'
                  : 'border-border bg-background text-muted-foreground',
            )}
          >
            <span className="tabular-nums">{index + 1}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>{steps[step]}</CardTitle>
          <CardDescription>
            Step {step + 1} of {steps.length}
            {statusKey !== 'draft' ? ` · Status: ${statusKey}` : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          {step === 0 ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="activity-name">
                  {noun} Name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="activity-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={readOnly}
                />
              </Field>
              {isQuiz ? null : (
                <Field>
                  <FieldLabel htmlFor="activity-code">Code</FieldLabel>
                  <Input
                    id="activity-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={readOnly || mode === 'edit'}
                    placeholder="Auto-generated if empty"
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="activity-description">Description</FieldLabel>
                <Textarea
                  id="activity-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={readOnly}
                />
                <FieldDescription>Students see this on the start screen.</FieldDescription>
              </Field>
              {isQuiz ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="quiz-sponsor">
                      Sponsor <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Select
                      value={sponsorId || undefined}
                      disabled={readOnly}
                      onValueChange={(value) => {
                        setSponsorId(value);
                        setContestId((current) =>
                          contests.some((row) => row.id === current && row.sponsorId === value)
                            ? current
                            : '',
                        );
                      }}
                    >
                      <SelectTrigger id="quiz-sponsor" className="w-full">
                        <SelectValue placeholder="Choose a sponsor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {sponsors.map((sponsor) => (
                            <SelectItem key={sponsor.id} value={sponsor.id}>
                              {sponsor.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="quiz-contest">
                      Contest <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Select
                      value={contestId || undefined}
                      disabled={readOnly || !sponsorId}
                      onValueChange={setContestId}
                    >
                      <SelectTrigger id="quiz-contest" className="w-full">
                        <SelectValue
                          placeholder={sponsorId ? 'Choose a contest' : 'Choose a sponsor first'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {contests
                            .filter((row) => row.sponsorId === sponsorId)
                            .map((contest) => (
                              <SelectItem key={contest.id} value={contest.id}>
                                {contest.name}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>
                    Start Date {isQuiz ? <span className="text-destructive">*</span> : null}
                  </FieldLabel>
                  <DateTimePicker
                    id="start-date"
                    value={startDate}
                    onChange={setStartDate}
                    disabled={readOnly}
                  />
                </Field>
                <Field>
                  <FieldLabel>
                    End Date {isQuiz ? <span className="text-destructive">*</span> : null}
                  </FieldLabel>
                  <DateTimePicker
                    id="end-date"
                    value={endDate}
                    onChange={setEndDate}
                    disabled={readOnly}
                  />
                </Field>
              </div>
            </FieldGroup>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Optional fields collected before a student starts (stored with the activity).
              </p>
              {regFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">No registration fields yet.</p>
              ) : null}
              {regFields.map((field, index) => (
                <div
                  key={field.key}
                  className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 md:grid-cols-[1fr_1fr_auto_auto]"
                >
                  <Field>
                    <FieldLabel>Label</FieldLabel>
                    <Input
                      value={field.label}
                      disabled={readOnly}
                      onChange={(e) => {
                        const next = [...regFields];
                        next[index] = { ...field, label: e.target.value };
                        setRegFields(next);
                      }}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Type</FieldLabel>
                    <Select
                      value={field.type}
                      disabled={readOnly}
                      onValueChange={(v) => {
                        const next = [...regFields];
                        next[index] = {
                          ...field,
                          type: v as FieldDraft['type'],
                        };
                        setRegFields(next);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="select">Select</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <label className="flex min-h-(--control-h) items-center gap-2 text-sm">
                    <Checkbox
                      checked={field.required}
                      disabled={readOnly}
                      onCheckedChange={(checked) => {
                        const next = [...regFields];
                        next[index] = { ...field, required: checked === true };
                        setRegFields(next);
                      }}
                    />
                    Required
                  </label>
                  {!readOnly ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove field"
                      onClick={() => setRegFields(regFields.filter((_, i) => i !== index))}
                    >
                      <TrashIcon />
                    </Button>
                  ) : null}
                </div>
              ))}
              {!readOnly ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRegFields([...regFields, emptyField()])}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add field
                </Button>
              ) : null}
            </div>
          ) : null}

          {step === 2 && isQuiz ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Select one or more question banks for this {noun.toLowerCase()}.
                </p>
                <p className="text-sm font-medium">{bankIds.length} selected</p>
              </div>
              {banks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No banks yet.{' '}
                  <Link className="underline" to={`${listPath}/banks/new`}>
                    Create a bank
                  </Link>
                </p>
              ) : (
                <>
                  <Input
                    type="search"
                    value={bankQuery}
                    onChange={(event) => setBankQuery(event.target.value)}
                    placeholder="Search question banks"
                    aria-label="Search question banks"
                  />
                  {banks.filter((bank) =>
                    bank.name.toLowerCase().includes(bankQuery.trim().toLowerCase()),
                  ).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No question banks match this search.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {banks
                        .filter((bank) =>
                          bank.name.toLowerCase().includes(bankQuery.trim().toLowerCase()),
                        )
                        .map((bank) => {
                          const checked = bankIds.includes(bank.id);
                          return (
                            <label
                              key={bank.id}
                              className={cn(
                                'flex min-h-(--control-h) cursor-pointer items-center gap-3 rounded-lg border px-3 py-3',
                                checked
                                  ? 'border-primary bg-accent text-accent-foreground'
                                  : 'border-border',
                                readOnly ? 'cursor-default' : '',
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                disabled={readOnly}
                                onCheckedChange={(value) => {
                                  setBankIds((prev) =>
                                    value === true
                                      ? [...prev, bank.id]
                                      : prev.filter((id) => id !== bank.id),
                                  );
                                }}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block font-medium">{bank.name}</span>
                                <span className="text-sm text-muted-foreground">
                                  {bank.questions} questions
                                </span>
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null}

          {step === 2 && !isQuiz ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Define ordered rounds. Link reusable question banks and optionally add questions
                manually to each round. Students take rounds in order.
              </p>
              {rounds.map((round, index) => (
                <Card key={round.key} className="border-border shadow-none">
                  <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <FieldLabel htmlFor={`round-name-${round.key}`}>
                        Round {index + 1} name
                      </FieldLabel>
                      <Input
                        id={`round-name-${round.key}`}
                        value={round.name}
                        disabled={readOnly}
                        onChange={(e) => {
                          const value = e.target.value;
                          setRounds((prev) =>
                            prev.map((r) => (r.key === round.key ? { ...r, name: value } : r)),
                          );
                        }}
                      />
                    </div>
                    {!readOnly ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={index === 0}
                          aria-label="Move round up"
                          onClick={() => {
                            setRounds((prev) => {
                              if (index === 0) return prev;
                              const next = [...prev];
                              const tmp = next[index - 1]!;
                              next[index - 1] = next[index]!;
                              next[index] = tmp;
                              return next;
                            });
                          }}
                        >
                          <ArrowUpIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={index === rounds.length - 1}
                          aria-label="Move round down"
                          onClick={() => {
                            setRounds((prev) => {
                              if (index >= prev.length - 1) return prev;
                              const next = [...prev];
                              const tmp = next[index + 1]!;
                              next[index + 1] = next[index]!;
                              next[index] = tmp;
                              return next;
                            });
                          }}
                        >
                          <ArrowDownIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={rounds.length <= 1}
                          aria-label="Remove round"
                          onClick={() =>
                            setRounds((prev) => prev.filter((r) => r.key !== round.key))
                          }
                        >
                          <TrashIcon />
                        </Button>
                      </div>
                    ) : null}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-medium">Linked question banks</p>
                      {banks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No banks yet.{' '}
                          <Link className="underline" to={`${listPath}/banks/new`}>
                            Create a bank
                          </Link>
                        </p>
                      ) : (
                        banks.map((bank) => {
                          const checked = round.bankIds.includes(bank.id);
                          return (
                            <label
                              key={bank.id}
                              className="flex min-h-(--control-h) items-center gap-3 rounded-lg border border-border px-3"
                            >
                              <Checkbox
                                checked={checked}
                                disabled={readOnly}
                                onCheckedChange={(value) => {
                                  setRounds((prev) =>
                                    prev.map((r) => {
                                      if (r.key !== round.key) return r;
                                      const bankIdsNext =
                                        value === true
                                          ? [...r.bankIds, bank.id]
                                          : r.bankIds.filter((id) => id !== bank.id);
                                      return { ...r, bankIds: bankIdsNext };
                                    }),
                                  );
                                }}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="font-medium">{bank.name}</span>
                                <span className="ml-2 text-sm text-muted-foreground">
                                  {bank.questions} questions
                                </span>
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-medium">Manual questions</p>
                      {round.localQuestions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {round.localQuestions.map((q) => (
                            <li
                              key={q.id}
                              className="flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2"
                            >
                              <span className="min-w-0 flex-1 text-sm">{q.question}</span>
                              {!readOnly ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Delete question"
                                  onClick={() => void handleDeleteRoundQuestion(round.key, q.id)}
                                >
                                  <TrashIcon />
                                </Button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}

                      {!readOnly && addingQuestionFor === round.key ? (
                        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                          <Field>
                            <FieldLabel htmlFor={`q-question-${round.key}`}>Question</FieldLabel>
                            <Textarea
                              id={`q-question-${round.key}`}
                              value={newQuestionStem}
                              onChange={(e) => setNewQuestionStem(e.target.value)}
                            />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor={`q-image-${round.key}`}>
                              Question image (optional)
                            </FieldLabel>
                            <QuestionImageField
                              id={`q-image-${round.key}`}
                              value={newQuestionImageUrl}
                              placeholder="https://…"
                              onChange={setNewQuestionImageUrl}
                            />
                          </Field>
                          <p className="text-xs text-muted-foreground">
                            Each option needs text, an image URL, or both. Mark exactly one correct.
                          </p>
                          {newQuestionOptions.map((opt, oi) => (
                            <div
                              key={opt.label}
                              className="flex flex-col gap-2 rounded-lg border border-border p-3"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <label className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={opt.isCorrect}
                                    onCheckedChange={(value) => {
                                      setNewQuestionOptions((prev) =>
                                        prev.map((o, i) => ({
                                          ...o,
                                          isCorrect: i === oi ? value === true : false,
                                        })),
                                      );
                                    }}
                                  />
                                  {opt.label}
                                </label>
                                <Input
                                  value={opt.body}
                                  placeholder={`Option ${opt.label}`}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setNewQuestionOptions((prev) =>
                                      prev.map((o, i) => (i === oi ? { ...o, body: value } : o)),
                                    );
                                  }}
                                />
                              </div>
                              <QuestionImageField
                                id={`q-option-image-${round.key}-${opt.label}`}
                                value={opt.imageUrl}
                                placeholder="Image URL (optional)"
                                alt="Answer image"
                                onChange={(value) => {
                                  setNewQuestionOptions((prev) =>
                                    prev.map((o, i) => (i === oi ? { ...o, imageUrl: value } : o)),
                                  );
                                }}
                              />
                            </div>
                          ))}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              disabled={saving}
                              onClick={() => void handleAddRoundQuestion(round.key)}
                            >
                              Save question
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setAddingQuestionFor(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {!readOnly && addingQuestionFor !== round.key ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setAddingQuestionFor(round.key);
                            setNewQuestionStem('');
                            setNewQuestionImageUrl('');
                            setNewQuestionOptions([
                              { label: 'A', body: '', isCorrect: true, imageUrl: '' },
                              { label: 'B', body: '', isCorrect: false, imageUrl: '' },
                            ]);
                          }}
                        >
                          <PlusIcon data-icon="inline-start" />
                          Add question
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {!readOnly ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRounds((prev) => [...prev, emptyRound(prev.length)])}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add round
                </Button>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <FieldGroup>
              <Field>
                <FieldLabel>Assignment mode</FieldLabel>
                <Select
                  value={assignMode}
                  disabled={readOnly}
                  onValueChange={(v) => setAssignMode(v as typeof assignMode)}
                >
                  <SelectTrigger className="w-full sm:max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="manual">Manual (assign from Registrations)</SelectItem>
                      <SelectItem value="all_active_students">All active students</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  “All active students” assigns every active student when you save or publish.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="assign-notes">Notes</FieldLabel>
                <Textarea
                  id="assign-notes"
                  value={assignNotes}
                  disabled={readOnly}
                  onChange={(e) => setAssignNotes(e.target.value)}
                />
              </Field>
            </FieldGroup>
          ) : null}

          {step === 4 ? (
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {isQuiz ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="duration-mode">Time duration</FieldLabel>
                      <Select
                        value={durationMode}
                        disabled={readOnly}
                        onValueChange={(value) =>
                          setDurationMode(value as 'overall' | 'per_question')
                        }
                      >
                        <SelectTrigger id="duration-mode" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="overall">Overall quiz</SelectItem>
                            <SelectItem value="per_question">Per question</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    {durationMode === 'per_question' ? (
                      <Field>
                        <FieldLabel htmlFor="per-question-seconds">Seconds per question</FieldLabel>
                        <Input
                          id="per-question-seconds"
                          type="number"
                          min={1}
                          value={perQuestionSeconds}
                          disabled={readOnly}
                          onChange={(e) => setPerQuestionSeconds(e.target.value)}
                        />
                      </Field>
                    ) : (
                      <Field>
                        <FieldLabel htmlFor="duration">Duration (minutes)</FieldLabel>
                        <Input
                          id="duration"
                          type="number"
                          min={1}
                          value={durationMinutes}
                          disabled={readOnly}
                          onChange={(e) => setDurationMinutes(e.target.value)}
                        />
                      </Field>
                    )}
                  </>
                ) : (
                  <Field>
                    <FieldLabel htmlFor="duration">Duration (minutes)</FieldLabel>
                    <Input
                      id="duration"
                      type="number"
                      min={1}
                      value={durationMinutes}
                      disabled={readOnly}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                    />
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="passing">Passing percent</FieldLabel>
                  <Input
                    id="passing"
                    type="number"
                    min={0}
                    max={100}
                    value={passingPercent}
                    disabled={readOnly}
                    onChange={(e) => setPassingPercent(e.target.value)}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel>Presentation</FieldLabel>
                <Select
                  value={presentation}
                  disabled={readOnly}
                  onValueChange={(v) => setPresentation(v as typeof presentation)}
                >
                  <SelectTrigger className="w-full sm:max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="one_at_a_time">One question at a time</SelectItem>
                      <SelectItem value="all_on_page">All on one page</SelectItem>
                      <SelectItem value="timed_card">Timed card</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {isQuiz ? (
                <div className="flex flex-col gap-4 border-t border-border pt-4">
                  <p className="text-sm font-medium">Quiz behaviour</p>
                  {(
                    [
                      ['shuffleQuestions', 'Shuffle questions'],
                      ['shuffleOptions', 'Shuffle options'],
                      ['scoreVisibleToStudent', 'Show scores to students (when published)'],
                      ['answersVisibleToStudent', 'Show answers to students (when published)'],
                      ['dailyLeaderboardVisible', 'Daily individual leaderboard'],
                      ['overallLeaderboardVisible', 'Overall individual leaderboard'],
                      ['dailyGroupLeaderboardVisible', 'Daily group leaderboard'],
                      ['overallGroupLeaderboardVisible', 'Overall group leaderboard'],
                      ['countsForGroupLeaderboard', 'Count toward group leaderboards'],
                    ] as const
                  ).map(([key, label]) => (
                    <div
                      key={key}
                      className="flex min-h-(--control-h) items-center justify-between gap-3"
                    >
                      <FieldLabel htmlFor={`quiz-${key}`}>{label}</FieldLabel>
                      <Switch
                        id={`quiz-${key}`}
                        checked={quizSettings[key]}
                        disabled={readOnly}
                        onCheckedChange={(checked) =>
                          setQuizSettings((prev) => ({ ...prev, [key]: checked }))
                        }
                      />
                    </div>
                  ))}
                  <Field>
                    <FieldLabel htmlFor="lb-release">Leaderboard release (optional)</FieldLabel>
                    <Input
                      id="lb-release"
                      type="datetime-local"
                      value={leaderboardReleaseLocal}
                      disabled={readOnly}
                      onChange={(e) => setLeaderboardReleaseLocal(e.target.value)}
                    />
                    <FieldDescription>
                      Students see boards only at/after this time when set.
                    </FieldDescription>
                  </Field>
                </div>
              ) : null}
            </FieldGroup>
          ) : null}

          {step === 5 ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Name:</span> {name || '—'}
              </p>
              {isQuiz ? (
                <>
                  <p>
                    <span className="text-muted-foreground">Sponsor:</span>{' '}
                    {sponsors.find((row) => row.id === sponsorId)?.name || '—'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Contest:</span>{' '}
                    {contests.find((row) => row.id === contestId)?.name || '—'}
                  </p>
                </>
              ) : (
                <p>
                  <span className="text-muted-foreground">Code:</span> {code || 'Auto'}
                </p>
              )}
              {isQuiz ? (
                <p>
                  <span className="text-muted-foreground">Banks:</span>{' '}
                  {bankIds.length === 0
                    ? 'None'
                    : banks
                        .filter((b) => bankIds.includes(b.id))
                        .map((b) => b.name)
                        .join(', ')}
                </p>
              ) : (
                <div>
                  <p className="text-muted-foreground">Rounds:</p>
                  <ul className="mt-1 list-inside list-disc space-y-1">
                    {rounds.map((r, i) => (
                      <li key={r.key}>
                        {r.name || `Round ${i + 1}`} — {r.bankIds.length} bank
                        {r.bankIds.length === 1 ? '' : 's'}, {r.localQuestions.length} manual
                        question{r.localQuestions.length === 1 ? '' : 's'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p>
                <span className="text-muted-foreground">Assignment:</span>{' '}
                {assignMode === 'manual' ? 'Manual' : 'All active students'}
              </p>
              <p>
                <span className="text-muted-foreground">Duration:</span>{' '}
                {isQuiz && durationMode === 'per_question'
                  ? `${perQuestionSeconds || '—'} sec per question`
                  : `${durationMinutes || '—'} min`}{' '}
                · Pass {passingPercent || '—'}%
              </p>
              <p>
                <span className="text-muted-foreground">Registration fields:</span>{' '}
                {regFields.filter((f) => f.label.trim()).length}
              </p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-row flex-nowrap items-center justify-between gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0 || saving}
              onClick={goBack}
            >
              Back
            </Button>
            <div className="flex min-w-0 flex-row flex-nowrap justify-end gap-2">
              {readOnly ? (
                <Button
                  type="button"
                  disabled={step === steps.length - 1}
                  onClick={() => setStep((s) => Math.min(s + 1, steps.length - 1))}
                >
                  Next
                </Button>
              ) : step < steps.length - 1 ? (
                <Button
                  type="button"
                  disabled={saving}
                  aria-busy={saving}
                  onClick={() => void goNext()}
                >
                  {saving ? (
                    <Loader2Icon data-icon="inline-start" className="animate-spin" />
                  ) : null}
                  {saving ? 'Saving…' : 'Save & continue'}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    aria-busy={saving}
                    onClick={() => void persist()}
                  >
                    {saving ? (
                      <Loader2Icon data-icon="inline-start" className="animate-spin" />
                    ) : null}
                    {saving ? 'Saving…' : 'Save draft'}
                  </Button>
                  {statusKey === 'active' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={saving}
                      aria-busy={saving}
                      onClick={() => {
                        void (async () => {
                          const ok = await confirm({
                            title: `Archive this ${noun.toLowerCase()}?`,
                            description: 'Students will no longer be able to start it.',
                            confirmLabel: 'Archive',
                            destructive: true,
                          });
                          if (!ok) return;
                          await persist({ archive: true });
                        })();
                      }}
                    >
                      {saving ? (
                        <Loader2Icon data-icon="inline-start" className="animate-spin" />
                      ) : null}
                      Archive
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={saving}
                      aria-busy={saving}
                      onClick={() => {
                        void (async () => {
                          const ok = await confirm({
                            title: `Publish this ${noun.toLowerCase()}?`,
                            description: 'Assigned students can start it.',
                            confirmLabel: 'Publish',
                          });
                          if (!ok) return;
                          await persist({ publish: true });
                        })();
                      }}
                    >
                      {saving ? (
                        <Loader2Icon data-icon="inline-start" className="animate-spin" />
                      ) : null}
                      Publish
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  Building2Icon,
  CalendarRangeIcon,
  ClipboardListIcon,
  Clock3Icon,
  LayoutListIcon,
  LibraryIcon,
  Loader2Icon,
  PercentIcon,
  PlusIcon,
  RepeatIcon,
  TargetIcon,
  TrashIcon,
  UsersIcon,
} from 'lucide-react';
import { CatalogImageField } from '@/components/catalog-image-field';
import { DateTimePicker } from '@/components/date-time-picker';
import { QuestionImageField } from '@/components/question-image-field';
import { FormPageSkeleton } from '@/components/loading-skeletons';
import { RichTextEditor } from '@/components/rich-text-editor';
import { FlowStatusPill } from '@/components/status-pill';
import { useConfirm } from '@/components/use-confirm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { isInstructionsEmpty, sanitizeInstructionsHtml } from '@/lib/sanitize-html';
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
import { canEditKind, canFullKind } from '@/lib/access';
import { cn } from '@/lib/utils';
import { QuizQuestionsPanel } from '@/pages/quiz-questions-panel';
import {
  archiveActivity,
  assignRegistrations,
  createActivity,
  createRoundQuestion,
  deleteActivity,
  deleteRoundQuestion,
  getActivity,
  getContests,
  getQuestionBanks,
  getSponsors,
  getQuestionBank,
  getStudents,
  publishActivity,
  updateActivity,
  uploadCatalogImage,
  type ActivityKind,
  type ActivityRegistrationField,
  type ActivityRoundLocalQuestion,
  type ActivitySettings,
  type QuizActivitySettings,
} from '@/services';

const defaultQuizSettings = (): QuizActivitySettings => ({
  shuffleQuestions: true,
  shuffleOptions: true,
  scoreRelease: 'after_submit',
  answersVisibleToStudent: false,
  allowPrevious: true,
  showQuestionPanel: true,
  negativeMarkingEnabled: false,
  negativeMarkPoints: 0.25,
  maxAttempts: 1,
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

const PRESENTATION_LABELS: Record<'one_at_a_time' | 'all_on_page', string> = {
  one_at_a_time: 'One question at a time',
  all_on_page: 'All on one page',
};

function statusLabel(statusKey: string) {
  if (!statusKey) return 'Draft';
  return statusKey.charAt(0).toUpperCase() + statusKey.slice(1);
}

function ReviewFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3Icon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 gap-3 rounded-xl border border-border/80 bg-muted/40 p-3.5">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary"
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function ActivityWizardPage({ kind, mode }: { kind: ActivityKind; mode: WizardMode }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const params = useParams();
  const auth = useAuth();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canEdit = canEditKind(membership, kind);
  const canFull = canFullKind(membership, kind);
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
        isQuiz ? 'Questions' : 'Define Rounds',
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
  const [passingPercent, setPassingPercent] = useState('50');
  const [presentation, setPresentation] = useState<'one_at_a_time' | 'all_on_page'>(
    'one_at_a_time',
  );
  const [instructions, setInstructions] = useState('');
  const [imageFileId, setImageFileId] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [quizSettings, setQuizSettings] = useState<QuizActivitySettings>(defaultQuizSettings);
  const [quizBankId, setQuizBankId] = useState<string | null>(null);
  const [quizQuestionCount, setQuizQuestionCount] = useState(0);
  const [baselineFp, setBaselineFp] = useState<string | null>(null);
  const publishIdempotencyKeyRef = useRef<string | null>(null);

  const draftFingerprint = useMemo(
    () =>
      JSON.stringify({
        name,
        description,
        instructions,
        imageFileId,
        imageFileName: imageFile?.name ?? null,
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
      }),
    [
      name,
      description,
      instructions,
      imageFileId,
      imageFile,
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
        if (activity.kind === 'quiz') {
          const nextBankId = activity.bankIds[0] ?? null;
          setQuizBankId(nextBankId);
          if (nextBankId) {
            try {
              const bank = await getQuestionBank(nextBankId);
              if (!cancelled) setQuizQuestionCount(bank.items.length);
            } catch {
              if (!cancelled) setQuizQuestionCount(0);
            }
          }
        }
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
        setPassingPercent(String(activity.passingPercent ?? 50));
        const loadedPerQuestion =
          activity.kind === 'quiz' && activity.durationMode === 'per_question';
        setPresentation(
          loadedPerQuestion
            ? 'one_at_a_time'
            : activity.presentation === 'all_on_page'
              ? 'all_on_page'
              : 'one_at_a_time',
        );
        setInstructions(activity.instructions ?? '');
        setImageFileId(activity.imageFileId ?? '');
        setImageFile(null);
        const settings = activity.settings;
        setRegFields(settings?.registrationForm?.fields ?? []);
        setAssignMode(settings?.assignmentRules?.mode ?? 'manual');
        setAssignNotes(settings?.assignmentRules?.notes ?? '');
        if (activity.kind === 'quiz') {
          const q = { ...defaultQuizSettings(), ...settings?.quiz };
          if (loadedPerQuestion) {
            q.allowPrevious = false;
            q.showQuestionPanel = false;
          }
          setQuizSettings(q);
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
              allowPrevious: durationMode === 'per_question' ? false : quizSettings.allowPrevious,
              showQuestionPanel:
                durationMode === 'per_question' ? false : quizSettings.showQuestionPanel,
              negativeMarkPoints: quizSettings.negativeMarkingEnabled
                ? quizSettings.negativeMarkPoints
                : 0,
              maxAttempts: quizSettings.maxAttempts,
            },
          }
        : {}),
    };
  }, [assignMode, assignNotes, durationMode, isQuiz, quizSettings, regFields]);

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
      let nextImageFileId: string | null = imageFileId || null;
      if (imageFile) {
        nextImageFileId = await uploadCatalogImage(imageFile);
        setImageFileId(nextImageFileId);
        setImageFile(null);
      }
      const payload = {
        name: name.trim(),
        subtitle: description.trim() || undefined,
        instructions: isInstructionsEmpty(instructions)
          ? null
          : sanitizeInstructionsHtml(instructions),
        imageFileId: nextImageFileId,
        startsAt: startDate,
        endsAt: endDate,
        passingPercent: Number.isFinite(passing) ? passing : undefined,
        presentation: isQuiz && durationMode === 'per_question' ? 'one_at_a_time' : presentation,
        ...(isQuiz
          ? {
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
      } else {
        const saved = await getActivity(id);
        setBankIds(saved.bankIds);
        setQuizBankId(saved.bankIds[0] ?? null);
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
    const password = await confirm({
      title: 'Delete this question?',
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
      requirePassword: true,
    });
    if (!password) return;
    setSaving(true);
    try {
      await deleteRoundQuestion(activityId, round.id, questionId, password);
      await syncRoundsFromServer(activityId);
      toast.success('Question removed.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove question.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteQuiz() {
    if (!isQuiz || !canFull || !activityId) return;
    const password = await confirm({
      title: `Delete this ${noun.toLowerCase()}?`,
      description:
        'Permanently removes this quiz and all registrations, attempts, and scores. Question banks are kept. This cannot be undone.',
      confirmLabel: 'Delete quiz',
      destructive: true,
      requirePassword: true,
    });
    if (!password) return;
    setSaving(true);
    try {
      await deleteActivity(activityId, password);
      toast.success('Quiz deleted.');
      allowLeave();
      void navigate(listPath);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete quiz.');
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
                <>
                  <CatalogImageField
                    id="quiz-image"
                    label="Quiz image"
                    fileId={imageFileId}
                    alt={name.trim() || 'Quiz cover'}
                    disabled={readOnly}
                    required={false}
                    onFile={setImageFile}
                    onPickExisting={(id) => {
                      setImageFileId(id);
                      setImageFile(null);
                    }}
                    onClear={() => {
                      setImageFileId('');
                      setImageFile(null);
                    }}
                  />
                  <Field>
                    <FieldLabel htmlFor="activity-instructions">Instructions</FieldLabel>
                    <RichTextEditor
                      id="activity-instructions"
                      value={instructions}
                      disabled={readOnly}
                      onChange={setInstructions}
                      aria-label="Quiz instructions"
                    />
                    <FieldDescription>
                      Shown in a dialog before students start. If set, they must confirm they have
                      read them. Supports bold, italic, and lists.
                    </FieldDescription>
                  </Field>
                </>
              ) : null}
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
            <QuizQuestionsPanel
              bankId={quizBankId}
              readOnly={readOnly}
              onCount={setQuizQuestionCount}
              onEnsureBank={async () => {
                const id = (await persist({ stay: true })) ?? activityId;
                if (!id) return null;
                const activity = await getActivity(id);
                const next = activity.bankIds[0] ?? null;
                setBankIds(activity.bankIds);
                setQuizBankId(next);
                return next;
              }}
            />
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
                        onValueChange={(value) => {
                          const next = value as 'overall' | 'per_question';
                          setDurationMode(next);
                          if (next === 'per_question') {
                            setPresentation('one_at_a_time');
                            setQuizSettings((prev) => ({
                              ...prev,
                              allowPrevious: false,
                              showQuestionPanel: false,
                            }));
                          }
                        }}
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
                <Field>
                  <FieldLabel htmlFor="presentation">Presentation</FieldLabel>
                  <Select
                    value={
                      isQuiz && durationMode === 'per_question' ? 'one_at_a_time' : presentation
                    }
                    disabled={readOnly || (isQuiz && durationMode === 'per_question')}
                    onValueChange={(v) => setPresentation(v as typeof presentation)}
                  >
                    <SelectTrigger id="presentation" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="one_at_a_time">One question at a time</SelectItem>
                        <SelectItem
                          value="all_on_page"
                          disabled={isQuiz && durationMode === 'per_question'}
                        >
                          All on one page
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {isQuiz && durationMode === 'per_question' ? (
                    <FieldDescription>
                      Per-question timer requires one question at a time.
                    </FieldDescription>
                  ) : null}
                </Field>
              </div>
              {isQuiz ? (
                <div className="flex flex-col gap-3 border-t border-border pt-4">
                  <p className="text-sm font-medium">Quiz behaviour</p>
                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="grid grid-cols-1 md:grid-cols-2">
                      <div className="flex min-h-(--control-h) items-center justify-between gap-3 border-b border-border p-3.5 md:border-r">
                        <div className="min-w-0">
                          <FieldLabel htmlFor="quiz-allowPrevious">Allow Previous</FieldLabel>
                          <FieldDescription>
                            {durationMode === 'per_question'
                              ? 'Per-question timer always blocks going back.'
                              : 'When off, students cannot return to earlier questions.'}
                          </FieldDescription>
                        </div>
                        <Switch
                          id="quiz-allowPrevious"
                          checked={
                            durationMode === 'per_question' ? false : quizSettings.allowPrevious
                          }
                          disabled={readOnly || durationMode === 'per_question'}
                          onCheckedChange={(checked) =>
                            setQuizSettings((prev) => ({ ...prev, allowPrevious: checked }))
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-3 border-b border-border p-3.5">
                        <div className="flex min-h-(--control-h) items-center justify-between gap-3">
                          <div className="min-w-0">
                            <FieldLabel htmlFor="quiz-negativeMarking">Negative marking</FieldLabel>
                            <FieldDescription>
                              Deduct marks for incorrect answered questions (not unanswered).
                            </FieldDescription>
                          </div>
                          <Switch
                            id="quiz-negativeMarking"
                            checked={quizSettings.negativeMarkingEnabled}
                            disabled={readOnly}
                            onCheckedChange={(checked) =>
                              setQuizSettings((prev) => ({
                                ...prev,
                                negativeMarkingEnabled: checked,
                                negativeMarkPoints:
                                  checked && prev.negativeMarkPoints <= 0
                                    ? 0.25
                                    : prev.negativeMarkPoints,
                              }))
                            }
                          />
                        </div>
                        {quizSettings.negativeMarkingEnabled ? (
                          <Field>
                            <FieldLabel htmlFor="quiz-negative-points">
                              Marks deducted per wrong answer
                            </FieldLabel>
                            <Input
                              id="quiz-negative-points"
                              type="number"
                              min={0.01}
                              step={0.01}
                              value={quizSettings.negativeMarkPoints}
                              disabled={readOnly}
                              onChange={(e) =>
                                setQuizSettings((prev) => ({
                                  ...prev,
                                  negativeMarkPoints: Number(e.target.value) || 0,
                                }))
                              }
                            />
                          </Field>
                        ) : null}
                      </div>
                      <div className="flex min-h-(--control-h) items-center justify-between gap-3 border-b border-border p-3.5 md:border-r">
                        <div className="min-w-0">
                          <FieldLabel htmlFor="quiz-showQuestionPanel">
                            Question overview panel
                          </FieldLabel>
                          <FieldDescription>
                            {durationMode === 'per_question'
                              ? 'Per-question timer always hides the overview panel.'
                              : 'When off, students do not see the numbered question panel beside the attempt.'}
                          </FieldDescription>
                        </div>
                        <Switch
                          id="quiz-showQuestionPanel"
                          checked={
                            durationMode === 'per_question' ? false : quizSettings.showQuestionPanel
                          }
                          disabled={readOnly || durationMode === 'per_question'}
                          onCheckedChange={(checked) =>
                            setQuizSettings((prev) => ({ ...prev, showQuestionPanel: checked }))
                          }
                        />
                      </div>
                      <div className="flex min-h-(--control-h) items-center justify-between gap-3 border-b border-border p-3.5">
                        <div className="min-w-0">
                          <FieldLabel htmlFor="quiz-max-attempts">Number of attempts</FieldLabel>
                          <FieldDescription id="quiz-max-attempts-hint">
                            How many times a student can submit. An admin can still grant an extra
                            attempt.
                          </FieldDescription>
                        </div>
                        <Input
                          id="quiz-max-attempts"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={100}
                          aria-describedby="quiz-max-attempts-hint"
                          className="w-24 shrink-0"
                          value={quizSettings.maxAttempts ?? ''}
                          disabled={readOnly || quizSettings.maxAttempts === null}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            setQuizSettings((prev) => ({
                              ...prev,
                              maxAttempts:
                                Number.isInteger(next) && next >= 1 ? Math.min(100, next) : 1,
                            }));
                          }}
                        />
                      </div>
                      <div className="flex min-h-(--control-h) items-center justify-between gap-3 border-b border-border p-3.5 md:border-r">
                        <div className="min-w-0">
                          <FieldLabel htmlFor="quiz-unlimited-attempts">Unlimited</FieldLabel>
                          <FieldDescription>
                            Students can submit as many times as they need.
                          </FieldDescription>
                        </div>
                        <Switch
                          id="quiz-unlimited-attempts"
                          checked={quizSettings.maxAttempts === null}
                          disabled={readOnly}
                          onCheckedChange={(checked) =>
                            setQuizSettings((prev) => ({
                              ...prev,
                              maxAttempts: checked ? null : (prev.maxAttempts ?? 1),
                            }))
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-3 border-b border-border p-3.5 md:min-h-(--control-h) md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <FieldLabel id="quiz-score-release-label">Score</FieldLabel>
                          <FieldDescription>
                            {quizSettings.scoreRelease === 'after_publish'
                              ? 'Students see the score after an admin publishes the result.'
                              : 'Students see the score as soon as they submit.'}
                          </FieldDescription>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-3">
                          <span
                            id="score-after-submit"
                            className={cn(
                              'text-sm',
                              quizSettings.scoreRelease === 'after_submit'
                                ? 'font-medium text-foreground'
                                : 'text-muted-foreground',
                            )}
                          >
                            After submit
                          </span>
                          <Switch
                            id="quiz-scoreRelease"
                            checked={quizSettings.scoreRelease === 'after_publish'}
                            disabled={readOnly}
                            aria-labelledby="quiz-score-release-label score-after-submit score-after-publish"
                            onCheckedChange={(checked) =>
                              setQuizSettings((prev) => ({
                                ...prev,
                                scoreRelease: checked ? 'after_publish' : 'after_submit',
                              }))
                            }
                          />
                          <span
                            id="score-after-publish"
                            className={cn(
                              'text-sm',
                              quizSettings.scoreRelease === 'after_publish'
                                ? 'font-medium text-foreground'
                                : 'text-muted-foreground',
                            )}
                          >
                            After publish
                          </span>
                        </div>
                      </div>
                      {(
                        [
                          ['shuffleQuestions', 'Shuffle questions'],
                          ['shuffleOptions', 'Shuffle options'],
                          ['answersVisibleToStudent', 'Show answers to students (when published)'],
                        ] as const
                      ).map(([key, label], index, items) => {
                        const cellsBefore = 6;
                        const column = (cellsBefore + index) % 2;
                        const lastAlone =
                          index === items.length - 1 && (cellsBefore + items.length) % 2 === 1;
                        return (
                          <div
                            key={key}
                            className={cn(
                              'flex min-h-(--control-h) items-center justify-between gap-3 border-b border-border p-3.5',
                              column === 0 && !lastAlone ? 'md:border-r' : null,
                            )}
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
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </FieldGroup>
          ) : null}

          {step === 5 ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {noun} summary
                  </p>
                  <h3 className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground">
                    {name.trim() || `Untitled ${noun.toLowerCase()}`}
                  </h3>
                  {description.trim() ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{description}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <FlowStatusPill status={statusLabel(statusKey)} />
                  {!readOnly && statusKey === 'active' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                      Archive
                    </Button>
                  ) : null}
                  {isQuiz && canFull && activityId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={saving}
                      aria-busy={saving}
                      onClick={() => void handleDeleteQuiz()}
                    >
                      <TrashIcon data-icon="inline-start" />
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {isQuiz ? (
                  <>
                    <ReviewFact
                      icon={Building2Icon}
                      label="Sponsor"
                      value={sponsors.find((row) => row.id === sponsorId)?.name || '—'}
                    />
                    <ReviewFact
                      icon={TargetIcon}
                      label="Contest"
                      value={contests.find((row) => row.id === contestId)?.name || '—'}
                    />
                    <ReviewFact
                      icon={LibraryIcon}
                      label="Questions"
                      value={`${quizQuestionCount} on this quiz`}
                    />
                    <ReviewFact
                      icon={RepeatIcon}
                      label="Attempts"
                      value={
                        quizSettings.maxAttempts == null
                          ? 'Unlimited'
                          : String(quizSettings.maxAttempts)
                      }
                    />
                    <ReviewFact
                      icon={PercentIcon}
                      label="Score"
                      value={
                        quizSettings.scoreRelease === 'after_publish'
                          ? 'After publish'
                          : 'After submit'
                      }
                    />
                  </>
                ) : (
                  <>
                    <ReviewFact icon={ClipboardListIcon} label="Code" value={code || 'Auto'} />
                    <ReviewFact
                      icon={LibraryIcon}
                      label="Rounds"
                      value={
                        rounds.length === 0
                          ? 'None'
                          : rounds
                              .map(
                                (r, i) =>
                                  `${r.name || `Round ${i + 1}`} (${r.bankIds.length} bank${
                                    r.bankIds.length === 1 ? '' : 's'
                                  }, ${r.localQuestions.length} manual)`,
                              )
                              .join(' · ')
                      }
                    />
                  </>
                )}
                <ReviewFact
                  icon={UsersIcon}
                  label="Assignment"
                  value={assignMode === 'manual' ? 'Manual selection' : 'All active students'}
                />
                <ReviewFact
                  icon={Clock3Icon}
                  label="Duration"
                  value={
                    isQuiz && durationMode === 'per_question'
                      ? `${perQuestionSeconds || '—'} sec per question`
                      : `${durationMinutes || '—'} min overall`
                  }
                />
                <ReviewFact
                  icon={PercentIcon}
                  label="Passing score"
                  value={`${passingPercent || '—'}%`}
                />
                <ReviewFact
                  icon={LayoutListIcon}
                  label="Presentation"
                  value={PRESENTATION_LABELS[presentation]}
                />
                <ReviewFact
                  icon={ClipboardListIcon}
                  label="Registration fields"
                  value={String(regFields.filter((f) => f.label.trim()).length)}
                />
                {(startDate || endDate) && (
                  <ReviewFact
                    icon={CalendarRangeIcon}
                    label="Window"
                    value={[
                      startDate ? `Opens ${startDate.toLocaleString()}` : null,
                      endDate ? `Due ${endDate.toLocaleString()}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                )}
              </div>

              {!isQuiz && rounds.length > 0 ? (
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Round detail
                  </p>
                  <ul className="mt-3 space-y-2">
                    {rounds.map((r, i) => (
                      <li
                        key={r.key}
                        className="flex flex-col gap-0.5 rounded-lg border border-border/70 bg-card px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="font-medium">{r.name || `Round ${i + 1}`}</span>
                        <span className="text-muted-foreground">
                          {r.bankIds.length} bank{r.bankIds.length === 1 ? '' : 's'} ·{' '}
                          {r.localQuestions.length} manual question
                          {r.localQuestions.length === 1 ? '' : 's'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
                <>
                  {statusKey === 'draft' ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      aria-busy={saving}
                      onClick={() => void persist({ stay: true })}
                    >
                      {saving ? (
                        <Loader2Icon data-icon="inline-start" className="animate-spin" />
                      ) : null}
                      {saving ? 'Saving…' : 'Save draft'}
                    </Button>
                  ) : null}
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
                </>
              ) : statusKey === 'active' ? (
                <Button
                  type="button"
                  disabled={saving}
                  aria-busy={saving}
                  onClick={() => void persist()}
                >
                  {saving ? (
                    <Loader2Icon data-icon="inline-start" className="animate-spin" />
                  ) : null}
                  {saving ? 'Saving…' : 'Save changes'}
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
                    {saving ? 'Saving…' : statusKey === 'draft' ? 'Save draft' : 'Save changes'}
                  </Button>
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
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

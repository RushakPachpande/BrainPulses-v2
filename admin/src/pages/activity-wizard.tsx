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
import { AuthImage } from '@/components/auth-image';
import { CatalogImageField } from '@/components/catalog-image-field';
import { DateTimePicker } from '@/components/date-time-picker';
import { FormPageSkeleton } from '@/components/loading-skeletons';
import { RichTextEditor } from '@/components/rich-text-editor';
import { FlowStatusPill } from '@/components/status-pill';
import { useConfirm } from '@/components/use-confirm';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  deleteActivity,
  getActivity,
  getContests,
  getSponsors,
  getQuestionBank,
  getParticipants,
  publishActivity,
  updateActivity,
  uploadCatalogImage,
  type ActivityKind,
  type ActivityRegistrationField,
  type ActivityRoundLocalQuestion,
  type ActivitySettings,
  type QuizActivitySettings,
  type RoundBehaviourSettings,
} from '@/services';

const defaultQuizSettings = (): QuizActivitySettings => ({
  shuffleQuestions: true,
  shuffleOptions: true,
  scoreRelease: 'after_submit',
  answersVisibleToParticipant: false,
  allowPrevious: true,
  showQuestionPanel: true,
  questionsCompulsory: true,
  negativeMarkingEnabled: false,
  negativeMarkPoints: 0.25,
  maxAttempts: 1,
  questionLimit: null,
});

const defaultRoundBehaviour = (): RoundBehaviourSettings => ({
  shuffleQuestions: true,
  shuffleOptions: true,
  scoreRelease: 'after_submit',
  answersVisibleToParticipant: false,
  allowPrevious: true,
  showQuestionPanel: true,
  questionsCompulsory: true,
  negativeMarkingEnabled: false,
  negativeMarkPoints: 0.25,
  maxAttempts: 1,
  questionLimit: null,
});

type RoundDraft = {
  key: string;
  id?: string;
  name: string;
  imageFileId: string;
  imageFileName: string | null;
  localBankId: string | null;
  questionCount: number;
  bankIds: string[];
  localQuestions: ActivityRoundLocalQuestion[];
  durationMode: 'overall' | 'per_question';
  durationMinutes: string;
  perQuestionSeconds: string;
  presentation: 'one_at_a_time' | 'all_on_page';
  passMode: 'percent' | 'score';
  passingPercent: string;
  passingScore: string;
  settings: RoundBehaviourSettings;
};

const emptyRound = (index: number): RoundDraft => ({
  key: `round_${Math.random().toString(36).slice(2, 9)}`,
  name: `Round ${index + 1}`,
  imageFileId: '',
  imageFileName: null,
  localBankId: null,
  questionCount: 0,
  bankIds: [],
  localQuestions: [],
  durationMode: 'overall',
  durationMinutes: '60',
  perQuestionSeconds: '60',
  presentation: 'one_at_a_time',
  passMode: 'percent',
  passingPercent: '40',
  passingScore: '30',
  settings: defaultRoundBehaviour(),
});

function roundDraftFromActivity(r: {
  id: string;
  name: string;
  imageFileId?: string | null;
  localBankId?: string | null;
  localQuestionCount?: number;
  bankIds: string[];
  localQuestions?: ActivityRoundLocalQuestion[];
  durationMinutes?: number | null;
  durationMode?: 'overall' | 'per_question';
  perQuestionSeconds?: number | null;
  presentation?: 'one_at_a_time' | 'all_on_page';
  passMode?: 'percent' | 'score';
  passingPercent?: number | null;
  passingScore?: number | null;
  settings?: RoundBehaviourSettings | null;
}): RoundDraft {
  const durationMode = r.durationMode === 'per_question' ? 'per_question' : 'overall';
  return {
    key: r.id,
    id: r.id,
    name: r.name,
    imageFileId: r.imageFileId ?? '',
    imageFileName: null,
    localBankId: r.localBankId ?? null,
    questionCount: r.localQuestionCount ?? r.localQuestions?.length ?? 0,
    bankIds: r.bankIds,
    localQuestions: r.localQuestions ?? [],
    durationMode,
    durationMinutes: String(r.durationMinutes ?? 60),
    perQuestionSeconds: String(r.perQuestionSeconds ?? 60),
    presentation:
      durationMode === 'per_question'
        ? 'one_at_a_time'
        : r.presentation === 'all_on_page'
          ? 'all_on_page'
          : 'one_at_a_time',
    passMode: r.passMode === 'score' ? 'score' : 'percent',
    passingPercent: String(r.passingPercent ?? 40),
    passingScore: String(r.passingScore ?? 30),
    settings: {
      ...defaultRoundBehaviour(),
      ...(r.settings ?? {}),
      allowPrevious: durationMode === 'per_question' ? false : (r.settings?.allowPrevious ?? true),
      showQuestionPanel:
        durationMode === 'per_question' ? false : (r.settings?.showQuestionPanel ?? true),
    },
  };
}

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
        ...(isQuiz ? (['Behaviour Settings'] as const) : []),
        'Review & Publish',
      ] as const,
    [isQuiz],
  );

  const [step, setStep] = useState(0);
  const stepName = steps[step];
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
  const roundImageFiles = useRef(new Map<string, File>());
  const [assignMode, setAssignMode] = useState<'manual' | 'all_active_participants'>('manual');
  const [assignNotes, setAssignNotes] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [passingPercent, setPassingPercent] = useState('50');
  const [presentation, setPresentation] = useState<'one_at_a_time' | 'all_on_page'>(
    'one_at_a_time',
  );
  const [instructions, setInstructions] = useState('');
  const [endMessage, setEndMessage] = useState('');
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
        endMessage,
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
          durationMode: r.durationMode,
          durationMinutes: r.durationMinutes,
          perQuestionSeconds: r.perQuestionSeconds,
          presentation: r.presentation,
          passMode: r.passMode,
          passingPercent: r.passingPercent,
          passingScore: r.passingScore,
          settings: r.settings,
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
      endMessage,
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
  }, []);

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
              if (!cancelled) {
                setQuizQuestionCount(bank.items.filter((item) => item.isActive !== false).length);
              }
            } catch {
              if (!cancelled) setQuizQuestionCount(0);
            }
          }
        }
        if (activity.rounds && activity.rounds.length > 0) {
          setRounds(activity.rounds.map((r) => roundDraftFromActivity(r)));
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
        setEndMessage(activity.endMessage ?? '');
        setImageFileId(activity.imageFileId ?? '');
        setImageFile(null);
        const settings = activity.settings;
        const rawFields = settings?.registrationForm?.fields;
        setRegFields(Array.isArray(rawFields) ? rawFields : []);
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
              questionsCompulsory: quizSettings.negativeMarkingEnabled
                ? false
                : quizSettings.questionsCompulsory,
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
      const next = activity.rounds.map((r) => roundDraftFromActivity(r));
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
    if (!sponsorId || !contestId) {
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
        endMessage: isInstructionsEmpty(endMessage) ? null : sanitizeInstructionsHtml(endMessage),
        imageFileId: nextImageFileId,
        startsAt: startDate,
        endsAt: endDate,
        passingPercent: Number.isFinite(passing) ? passing : undefined,
        presentation: isQuiz && durationMode === 'per_question' ? 'one_at_a_time' : presentation,
        sponsorId,
        contestId,
        ...(isQuiz
          ? {
              durationMode,
              durationMinutes: durationMode === 'overall' ? duration : null,
              perQuestionSeconds: durationMode === 'per_question' ? seconds : null,
            }
          : {
              rounds: await Promise.all(
                rounds.map(async (r, i) => {
                  const minutes = Number(r.durationMinutes);
                  const seconds = Number(r.perQuestionSeconds);
                  const pct = Number(r.passingPercent);
                  const score = Number(r.passingScore);
                  const perQ = r.durationMode === 'per_question';
                  const pendingImage = roundImageFiles.current.get(r.key);
                  const imageFileId = pendingImage
                    ? await uploadCatalogImage(pendingImage)
                    : r.imageFileId || null;
                  if (pendingImage) roundImageFiles.current.delete(r.key);
                  return {
                    ...(r.id ? { id: r.id } : {}),
                    name: r.name.trim(),
                    sortOrder: i,
                    imageFileId,
                    bankIds: [],
                    durationMode: r.durationMode,
                    durationMinutes:
                      !perQ && Number.isFinite(minutes) && minutes > 0 ? minutes : null,
                    perQuestionSeconds:
                      perQ && Number.isFinite(seconds) && seconds > 0 ? seconds : null,
                    presentation: perQ ? 'one_at_a_time' : r.presentation,
                    passMode: r.passMode,
                    passingPercent: r.passMode === 'percent' && Number.isFinite(pct) ? pct : null,
                    passingScore: r.passMode === 'score' && Number.isFinite(score) ? score : null,
                    settings: {
                      ...r.settings,
                      allowPrevious: perQ ? false : r.settings.allowPrevious,
                      showQuestionPanel: perQ ? false : r.settings.showQuestionPanel,
                      questionsCompulsory: r.settings.negativeMarkingEnabled
                        ? false
                        : r.settings.questionsCompulsory,
                      negativeMarkPoints: r.settings.negativeMarkingEnabled
                        ? r.settings.negativeMarkPoints
                        : 0,
                    },
                  };
                }),
              ),
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

      if (assignMode === 'all_active_participants') {
        const participants = await getParticipants();
        const activeIds = participants.filter((s) => s.status === 'Active').map((s) => s.id);
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
          {stepName === 'Basic Details' ? (
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
              <Field>
                <FieldLabel htmlFor="activity-description">Description</FieldLabel>
                <Textarea
                  id="activity-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={readOnly}
                />
                <FieldDescription>Participants see this on the start screen.</FieldDescription>
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
                      Shown in a dialog before participants start. If set, they must confirm they
                      have read them. Supports bold, italic, and lists.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="activity-end-message">Quiz End Message</FieldLabel>
                    <RichTextEditor
                      id="activity-end-message"
                      value={endMessage}
                      disabled={readOnly}
                      onChange={setEndMessage}
                      aria-label="Quiz end message"
                    />
                    <FieldDescription>
                      Shown on the result screen after a participant submits. If left empty, the
                      default pass, fail, or pending message is used. Supports bold, italic, and
                      lists.
                    </FieldDescription>
                  </Field>
                </>
              ) : (
                <CatalogImageField
                  id="assessment-image"
                  label="Assessment image"
                  fileId={imageFileId}
                  alt={name.trim() || 'Assessment cover'}
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
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="activity-sponsor">
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
                    <SelectTrigger id="activity-sponsor" className="w-full">
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
                  <FieldLabel htmlFor="activity-contest">
                    Contest <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Select
                    value={contestId || undefined}
                    disabled={readOnly || !sponsorId}
                    onValueChange={setContestId}
                  >
                    <SelectTrigger id="activity-contest" className="w-full">
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

          {stepName === 'Registration Form' ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Optional fields collected before a participant starts (stored with the activity).
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

          {stepName === 'Questions' ? (
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

          {stepName === 'Define Rounds' ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Add rounds in the order participants take them. Each round keeps its own questions
                and behaviour.
              </p>
              {rounds.map((round, index) => (
                <Card key={round.key} className="border-border shadow-none">
                  <CardHeader className="gap-3 @max-[24rem]/has-data-[slot=card-action]:grid-cols-1">
                    <div className="min-w-0 w-full space-y-2">
                      <FieldLabel htmlFor={`round-name-${round.key}`}>
                        Round {index + 1} name
                      </FieldLabel>
                      <Input
                        id={`round-name-${round.key}`}
                        className="w-full min-w-0"
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
                      <CardAction className="flex flex-wrap gap-2 self-end @max-[24rem]:col-start-1 @max-[24rem]:row-start-auto @max-[24rem]:justify-self-start">
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
                          onClick={() => {
                            if (rounds.length <= 1) {
                              toast.error('Every assessment needs at least one round.');
                              return;
                            }
                            void (async () => {
                              const ok = await confirm({
                                title: 'Remove this round?',
                                description: round.id
                                  ? 'Rounds that already have participant attempts cannot be removed.'
                                  : 'Questions linked only to this round draft will be discarded on save.',
                                confirmLabel: 'Remove round',
                                destructive: true,
                              });
                              if (!ok) return;
                              setRounds((prev) => prev.filter((r) => r.key !== round.key));
                            })();
                          }}
                        >
                          <TrashIcon />
                        </Button>
                      </CardAction>
                    ) : null}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <CatalogImageField
                      id={`round-image-${round.key}`}
                      label="Round image"
                      fileId={round.imageFileId}
                      alt={round.name.trim() || 'Round cover'}
                      disabled={readOnly}
                      required={false}
                      onFile={(file) => {
                        if (file) roundImageFiles.current.set(round.key, file);
                        else roundImageFiles.current.delete(round.key);
                        setRounds((prev) =>
                          prev.map((r) =>
                            r.key === round.key
                              ? { ...r, imageFileName: file ? file.name : null }
                              : r,
                          ),
                        );
                      }}
                      onPickExisting={(fileId) => {
                        roundImageFiles.current.delete(round.key);
                        setRounds((prev) =>
                          prev.map((r) =>
                            r.key === round.key
                              ? { ...r, imageFileId: fileId, imageFileName: null }
                              : r,
                          ),
                        );
                      }}
                      onClear={() => {
                        roundImageFiles.current.delete(round.key);
                        setRounds((prev) =>
                          prev.map((r) =>
                            r.key === round.key
                              ? { ...r, imageFileId: '', imageFileName: null }
                              : r,
                          ),
                        );
                      }}
                    />
                    <QuizQuestionsPanel
                      bankId={round.localBankId}
                      kind="assessment"
                      readOnly={readOnly}
                      onCount={(count) =>
                        setRounds((prev) =>
                          prev.map((r) =>
                            r.key === round.key ? { ...r, questionCount: count } : r,
                          ),
                        )
                      }
                      onEnsureBank={async () => {
                        const savedId = (await persist({ stay: true })) ?? activityId;
                        if (!savedId) return null;
                        const synced = await syncRoundsFromServer(savedId);
                        return synced[index]?.localBankId ?? null;
                      }}
                    />

                    <div className="flex flex-col gap-3 border-t border-border pt-4">
                      <p className="text-sm font-medium">Round behaviour</p>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor={`round-duration-mode-${round.key}`}>
                            Time duration
                          </FieldLabel>
                          <Select
                            value={round.durationMode}
                            disabled={readOnly}
                            onValueChange={(value) => {
                              const next = value as 'overall' | 'per_question';
                              setRounds((prev) =>
                                prev.map((r) =>
                                  r.key === round.key
                                    ? {
                                        ...r,
                                        durationMode: next,
                                        presentation:
                                          next === 'per_question'
                                            ? 'one_at_a_time'
                                            : r.presentation,
                                        settings: {
                                          ...r.settings,
                                          allowPrevious:
                                            next === 'per_question'
                                              ? false
                                              : r.settings.allowPrevious,
                                          showQuestionPanel:
                                            next === 'per_question'
                                              ? false
                                              : r.settings.showQuestionPanel,
                                        },
                                      }
                                    : r,
                                ),
                              );
                            }}
                          >
                            <SelectTrigger
                              id={`round-duration-mode-${round.key}`}
                              className="w-full"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="overall">Overall round</SelectItem>
                                <SelectItem value="per_question">Per question</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                        {round.durationMode === 'per_question' ? (
                          <Field>
                            <FieldLabel htmlFor={`round-per-q-${round.key}`}>
                              Seconds per question
                            </FieldLabel>
                            <Input
                              id={`round-per-q-${round.key}`}
                              type="number"
                              min={1}
                              value={round.perQuestionSeconds}
                              disabled={readOnly}
                              onChange={(e) => {
                                const value = e.target.value;
                                setRounds((prev) =>
                                  prev.map((r) =>
                                    r.key === round.key ? { ...r, perQuestionSeconds: value } : r,
                                  ),
                                );
                              }}
                            />
                          </Field>
                        ) : (
                          <Field>
                            <FieldLabel htmlFor={`round-duration-${round.key}`}>
                              Duration (minutes)
                            </FieldLabel>
                            <Input
                              id={`round-duration-${round.key}`}
                              type="number"
                              min={1}
                              value={round.durationMinutes}
                              disabled={readOnly}
                              onChange={(e) => {
                                const value = e.target.value;
                                setRounds((prev) =>
                                  prev.map((r) =>
                                    r.key === round.key ? { ...r, durationMinutes: value } : r,
                                  ),
                                );
                              }}
                            />
                          </Field>
                        )}
                        <Field>
                          <FieldLabel htmlFor={`round-presentation-${round.key}`}>
                            Presentation
                          </FieldLabel>
                          <Select
                            value={
                              round.durationMode === 'per_question'
                                ? 'one_at_a_time'
                                : round.presentation
                            }
                            disabled={readOnly || round.durationMode === 'per_question'}
                            onValueChange={(v) =>
                              setRounds((prev) =>
                                prev.map((r) =>
                                  r.key === round.key
                                    ? {
                                        ...r,
                                        presentation: v as 'one_at_a_time' | 'all_on_page',
                                      }
                                    : r,
                                ),
                              )
                            }
                          >
                            <SelectTrigger
                              id={`round-presentation-${round.key}`}
                              className="w-full"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="one_at_a_time">
                                  One question at a time
                                </SelectItem>
                                <SelectItem
                                  value="all_on_page"
                                  disabled={round.durationMode === 'per_question'}
                                >
                                  All on one page
                                </SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={`round-pass-mode-${round.key}`}>
                            Pass condition
                          </FieldLabel>
                          <Select
                            value={round.passMode}
                            disabled={readOnly}
                            onValueChange={(v) =>
                              setRounds((prev) =>
                                prev.map((r) =>
                                  r.key === round.key
                                    ? { ...r, passMode: v as 'percent' | 'score' }
                                    : r,
                                ),
                              )
                            }
                          >
                            <SelectTrigger id={`round-pass-mode-${round.key}`} className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="percent">Percentage</SelectItem>
                                <SelectItem value="score">Score (marks)</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                        {round.passMode === 'score' ? (
                          <Field>
                            <FieldLabel htmlFor={`round-pass-score-${round.key}`}>
                              Passing score
                            </FieldLabel>
                            <Input
                              id={`round-pass-score-${round.key}`}
                              type="number"
                              min={0}
                              value={round.passingScore}
                              disabled={readOnly}
                              onChange={(e) => {
                                const value = e.target.value;
                                setRounds((prev) =>
                                  prev.map((r) =>
                                    r.key === round.key ? { ...r, passingScore: value } : r,
                                  ),
                                );
                              }}
                            />
                          </Field>
                        ) : (
                          <Field>
                            <FieldLabel htmlFor={`round-pass-pct-${round.key}`}>
                              Passing percent
                            </FieldLabel>
                            <Input
                              id={`round-pass-pct-${round.key}`}
                              type="number"
                              min={0}
                              max={100}
                              value={round.passingPercent}
                              disabled={readOnly}
                              onChange={(e) => {
                                const value = e.target.value;
                                setRounds((prev) =>
                                  prev.map((r) =>
                                    r.key === round.key ? { ...r, passingPercent: value } : r,
                                  ),
                                );
                              }}
                            />
                          </Field>
                        )}
                      </div>

                      <div className="overflow-hidden rounded-xl border border-border">
                        <div className="flex flex-col divide-y divide-border">
                          <div className="flex min-h-(--control-h) items-center justify-between gap-3 p-3.5">
                            <div className="min-w-0">
                              <FieldLabel htmlFor={`round-allow-prev-${round.key}`}>
                                Allow Previous
                              </FieldLabel>
                              <FieldDescription>
                                {round.durationMode === 'per_question'
                                  ? 'Per-question timer always blocks going back.'
                                  : 'When off, participants cannot return to earlier questions.'}
                              </FieldDescription>
                            </div>
                            <Switch
                              id={`round-allow-prev-${round.key}`}
                              checked={
                                round.durationMode === 'per_question'
                                  ? false
                                  : round.settings.allowPrevious
                              }
                              disabled={readOnly || round.durationMode === 'per_question'}
                              onCheckedChange={(checked) =>
                                setRounds((prev) =>
                                  prev.map((r) =>
                                    r.key === round.key
                                      ? {
                                          ...r,
                                          settings: { ...r.settings, allowPrevious: checked },
                                        }
                                      : r,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="flex min-h-(--control-h) items-center justify-between gap-3 p-3.5">
                            <div className="min-w-0">
                              <FieldLabel htmlFor={`round-compulsory-${round.key}`}>
                                Questions are compulsory
                              </FieldLabel>
                            </div>
                            <Switch
                              id={`round-compulsory-${round.key}`}
                              checked={
                                round.settings.negativeMarkingEnabled
                                  ? false
                                  : round.settings.questionsCompulsory
                              }
                              disabled={readOnly || round.settings.negativeMarkingEnabled}
                              onCheckedChange={(checked) =>
                                setRounds((prev) =>
                                  prev.map((r) =>
                                    r.key === round.key
                                      ? {
                                          ...r,
                                          settings: {
                                            ...r.settings,
                                            questionsCompulsory: checked,
                                          },
                                        }
                                      : r,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-3 p-3.5">
                            <div className="flex min-h-(--control-h) items-center justify-between gap-3">
                              <div className="min-w-0">
                                <FieldLabel htmlFor={`round-neg-${round.key}`}>
                                  Negative marking
                                </FieldLabel>
                              </div>
                              <Switch
                                id={`round-neg-${round.key}`}
                                checked={round.settings.negativeMarkingEnabled}
                                disabled={readOnly}
                                onCheckedChange={(checked) =>
                                  setRounds((prev) =>
                                    prev.map((r) =>
                                      r.key === round.key
                                        ? {
                                            ...r,
                                            settings: {
                                              ...r.settings,
                                              negativeMarkingEnabled: checked,
                                              questionsCompulsory: checked
                                                ? false
                                                : r.settings.questionsCompulsory,
                                              negativeMarkPoints:
                                                checked && r.settings.negativeMarkPoints <= 0
                                                  ? 0.25
                                                  : r.settings.negativeMarkPoints,
                                            },
                                          }
                                        : r,
                                    ),
                                  )
                                }
                              />
                            </div>
                            {round.settings.negativeMarkingEnabled ? (
                              <Field>
                                <FieldLabel htmlFor={`round-neg-pts-${round.key}`}>
                                  Marks deducted per wrong answer
                                </FieldLabel>
                                <Input
                                  id={`round-neg-pts-${round.key}`}
                                  type="number"
                                  min={0.01}
                                  step={0.01}
                                  value={round.settings.negativeMarkPoints}
                                  disabled={readOnly}
                                  onChange={(e) =>
                                    setRounds((prev) =>
                                      prev.map((r) =>
                                        r.key === round.key
                                          ? {
                                              ...r,
                                              settings: {
                                                ...r.settings,
                                                negativeMarkPoints: Number(e.target.value) || 0,
                                              },
                                            }
                                          : r,
                                      ),
                                    )
                                  }
                                />
                              </Field>
                            ) : null}
                          </div>
                          <div className="flex min-h-(--control-h) items-center justify-between gap-3 p-3.5">
                            <div className="min-w-0">
                              <FieldLabel htmlFor={`round-panel-${round.key}`}>
                                Question overview panel
                              </FieldLabel>
                            </div>
                            <Switch
                              id={`round-panel-${round.key}`}
                              checked={
                                round.durationMode === 'per_question'
                                  ? false
                                  : round.settings.showQuestionPanel
                              }
                              disabled={readOnly || round.durationMode === 'per_question'}
                              onCheckedChange={(checked) =>
                                setRounds((prev) =>
                                  prev.map((r) =>
                                    r.key === round.key
                                      ? {
                                          ...r,
                                          settings: {
                                            ...r.settings,
                                            showQuestionPanel: checked,
                                          },
                                        }
                                      : r,
                                  ),
                                )
                              }
                            />
                          </div>
                          {(
                            [
                              ['shuffleQuestions', 'Shuffle questions'],
                              ['shuffleOptions', 'Shuffle options'],
                              [
                                'answersVisibleToParticipant',
                                'Show answers to participants (when published)',
                              ],
                            ] as const
                          ).map(([key, label]) => (
                            <div
                              key={key}
                              className="flex min-h-(--control-h) items-center justify-between gap-3 p-3.5"
                            >
                              <FieldLabel htmlFor={`round-${key}-${round.key}`}>{label}</FieldLabel>
                              <Switch
                                id={`round-${key}-${round.key}`}
                                checked={round.settings[key]}
                                disabled={readOnly}
                                onCheckedChange={(checked) =>
                                  setRounds((prev) =>
                                    prev.map((r) =>
                                      r.key === round.key
                                        ? { ...r, settings: { ...r.settings, [key]: checked } }
                                        : r,
                                    ),
                                  )
                                }
                              />
                            </div>
                          ))}
                          <div className="flex flex-col gap-3 p-3.5 sm:min-h-(--control-h) sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <FieldLabel id={`round-score-label-${round.key}`}>Score</FieldLabel>
                              <FieldDescription>
                                {round.settings.scoreRelease === 'after_publish'
                                  ? 'Participants see the score after an admin publishes the result.'
                                  : 'Participants see the score as soon as they submit.'}
                              </FieldDescription>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-3">
                              <span
                                className={cn(
                                  'text-sm',
                                  round.settings.scoreRelease === 'after_submit'
                                    ? 'font-medium text-foreground'
                                    : 'text-muted-foreground',
                                )}
                              >
                                After submit
                              </span>
                              <Switch
                                id={`round-score-${round.key}`}
                                checked={round.settings.scoreRelease === 'after_publish'}
                                disabled={readOnly}
                                aria-labelledby={`round-score-label-${round.key}`}
                                onCheckedChange={(checked) =>
                                  setRounds((prev) =>
                                    prev.map((r) =>
                                      r.key === round.key
                                        ? {
                                            ...r,
                                            settings: {
                                              ...r.settings,
                                              scoreRelease: checked
                                                ? 'after_publish'
                                                : 'after_submit',
                                            },
                                          }
                                        : r,
                                    ),
                                  )
                                }
                              />
                              <span
                                className={cn(
                                  'text-sm',
                                  round.settings.scoreRelease === 'after_publish'
                                    ? 'font-medium text-foreground'
                                    : 'text-muted-foreground',
                                )}
                              >
                                After publish
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-3 p-3.5 sm:min-h-(--control-h) sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <FieldLabel htmlFor={`round-attempts-${round.key}`}>
                                Number of attempts
                              </FieldLabel>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-3">
                              <Input
                                id={`round-attempts-${round.key}`}
                                type="number"
                                min={1}
                                max={100}
                                className="w-24"
                                value={round.settings.maxAttempts ?? ''}
                                disabled={readOnly || round.settings.maxAttempts === null}
                                onChange={(e) => {
                                  const next = Number(e.target.value);
                                  setRounds((prev) =>
                                    prev.map((r) =>
                                      r.key === round.key
                                        ? {
                                            ...r,
                                            settings: {
                                              ...r.settings,
                                              maxAttempts:
                                                Number.isInteger(next) && next >= 1
                                                  ? Math.min(100, next)
                                                  : 1,
                                            },
                                          }
                                        : r,
                                    ),
                                  );
                                }}
                              />
                              <div className="flex items-center gap-2">
                                <FieldLabel
                                  htmlFor={`round-unlimited-${round.key}`}
                                  className="text-sm font-normal text-muted-foreground"
                                >
                                  Unlimited
                                </FieldLabel>
                                <Switch
                                  id={`round-unlimited-${round.key}`}
                                  checked={round.settings.maxAttempts === null}
                                  disabled={readOnly}
                                  onCheckedChange={(checked) =>
                                    setRounds((prev) =>
                                      prev.map((r) =>
                                        r.key === round.key
                                          ? {
                                              ...r,
                                              settings: {
                                                ...r.settings,
                                                maxAttempts: checked
                                                  ? null
                                                  : (r.settings.maxAttempts ?? 1),
                                              },
                                            }
                                          : r,
                                      ),
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-3 p-3.5 sm:min-h-(--control-h) sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <FieldLabel htmlFor={`round-question-limit-${round.key}`}>
                                Number of questions
                              </FieldLabel>
                              <FieldDescription>
                                How many questions a participant sees. A passage stays together.
                                Turn on All to use every question.
                              </FieldDescription>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-3">
                              <Input
                                id={`round-question-limit-${round.key}`}
                                type="number"
                                min={1}
                                max={500}
                                className="w-24"
                                value={round.settings.questionLimit ?? ''}
                                disabled={readOnly || round.settings.questionLimit === null}
                                onChange={(e) => {
                                  const next = Number(e.target.value);
                                  setRounds((prev) =>
                                    prev.map((r) =>
                                      r.key === round.key
                                        ? {
                                            ...r,
                                            settings: {
                                              ...r.settings,
                                              questionLimit:
                                                Number.isInteger(next) && next >= 1
                                                  ? Math.min(500, next)
                                                  : 1,
                                            },
                                          }
                                        : r,
                                    ),
                                  );
                                }}
                              />
                              <div className="flex items-center gap-2">
                                <FieldLabel
                                  htmlFor={`round-all-questions-${round.key}`}
                                  className="text-sm font-normal text-muted-foreground"
                                >
                                  All
                                </FieldLabel>
                                <Switch
                                  id={`round-all-questions-${round.key}`}
                                  checked={round.settings.questionLimit === null}
                                  disabled={readOnly}
                                  onCheckedChange={(checked) =>
                                    setRounds((prev) =>
                                      prev.map((r) =>
                                        r.key === round.key
                                          ? {
                                              ...r,
                                              settings: {
                                                ...r.settings,
                                                questionLimit: checked
                                                  ? null
                                                  : (r.settings.questionLimit ?? 10),
                                              },
                                            }
                                          : r,
                                      ),
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
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

          {stepName === 'Assignment Rules' ? (
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
                      <SelectItem value="all_active_participants">
                        All active participants
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  “All active participants” assigns every active participant when you save or
                  publish.
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

          {stepName === 'Behaviour Settings' ? (
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
                  <p className="text-sm text-muted-foreground md:col-span-2">
                    Timer, presentation, attempts, and pass rules are set on each round in Define
                    Rounds.
                  </p>
                )}
                {isQuiz ? (
                  <>
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
                        value={durationMode === 'per_question' ? 'one_at_a_time' : presentation}
                        disabled={readOnly || durationMode === 'per_question'}
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
                              disabled={durationMode === 'per_question'}
                            >
                              All on one page
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {durationMode === 'per_question' ? (
                        <FieldDescription>
                          Per-question timer requires one question at a time.
                        </FieldDescription>
                      ) : null}
                    </Field>
                  </>
                ) : null}
              </div>
              {isQuiz ? (
                <div className="flex flex-col gap-3 border-t border-border pt-4">
                  <p className="text-sm font-medium">Quiz behaviour</p>
                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="flex flex-col divide-y divide-border">
                      <div className="flex min-h-(--control-h) items-center justify-between gap-3 p-3.5">
                        <div className="min-w-0">
                          <FieldLabel htmlFor="quiz-allowPrevious">Allow Previous</FieldLabel>
                          <FieldDescription>
                            {durationMode === 'per_question'
                              ? 'Per-question timer always blocks going back.'
                              : 'When off, participants cannot return to earlier questions.'}
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
                      <div className="flex min-h-(--control-h) items-center justify-between gap-3 p-3.5">
                        <div className="min-w-0">
                          <FieldLabel htmlFor="quiz-questionsCompulsory">
                            Questions are compulsory
                          </FieldLabel>
                          <FieldDescription>
                            {quizSettings.negativeMarkingEnabled
                              ? 'Off while negative marking is enabled so unanswered questions stay allowed.'
                              : 'When on, participants must answer before they can go to the next question or submit. When off, they can skip with a confirmation.'}
                          </FieldDescription>
                        </div>
                        <Switch
                          id="quiz-questionsCompulsory"
                          checked={
                            quizSettings.negativeMarkingEnabled
                              ? false
                              : quizSettings.questionsCompulsory
                          }
                          disabled={readOnly || quizSettings.negativeMarkingEnabled}
                          onCheckedChange={(checked) =>
                            setQuizSettings((prev) => ({
                              ...prev,
                              questionsCompulsory: checked,
                            }))
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-3 p-3.5">
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
                                questionsCompulsory: checked ? false : prev.questionsCompulsory,
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
                      <div className="flex min-h-(--control-h) items-center justify-between gap-3 p-3.5">
                        <div className="min-w-0">
                          <FieldLabel htmlFor="quiz-showQuestionPanel">
                            Question overview panel
                          </FieldLabel>
                          <FieldDescription>
                            {durationMode === 'per_question'
                              ? 'Per-question timer always hides the overview panel.'
                              : 'When off, participants do not see the numbered question panel beside the attempt.'}
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
                      <div className="flex flex-col gap-3 p-3.5 sm:min-h-(--control-h) sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <FieldLabel htmlFor="quiz-max-attempts">Number of attempts</FieldLabel>
                          <FieldDescription id="quiz-max-attempts-hint">
                            How many times a participant can submit. Turn on Unlimited for no limit.
                            An admin can still grant an extra attempt.
                          </FieldDescription>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-3">
                          <Input
                            id="quiz-max-attempts"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={100}
                            aria-describedby="quiz-max-attempts-hint"
                            className="w-24"
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
                          <div className="flex items-center gap-2">
                            <FieldLabel
                              htmlFor="quiz-unlimited-attempts"
                              className="text-sm font-normal text-muted-foreground"
                            >
                              Unlimited
                            </FieldLabel>
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
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 p-3.5 sm:min-h-(--control-h) sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <FieldLabel htmlFor="quiz-question-limit">Number of questions</FieldLabel>
                          <FieldDescription id="quiz-question-limit-hint">
                            How many questions a participant sees. A passage stays together. Turn on
                            All to use every question.
                          </FieldDescription>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-3">
                          <Input
                            id="quiz-question-limit"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={500}
                            aria-describedby="quiz-question-limit-hint"
                            className="w-24"
                            value={quizSettings.questionLimit ?? ''}
                            disabled={readOnly || quizSettings.questionLimit === null}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              setQuizSettings((prev) => ({
                                ...prev,
                                questionLimit:
                                  Number.isInteger(next) && next >= 1 ? Math.min(500, next) : 1,
                              }));
                            }}
                          />
                          <div className="flex items-center gap-2">
                            <FieldLabel
                              htmlFor="quiz-all-questions"
                              className="text-sm font-normal text-muted-foreground"
                            >
                              All
                            </FieldLabel>
                            <Switch
                              id="quiz-all-questions"
                              checked={quizSettings.questionLimit === null}
                              disabled={readOnly}
                              onCheckedChange={(checked) =>
                                setQuizSettings((prev) => ({
                                  ...prev,
                                  questionLimit: checked ? null : (prev.questionLimit ?? 10),
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 p-3.5 sm:min-h-(--control-h) sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <FieldLabel id="quiz-score-release-label">Score</FieldLabel>
                          <FieldDescription>
                            {quizSettings.scoreRelease === 'after_publish'
                              ? 'Participants see the score after an admin publishes the result.'
                              : 'Participants see the score as soon as they submit.'}
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
                          [
                            'answersVisibleToParticipant',
                            'Show answers to participants (when published)',
                          ],
                        ] as const
                      ).map(([key, label]) => (
                        <div
                          key={key}
                          className="flex min-h-(--control-h) items-center justify-between gap-3 p-3.5"
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
                    </div>
                  </div>
                </div>
              ) : null}
            </FieldGroup>
          ) : null}

          {stepName === 'Review & Publish' ? (
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
                            description: 'Participants will no longer be able to start it.',
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
                {isQuiz ? (
                  <>
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
                  <ReviewFact
                    icon={LibraryIcon}
                    label="Rounds"
                    value={
                      rounds.length === 0
                        ? 'None'
                        : rounds
                            .map(
                              (r, i) =>
                                `${r.name || `Round ${i + 1}`} (${r.questionCount} question${
                                  r.questionCount === 1 ? '' : 's'
                                })`,
                            )
                            .join(' · ')
                    }
                  />
                )}
                <ReviewFact
                  icon={UsersIcon}
                  label="Assignment"
                  value={assignMode === 'manual' ? 'Manual selection' : 'All active participants'}
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
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Round detail
                  </p>
                  <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {rounds.map((r, i) => {
                      const perQ = r.durationMode === 'per_question';
                      const duration = perQ
                        ? `${r.perQuestionSeconds || '—'} sec each`
                        : `${r.durationMinutes || '—'} min`;
                      const pass =
                        r.passMode === 'score'
                          ? `${r.passingScore || '—'} points`
                          : `${r.passingPercent || '—'}%`;
                      const attempts =
                        r.settings.maxAttempts == null
                          ? 'Unlimited'
                          : String(r.settings.maxAttempts);
                      const questions =
                        r.settings.questionLimit == null
                          ? 'All questions'
                          : `${r.settings.questionLimit} shown`;
                      return (
                        <li
                          key={r.key}
                          className="flex min-w-0 gap-3 rounded-xl border border-border/80 bg-muted/40 p-3.5"
                        >
                          {r.imageFileId ? (
                            <AuthImage
                              fileId={r.imageFileId}
                              alt=""
                              className="size-16 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <span className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-xs font-semibold text-muted-foreground">
                              {r.imageFileName ? 'New' : 'No image'}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {r.name || `Round ${i + 1}`}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {r.questionCount} question{r.questionCount === 1 ? '' : 's'} ·{' '}
                              {questions}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {duration} · Pass {pass} · {attempts} attempt
                              {r.settings.maxAttempts === 1 ? '' : 's'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Score{' '}
                              {r.settings.scoreRelease === 'after_publish'
                                ? 'after publish'
                                : 'after submit'}
                              {' · '}
                              Shuffle questions {r.settings.shuffleQuestions ? 'on' : 'off'}
                              {' · '}
                              Shuffle options {r.settings.shuffleOptions ? 'on' : 'off'}
                            </p>
                          </div>
                        </li>
                      );
                    })}
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
                          description: 'Assigned participants can start it.',
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

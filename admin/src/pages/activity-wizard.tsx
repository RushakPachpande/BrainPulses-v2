import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { DateTimePicker } from '@/components/date-time-picker';
import { FormPageSkeleton } from '@/components/loading-skeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { canEditKind } from '@/lib/access';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import {
  archiveActivity,
  assignRegistrations,
  createActivity,
  getActivity,
  getQuestionBanks,
  getStudents,
  publishActivity,
  updateActivity,
  type ActivityKind,
  type ActivityRegistrationField,
  type ActivitySettings,
} from '@/services';

const steps = [
  'Basic Details',
  'Registration Form',
  'Select Question Banks',
  'Assignment Rules',
  'Behaviour Settings',
  'Review & Publish',
] as const;

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
  const params = useParams();
  const auth = useAuth();
  const canEdit = canEditKind(auth.status === 'authenticated' ? auth.membership : null, kind);
  const activityIdParam = params.activityId ?? '';
  const isQuiz = kind === 'quiz';
  const noun = isQuiz ? 'Quiz' : 'Assessment';
  const listPath = isQuiz ? '/quizzes' : '/assessments';
  const readOnly = mode === 'view';

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(mode !== 'create');
  const [saving, setSaving] = useState(false);
  const [activityId, setActivityId] = useState<string | null>(
    mode === 'create' ? null : activityIdParam,
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d;
  });
  const [statusKey, setStatusKey] = useState('draft');

  const [regFields, setRegFields] = useState<FieldDraft[]>([]);
  const [bankIds, setBankIds] = useState<string[]>([]);
  const [banks, setBanks] = useState<{ id: string; name: string; questions: number }[]>([]);
  const [assignMode, setAssignMode] = useState<'manual' | 'all_active_students'>('manual');
  const [assignNotes, setAssignNotes] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [passingPercent, setPassingPercent] = useState('40');
  const [presentation, setPresentation] = useState<'one_at_a_time' | 'all_on_page' | 'timed_card'>(
    'one_at_a_time',
  );

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
    if (mode === 'create') return;
    let cancelled = false;
    (async () => {
      try {
        const activity = await getActivity(activityIdParam);
        if (cancelled) return;
        setActivityId(activity.id);
        setName(activity.name);
        setDescription(activity.subtitle);
        setCode(activity.code);
        setStatusKey(activity.statusKey);
        if (activity.startsAt) setStartDate(new Date(activity.startsAt));
        if (activity.endsAt) setEndDate(new Date(activity.endsAt));
        setBankIds(activity.bankIds);
        setDurationMinutes(String(activity.durationMinutes ?? 60));
        setPassingPercent(String(activity.passingPercent ?? 40));
        setPresentation(activity.presentation);
        const settings = activity.settings;
        setRegFields(settings?.registrationForm?.fields ?? []);
        setAssignMode(settings?.assignmentRules?.mode ?? 'manual');
        setAssignNotes(settings?.assignmentRules?.notes ?? '');
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
    };
  }, [assignMode, assignNotes, regFields]);

  async function persist(opts?: { publish?: boolean; archive?: boolean; stay?: boolean }) {
    if (readOnly) return activityId;
    if (!name.trim()) {
      toast.error('Name is required.');
      setStep(0);
      return null;
    }
    setSaving(true);
    try {
      const duration = Number(durationMinutes);
      const passing = Number(passingPercent);
      const payload = {
        name: name.trim(),
        subtitle: description.trim() || undefined,
        startsAt: startDate,
        endsAt: endDate,
        durationMinutes: Number.isFinite(duration) && duration > 0 ? duration : undefined,
        passingPercent: Number.isFinite(passing) ? passing : undefined,
        presentation,
        bankIds,
        settings: settingsPayload,
        ...(code.trim() ? { code: code.trim() } : {}),
      };

      let id = activityId;
      if (!id) {
        const created = await createActivity({ kind, ...payload });
        id = created.id;
        setActivityId(created.id);
        if (created.code) setCode(created.code);
      } else {
        await updateActivity(id, payload);
      }

      if (assignMode === 'all_active_students') {
        const students = await getStudents();
        const activeIds = students.filter((s) => s.status === 'Active').map((s) => s.id);
        if (activeIds.length > 0) {
          await assignRegistrations(id, activeIds);
        }
      }

      if (opts?.publish) {
        await publishActivity(id);
        setStatusKey('active');
        toast.success(`${noun} published.`);
      } else if (opts?.archive) {
        await archiveActivity(id);
        setStatusKey('archived');
        toast.success(`${noun} archived.`);
      } else {
        toast.success(`${noun} saved.`);
      }

      if (!opts?.stay) {
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Start Date</FieldLabel>
                  <DateTimePicker
                    id="start-date"
                    value={startDate}
                    onChange={setStartDate}
                    disabled={readOnly}
                  />
                </Field>
                <Field>
                  <FieldLabel>End Date</FieldLabel>
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

          {step === 2 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Select one or more question banks for this {noun.toLowerCase()}.
              </p>
              {banks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No banks yet.{' '}
                  <Link className="underline" to={`${listPath}/banks/new`}>
                    Create a bank
                  </Link>
                </p>
              ) : (
                banks.map((bank) => {
                  const checked = bankIds.includes(bank.id);
                  return (
                    <label
                      key={bank.id}
                      className="flex min-h-(--control-h) items-center gap-3 rounded-lg border border-border px-3"
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
            </FieldGroup>
          ) : null}

          {step === 5 ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Name:</span> {name || '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Code:</span> {code || 'Auto'}
              </p>
              <p>
                <span className="text-muted-foreground">Banks:</span>{' '}
                {bankIds.length === 0
                  ? 'None'
                  : banks
                      .filter((b) => bankIds.includes(b.id))
                      .map((b) => b.name)
                      .join(', ')}
              </p>
              <p>
                <span className="text-muted-foreground">Assignment:</span>{' '}
                {assignMode === 'manual' ? 'Manual' : 'All active students'}
              </p>
              <p>
                <span className="text-muted-foreground">Duration:</span> {durationMinutes || '—'}{' '}
                min · Pass {passingPercent || '—'}%
              </p>
              <p>
                <span className="text-muted-foreground">Registration fields:</span>{' '}
                {regFields.filter((f) => f.label.trim()).length}
              </p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0 || saving}
              onClick={goBack}
            >
              Back
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              {readOnly ? (
                <Button
                  type="button"
                  disabled={step === steps.length - 1}
                  onClick={() => setStep((s) => Math.min(s + 1, steps.length - 1))}
                >
                  Next
                </Button>
              ) : step < steps.length - 1 ? (
                <Button type="button" disabled={saving} onClick={() => void goNext()}>
                  {saving ? 'Saving…' : 'Save & continue'}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void persist()}
                  >
                    Save draft
                  </Button>
                  {statusKey === 'active' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={saving}
                      onClick={() => void persist({ archive: true })}
                    >
                      Archive
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={saving}
                      onClick={() => void persist({ publish: true })}
                    >
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

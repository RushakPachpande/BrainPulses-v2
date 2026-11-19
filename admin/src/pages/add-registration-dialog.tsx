import { useId, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ContestFormFieldInput } from '@/components/contest-form-field-input';
import { FormDialog } from '@/components/form-dialog';
import { SaveButton } from '@/components/save-button';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConfirm } from '@/components/use-confirm';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { useOrgId } from '@/hooks/use-org-id';
import { ApiError } from '@/lib/api-client';
import { previewIssues, type ContestFormRecord, type FormField } from '@/lib/contest-form';
import { adminQueryKeys } from '@/lib/query-keys';
import { createManualRegistration, getActivities, type ActivityKind } from '@/services';
import { getContestFormOverview } from '@/services/contest-forms';

type Answers = Record<string, string | string[] | boolean>;

const BASIC_FIELDS: FormField[] = [
  {
    id: 'first_name',
    key: 'first_name',
    locked: true,
    label: 'First name',
    type: 'text',
    required: true,
  },
  {
    id: 'last_name',
    key: 'last_name',
    locked: true,
    label: 'Last name',
    type: 'text',
    required: true,
  },
  {
    id: 'email',
    key: 'email',
    locked: true,
    label: 'Email',
    type: 'email',
    required: true,
    placeholder: 'participant@example.com',
  },
  {
    id: 'mobile',
    key: 'mobile',
    locked: true,
    label: 'Mobile number',
    type: 'phone',
    required: true,
  },
];

export function AddRegistrationDialog({
  kind,
  onOpenChange,
}: {
  kind: ActivityKind;
  onOpenChange: (open: boolean) => void;
}) {
  const formId = useId();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const orgId = useOrgId();
  const isQuiz = kind === 'quiz';
  const activityLabel = isQuiz ? 'Quiz' : 'Assessment';
  const { data: activities, isPending: activitiesPending } = useQuery({
    queryKey: adminQueryKeys.activities(orgId, kind),
    queryFn: ({ signal }) => getActivities(kind, signal),
    enabled: Boolean(orgId),
  });
  const {
    data: overview,
    isPending: formsPending,
    isError: formsError,
  } = useQuery({
    queryKey: ['admin', 'contest-forms', orgId],
    queryFn: ({ signal }) => getContestFormOverview(signal),
    enabled: Boolean(orgId),
  });
  const options = (activities ?? []).filter((activity) => {
    const status = activity.status.toLowerCase();
    return status === 'active' || status === 'draft';
  });
  const [activityId, setActivityId] = useState('');
  const [chosenFormId, setChosenFormId] = useState('');
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const allowLeave = useLeaveGuard(dirty);

  const matching = (overview?.forms ?? []).filter(
    (form) => form.status === 'saved' && form.quizzes.some((quiz) => quiz.id === activityId),
  );
  const chosenForm =
    matching.length === 1 ? matching[0] : matching.find((form) => form.id === chosenFormId);
  const fields = (chosenForm ? chosenForm.fields : BASIC_FIELDS).filter((field) => !field.deleted);
  const waiting = activitiesPending || formsPending;
  const needsFormPick = matching.length > 1 && !chosenForm;
  const showFields = Boolean(activityId) && !waiting && !formsError && !needsFormPick;

  function markDirty() {
    setDirty(true);
  }

  function resetAnswers() {
    setAnswers({});
    setErrors({});
  }

  async function requestClose() {
    if (saving) return;
    if (dirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        description: 'These changes will not be saved.',
        confirmLabel: 'Discard',
        destructive: true,
      });
      if (!ok) return;
    }
    setDirty(false);
    onOpenChange(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || waiting || formsError) return;
    if (!activityId) {
      toast.error(`Select a ${activityLabel.toLowerCase()}.`);
      return;
    }
    if (matching.length > 1 && !chosenForm) {
      toast.error('Select a registration form.');
      return;
    }
    const issues = previewIssues(fields, answers);
    if (issues.length > 0) {
      const next: Record<string, string> = {};
      for (const issue of issues) next[issue.field] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const created = await createManualRegistration(
        chosenForm
          ? { activityId, formId: chosenForm.id, answers }
          : {
              activityId,
              firstName: textAnswer('first_name'),
              lastName: textAnswer('last_name'),
              email: textAnswer('email'),
              phone: textAnswer('mobile'),
            },
      );
      toast.success(`Registered ${created.name}. Registration ID ${created.code}.`);
      allowLeave();
      setDirty(false);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'contest-forms'] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not add registration.');
    } finally {
      setSaving(false);
    }
  }

  function textAnswer(id: string) {
    const value = answers[id];
    return typeof value === 'string' ? value.trim() : '';
  }

  return (
    <FormDialog
      icon={UserPlusIcon}
      title="Add registration"
      description={`Create a new Registration ID and assign a ${activityLabel.toLowerCase()}. A saved registration form for that activity is used when one exists.`}
      busy={saving}
      size="lg"
      onOpenChange={(next) => {
        if (!next) void requestClose();
      }}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => void requestClose()}
            disabled={saving}
          >
            Cancel
          </Button>
          <SaveButton
            form={formId}
            pending={saving}
            disabled={waiting || formsError || options.length === 0 || !showFields}
          >
            Add registration
          </SaveButton>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${formId}-activity`}>
              {activityLabel} <span className="text-destructive">*</span>
            </FieldLabel>
            <Select
              value={activityId}
              onValueChange={(value) => {
                markDirty();
                setActivityId(value);
                setChosenFormId('');
                resetAnswers();
              }}
              disabled={saving || activitiesPending || options.length === 0}
            >
              <SelectTrigger
                id={`${formId}-activity`}
                aria-label={activityLabel}
                className="w-full"
              >
                <SelectValue
                  placeholder={
                    activitiesPending
                      ? 'Loading…'
                      : options.length === 0
                        ? `No active or draft ${activityLabel.toLowerCase()}s`
                        : `Select ${activityLabel.toLowerCase()}`
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {options.map((activity) => (
                  <SelectItem key={activity.id} value={activity.id}>
                    {activity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {formsPending ? (
            <p className="text-sm text-muted-foreground" role="status">
              Loading registration forms…
            </p>
          ) : null}
          {formsError ? (
            <p className="text-sm text-destructive" role="alert">
              Could not load registration forms.
            </p>
          ) : null}
          {matching.length > 1 ? (
            <Field>
              <FieldLabel htmlFor={`${formId}-form`}>
                Registration form <span className="text-destructive">*</span>
              </FieldLabel>
              <Select
                value={chosenFormId}
                onValueChange={(value) => {
                  markDirty();
                  setChosenFormId(value);
                  resetAnswers();
                }}
                disabled={saving}
              >
                <SelectTrigger
                  id={`${formId}-form`}
                  aria-label="Registration form"
                  className="w-full"
                >
                  <SelectValue placeholder="Select a registration form" />
                </SelectTrigger>
                <SelectContent>
                  {matching.map((form) => (
                    <SelectItem key={form.id} value={form.id}>
                      {formOptionLabel(form, matching)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {showFields
            ? fields.map((field) => (
                <ContestFormFieldInput
                  key={`${chosenForm?.id ?? 'basic'}-${field.id}`}
                  field={field}
                  idPrefix={formId}
                  value={answers[field.id]}
                  error={errors[field.id]}
                  disabled={saving}
                  onChange={(value) => {
                    markDirty();
                    setAnswers((current) => ({ ...current, [field.id]: value }));
                  }}
                />
              ))
            : null}
        </FieldGroup>
      </form>
    </FormDialog>
  );
}

function formOptionLabel(form: ContestFormRecord, forms: ContestFormRecord[]) {
  const name = form.contestName.trim() || form.sponsorName.trim() || 'Registration form';
  const duplicates = forms.filter(
    (item) => (item.contestName.trim() || item.sponsorName.trim() || 'Registration form') === name,
  );
  if (duplicates.length < 2) return name;
  const sponsor = form.sponsorName.trim();
  return sponsor && sponsor !== name ? `${name} · ${sponsor}` : name;
}

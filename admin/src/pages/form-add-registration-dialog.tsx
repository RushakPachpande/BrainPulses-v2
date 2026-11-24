import { useId, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckIcon, CopyIcon, UserPlusIcon } from 'lucide-react';
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
import { ApiError } from '@/lib/api-client';
import { previewIssues, type ContestFormRecord } from '@/lib/contest-form';
import { createManualRegistration } from '@/services';

type Answers = Record<string, string | string[] | boolean>;

/** Admin add for a specific registration form (ignores public open/close windows). */
export function FormAddRegistrationDialog({
  form,
  onOpenChange,
}: {
  form: ContestFormRecord;
  onOpenChange: (open: boolean) => void;
}) {
  const formId = useId();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const activities = form.quizzes;
  const fields = form.fields.filter((field) => !field.deleted);
  const [activityId, setActivityId] = useState(activities[0]?.id ?? '');
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [created, setCreated] = useState<{ code: string; name: string } | null>(null);
  const allowLeave = useLeaveGuard(dirty && !created);

  async function requestClose() {
    if (saving) return;
    if (dirty && !created) {
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
    if (saving || created) return;
    if (!activityId) {
      toast.error('Select a quiz or assessment.');
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
      const result = await createManualRegistration({
        activityId,
        formId: form.id,
        answers,
      });
      setCreated({ code: result.code, name: result.name });
      setDirty(false);
      allowLeave();
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'contest-form-registrants', form.id],
      });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'contest-form', form.id] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'contest-forms'] });
      toast.success(`Registered ${result.name}.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not add registration.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      icon={created ? CheckIcon : UserPlusIcon}
      title={created ? 'Registration added' : 'Add registration'}
      description={
        created
          ? 'Share this Registration ID with the participant if needed.'
          : 'Fill this form as the participant would. Registration windows do not apply for admin adds.'
      }
      busy={saving}
      size="lg"
      onOpenChange={(next) => {
        if (!next) void requestClose();
      }}
      footer={
        created ? (
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        ) : (
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
              disabled={activities.length === 0 || fields.length === 0}
            >
              Add registration
            </SaveButton>
          </>
        )
      }
    >
      {created ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {created.name} is registered for {form.contestName || 'this form'}.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 rounded-lg bg-muted px-3 py-2 text-sm tabular-nums">
              {created.code}
            </code>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(created.code);
                toast.success('Registration ID copied');
              }}
            >
              <CopyIcon data-icon="inline-start" />
              Copy ID
            </Button>
          </div>
        </div>
      ) : (
        <form id={formId} onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${formId}-activity`}>
                Quiz or assessment <span className="text-destructive">*</span>
              </FieldLabel>
              <Select
                value={activityId || undefined}
                onValueChange={(value) => {
                  setDirty(true);
                  setActivityId(value);
                }}
                disabled={saving || activities.length === 0}
              >
                <SelectTrigger
                  id={`${formId}-activity`}
                  aria-label="Quiz or assessment"
                  className="w-full"
                >
                  <SelectValue
                    placeholder={
                      activities.length === 0
                        ? 'No activities linked to this form'
                        : 'Select activity'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {activities.map((activity) => (
                    <SelectItem key={activity.id} value={activity.id}>
                      {activity.name}
                      {activity.kind === 'assessment' ? ' (Assessment)' : ' (Quiz)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {fields.map((field) => (
              <ContestFormFieldInput
                key={field.id}
                field={field}
                idPrefix={formId}
                value={answers[field.id]}
                error={errors[field.id]}
                disabled={saving}
                onChange={(value) => {
                  setDirty(true);
                  setAnswers((current) => ({ ...current, [field.id]: value }));
                }}
              />
            ))}
          </FieldGroup>
        </form>
      )}
    </FormDialog>
  );
}

import { useEffect, useId, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ContestFormFieldInput } from '@/components/contest-form-field-input';
import { FormDialog } from '@/components/form-dialog';
import { SaveButton } from '@/components/save-button';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { useConfirm } from '@/components/use-confirm';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { ApiError } from '@/lib/api-client';
import {
  answerText,
  formatIst,
  isContentType,
  previewIssues,
  type ContestFormRegistrant,
} from '@/lib/contest-form';
import { getContestFormRegistrant, updateContestFormRegistrant } from '@/services/contest-forms';

type Answers = Record<string, string | string[] | boolean>;

/** View all collected answers, or edit them (no reassignment). */
export function FormRegistrantDialog({
  formId,
  registrant,
  mode,
  onOpenChange,
  onEdit,
}: {
  formId: string;
  registrant: ContestFormRegistrant;
  mode: 'view' | 'edit';
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}) {
  const formElId = useId();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ['admin', 'contest-form-registrant', formId, registrant.id],
    queryFn: ({ signal }) => getContestFormRegistrant(formId, registrant.id, signal),
  });
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const allowLeave = useLeaveGuard(dirty);

  useEffect(() => {
    if (!detail.data) return;
    const next: Answers = {};
    for (const [key, value] of Object.entries(detail.data.answers)) {
      if (typeof value === 'string' || typeof value === 'boolean' || Array.isArray(value)) {
        next[key] = value;
      }
    }
    setAnswers(next);
    setDirty(false);
    setErrors({});
  }, [detail.data]);

  const fields = (detail.data?.fields ?? []).filter(
    (field) => !field.deleted && !isContentType(field.type),
  );

  async function requestClose() {
    if (saving) return;
    if (mode === 'edit' && dirty) {
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
    if (mode !== 'edit' || saving || !detail.data) return;
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
      await updateContestFormRegistrant(formId, registrant.id, answers);
      toast.success('Registration updated.');
      setDirty(false);
      allowLeave();
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'contest-form-registrant', formId, registrant.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'contest-form-registrants', formId],
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update registration.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      icon={mode === 'edit' ? PencilIcon : UserIcon}
      title={mode === 'edit' ? 'Edit registration' : registrant.name}
      description={
        mode === 'edit'
          ? 'Update the answers collected for this registration.'
          : `Registration ID ${registrant.code} · Registered ${formatIst(registrant.registeredAt)}`
      }
      busy={saving}
      size="lg"
      onOpenChange={(next) => {
        if (!next) void requestClose();
      }}
      footer={
        mode === 'edit' ? (
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
              form={formElId}
              pending={saving}
              disabled={detail.isPending || !detail.data}
            >
              Save changes
            </SaveButton>
          </>
        ) : (
          <>
            {onEdit ? (
              <Button type="button" variant="outline" onClick={onEdit}>
                <PencilIcon data-icon="inline-start" />
                Edit
              </Button>
            ) : null}
            <Button type="button" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </>
        )
      }
    >
      {detail.isPending ? (
        <p className="text-sm text-muted-foreground" role="status">
          Loading details…
        </p>
      ) : detail.isError || !detail.data ? (
        <p className="text-sm text-destructive" role="alert">
          Could not load this registration.
        </p>
      ) : mode === 'edit' ? (
        <form id={formElId} onSubmit={onSubmit}>
          <FieldGroup>
            {fields.map((field) => (
              <ContestFormFieldInput
                key={field.id}
                field={field}
                idPrefix={formElId}
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
      ) : (
        <dl className="divide-y divide-border rounded-lg border border-border">
          <div className="grid gap-1 px-3 py-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-4">
            <dt className="text-sm font-medium text-muted-foreground">Registration ID</dt>
            <dd className="text-sm tabular-nums">{detail.data.code}</dd>
          </div>
          <div className="grid gap-1 px-3 py-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-4">
            <dt className="text-sm font-medium text-muted-foreground">Registered</dt>
            <dd className="text-sm">{formatIst(detail.data.registeredAt)}</dd>
          </div>
          {fields.map((field) => (
            <div
              key={field.id}
              className="grid gap-1 px-3 py-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-4"
            >
              <dt className="text-sm font-medium text-muted-foreground">{field.label}</dt>
              <dd className="text-sm break-words">
                {answerText(field, answers[field.id]) || (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </FormDialog>
  );
}

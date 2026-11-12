import { useId, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { FormDialog } from '@/components/form-dialog';
import { SaveButton } from '@/components/save-button';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
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
import { adminQueryKeys } from '@/lib/query-keys';
import { createManualRegistration, getActivities, type ActivityKind } from '@/services';

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
  const { data: activities, isPending } = useQuery({
    queryKey: adminQueryKeys.activities(orgId, kind),
    queryFn: () => getActivities(kind),
    enabled: Boolean(orgId),
  });
  const options = (activities ?? []).filter((activity) => {
    const status = activity.status.toLowerCase();
    return status === 'active' || status === 'draft';
  });
  const [activityId, setActivityId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [course, setCourse] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const allowLeave = useLeaveGuard(dirty);

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
    if (saving || isPending) return;
    if (!activityId) {
      toast.error(`Select a ${activityLabel.toLowerCase()}.`);
      return;
    }
    setSaving(true);
    try {
      const created = await createManualRegistration({
        activityId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        course: course.trim() || undefined,
        city: city.trim() || undefined,
      });
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

  return (
    <FormDialog
      icon={UserPlusIcon}
      title="Add registration"
      description={`Create a new Registration ID and assign a ${activityLabel.toLowerCase()}. If that activity is on a live registration form, they are registered there too.`}
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
          <SaveButton form={formId} pending={saving} disabled={isPending || options.length === 0}>
            Add registration
          </SaveButton>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} onChange={() => setDirty(true)}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${formId}-activity`}>
              {activityLabel} <span className="text-destructive">*</span>
            </FieldLabel>
            <Select
              value={activityId}
              onValueChange={(value) => {
                setDirty(true);
                setActivityId(value);
              }}
              disabled={saving || isPending || options.length === 0}
            >
              <SelectTrigger
                id={`${formId}-activity`}
                aria-label={activityLabel}
                className="w-full"
              >
                <SelectValue
                  placeholder={
                    isPending
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
          <Field>
            <FieldLabel htmlFor={`${formId}-name`}>
              Full name <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id={`${formId}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Aisha Begum"
              required
              disabled={saving}
              autoComplete="name"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-email`}>
              Email address <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id={`${formId}-email`}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="participant@example.com"
              required
              disabled={saving}
              autoComplete="email"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${formId}-phone`}>Phone number</FieldLabel>
              <Input
                id={`${formId}-phone`}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+91 98765 43210"
                disabled={saving}
                autoComplete="tel"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-course`}>Course</FieldLabel>
              <Input
                id={`${formId}-course`}
                value={course}
                onChange={(event) => setCourse(event.target.value)}
                disabled={saving}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor={`${formId}-city`}>City</FieldLabel>
            <Input
              id={`${formId}-city`}
              value={city}
              onChange={(event) => setCity(event.target.value)}
              disabled={saving}
              autoComplete="address-level2"
            />
          </Field>
        </FieldGroup>
      </form>
    </FormDialog>
  );
}

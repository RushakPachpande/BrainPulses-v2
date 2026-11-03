import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { GraduationCapIcon } from 'lucide-react';
import { toast } from 'sonner';
import { FormDialog } from '@/components/form-dialog';
import { SaveButton } from '@/components/save-button';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/use-confirm';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { ApiError } from '@/lib/api-client';
import { createParticipant, getParticipant, updateParticipant } from '@/services';

function blank(value: string) {
  return value === '—' ? '' : value;
}

export function ParticipantEditorDialog({
  mode,
  participantId,
  onOpenChange,
  onSaved,
}: {
  mode: 'create' | 'edit';
  participantId?: string;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const formId = useId();
  const confirm = useConfirm();
  const closeRef = useRef(onOpenChange);
  closeRef.current = onOpenChange;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [course, setCourse] = useState('');
  const [city, setCity] = useState('');
  const [cohort, setCohort] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const allowLeave = useLeaveGuard(dirty);

  useEffect(() => {
    if (mode !== 'edit' || !participantId) return;
    let cancelled = false;
    (async () => {
      try {
        const participant = await getParticipant(participantId);
        if (cancelled) return;
        setName(participant.name);
        setEmail(participant.email);
        setPhone(blank(participant.phone));
        setCourse(blank(participant.course));
        setCity(blank(participant.city));
        setCohort(blank(participant.cohort));
        setCode(participant.code);
        setDirty(false);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not load participant.');
        closeRef.current(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, participantId]);

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
    if (loading || saving) return;
    setSaving(true);
    try {
      if (mode === 'create') {
        await createParticipant({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          course: course.trim() || undefined,
          city: city.trim() || undefined,
          cohort: cohort.trim() || undefined,
          code: code.trim() || undefined,
        });
        toast.success('Participant created.');
      } else if (participantId) {
        await updateParticipant(participantId, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          course: course.trim() || null,
          city: city.trim() || null,
          cohort: cohort.trim() || null,
        });
        toast.success('Participant updated.');
      }
      allowLeave();
      setDirty(false);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save participant.');
    } finally {
      setSaving(false);
    }
  }

  const isCreate = mode === 'create';

  return (
    <FormDialog
      icon={GraduationCapIcon}
      title={isCreate ? 'Add Participant' : 'Edit Participant'}
      description={
        isCreate
          ? 'Enter participant details to create an account.'
          : 'Update this participant’s account information.'
      }
      busy={saving}
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
          <SaveButton form={formId} pending={saving} disabled={loading}>
            {isCreate ? 'Save Participant' : 'Update Participant'}
          </SaveButton>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} onChange={() => setDirty(true)}>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                disabled={loading || saving}
                autoComplete="name"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-code`}>Unique ID</FieldLabel>
              <Input
                id={`${formId}-code`}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Auto-generated if blank"
                disabled={!isCreate || loading || saving}
              />
            </Field>
          </div>
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
              disabled={loading || saving}
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
                disabled={loading || saving}
                autoComplete="tel"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-course`}>Course</FieldLabel>
              <Input
                id={`${formId}-course`}
                value={course}
                onChange={(event) => setCourse(event.target.value)}
                disabled={loading || saving}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${formId}-city`}>City</FieldLabel>
              <Input
                id={`${formId}-city`}
                value={city}
                onChange={(event) => setCity(event.target.value)}
                disabled={loading || saving}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-cohort`}>Cohort</FieldLabel>
              <Input
                id={`${formId}-cohort`}
                value={cohort}
                onChange={(event) => setCohort(event.target.value)}
                disabled={loading || saving}
                placeholder="e.g. Alpha"
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">* Required fields.</p>
        </FieldGroup>
      </form>
    </FormDialog>
  );
}

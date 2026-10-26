import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { SaveButton } from '@/components/save-button';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/use-confirm';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { ApiError } from '@/lib/api-client';
import { createStudent, getStudent, updateStudent } from '@/services';

function blank(value: string) {
  return value === '—' ? '' : value;
}

export function StudentEditorDialog({
  mode,
  studentId,
  onOpenChange,
  onSaved,
}: {
  mode: 'create' | 'edit';
  studentId?: string;
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
    if (mode !== 'edit' || !studentId) return;
    let cancelled = false;
    (async () => {
      try {
        const student = await getStudent(studentId);
        if (cancelled) return;
        setName(student.name);
        setEmail(student.email);
        setPhone(blank(student.phone));
        setCourse(blank(student.course));
        setCity(blank(student.city));
        setCohort(blank(student.cohort));
        setCode(student.code);
        setDirty(false);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not load student.');
        closeRef.current(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, studentId]);

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
        await createStudent({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          course: course.trim() || undefined,
          city: city.trim() || undefined,
          cohort: cohort.trim() || undefined,
          code: code.trim() || undefined,
        });
        toast.success('Student created.');
      } else if (studentId) {
        await updateStudent(studentId, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          course: course.trim() || null,
          city: city.trim() || null,
          cohort: cohort.trim() || null,
        });
        toast.success('Student updated.');
      }
      allowLeave();
      setDirty(false);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save student.');
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'create' ? 'Add Student' : 'Edit Student';

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) void requestClose();
      }}
    >
      <DialogContent className="max-h-[min(40rem,calc(100dvh-2rem))] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Required fields must be completed before saving.</DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={onSubmit} onChange={() => setDirty(true)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${formId}-name`}>
                Full name <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id={`${formId}-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                disabled={loading || saving}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-email`}>
                Email <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id={`${formId}-email`}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={loading || saving}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-code`}>Unique ID</FieldLabel>
              <Input
                id={`${formId}-code`}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Auto-generated if blank"
                disabled={mode !== 'create' || loading || saving}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-phone`}>Phone</FieldLabel>
              <Input
                id={`${formId}-phone`}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={loading || saving}
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
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => void requestClose()}
            disabled={saving}
          >
            Cancel
          </Button>
          <SaveButton form={formId} pending={saving} disabled={loading}>
            {mode === 'create' ? 'Create student' : 'Save changes'}
          </SaveButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useId } from 'react';
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
import type { Student } from '@/services';

const fields = [
  { key: 'name', label: 'Full name' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'code', label: 'Unique ID' },
  { key: 'phone', label: 'Phone' },
  { key: 'course', label: 'Course' },
  { key: 'city', label: 'City' },
  { key: 'cohort', label: 'Cohort' },
] as const;

export function StudentViewDialog({
  student,
  canEdit,
  onOpenChange,
  onEdit,
}: {
  student: Student;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}) {
  const formId = useId();

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onOpenChange(false);
      }}
    >
      <DialogContent className="max-h-[min(40rem,calc(100dvh-2rem))] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>View Student</DialogTitle>
          <DialogDescription>Student profile (read-only).</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          {fields.map((field) => (
            <Field key={field.key}>
              <FieldLabel htmlFor={`${formId}-${field.key}`}>{field.label}</FieldLabel>
              <Input
                id={`${formId}-${field.key}`}
                type={'type' in field ? field.type : 'text'}
                value={student[field.key]}
                disabled
              />
            </Field>
          ))}
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {canEdit && onEdit ? (
            <Button type="button" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useId } from 'react';
import { GraduationCapIcon } from 'lucide-react';
import { FormDialog } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { Student } from '@/services';

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
    <FormDialog
      icon={GraduationCapIcon}
      title="View Student"
      description="Student profile (read-only)."
      onOpenChange={onOpenChange}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {canEdit && onEdit ? (
            <Button type="button" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
        </>
      }
    >
      <FieldGroup>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${formId}-name`}>Full name</FieldLabel>
            <Input id={`${formId}-name`} value={student.name} disabled />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-code`}>Unique ID</FieldLabel>
            <Input id={`${formId}-code`} value={student.code} disabled />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${formId}-email`}>Email address</FieldLabel>
          <Input id={`${formId}-email`} type="email" value={student.email} disabled />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${formId}-phone`}>Phone number</FieldLabel>
            <Input id={`${formId}-phone`} value={student.phone} disabled />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-course`}>Course</FieldLabel>
            <Input id={`${formId}-course`} value={student.course} disabled />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${formId}-city`}>City</FieldLabel>
            <Input id={`${formId}-city`} value={student.city} disabled />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-cohort`}>Cohort</FieldLabel>
            <Input id={`${formId}-cohort`} value={student.cohort} disabled />
          </Field>
        </div>
      </FieldGroup>
    </FormDialog>
  );
}

import { useId } from 'react';
import { UsersIcon } from 'lucide-react';
import { FormDialog } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { AdminUser } from '@/services';

export function UserViewDialog({
  user,
  canEdit,
  onOpenChange,
  onEdit,
}: {
  user: AdminUser;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}) {
  const formId = useId();

  return (
    <FormDialog
      icon={UsersIcon}
      title="View User"
      description={`Membership access for this organization. Role: ${user.role}.`}
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
            <FieldLabel htmlFor={`${formId}-name`}>Name</FieldLabel>
            <Input id={`${formId}-name`} value={user.name} disabled autoComplete="name" />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-email`}>Email</FieldLabel>
            <Input
              id={`${formId}-email`}
              type="email"
              value={user.email}
              disabled
              autoComplete="email"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${formId}-assessment`}>Assessment access</FieldLabel>
            <Input id={`${formId}-assessment`} value={user.assessmentAccess} disabled />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-quiz`}>Quiz access</FieldLabel>
            <Input id={`${formId}-quiz`} value={user.quizAccess} disabled />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${formId}-status`}>Status</FieldLabel>
          <Input id={`${formId}-status`} value={user.status} disabled />
        </Field>
      </FieldGroup>
    </FormDialog>
  );
}

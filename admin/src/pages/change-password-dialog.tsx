import { useEffect, useId, useState, type FormEvent } from 'react';
import { KeyRoundIcon } from 'lucide-react';
import { FormDialog } from '@/components/form-dialog';
import { PasswordInput } from '@/components/password-input';
import { SaveButton } from '@/components/save-button';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function ChangePasswordDialog({
  open,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: ChangePasswordPayload) => Promise<void>;
}) {
  const formId = useId();
  const currentId = useId();
  const newId = useId();
  const confirmId = useId();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const nextErrors: Record<string, string> = {};
    if (!currentPassword) nextErrors.currentPassword = 'Current password is required.';
    if (!newPassword) nextErrors.newPassword = 'New password is required.';
    else if (newPassword.length < 8)
      nextErrors.newPassword = 'Password must be at least 8 characters.';
    else if (newPassword.length > 128)
      nextErrors.newPassword = 'Password must be at most 128 characters.';
    else if (currentPassword && newPassword === currentPassword)
      nextErrors.newPassword = 'New password must be different from the current password.';
    if (!confirmPassword) nextErrors.confirmPassword = 'Confirm the password.';
    else if (newPassword !== confirmPassword)
      nextErrors.confirmPassword = 'Passwords do not match.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    await onSubmit({ currentPassword, newPassword, confirmPassword });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
      title="Change password"
      description="Enter your current password, then choose a new one. You will be signed out after a successful change."
      icon={KeyRoundIcon}
      busy={saving}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <SaveButton form={formId} pending={Boolean(saving)} pendingLabel="Saving…">
            Change password
          </SaveButton>
        </>
      }
    >
      <form id={formId} className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
        <FieldGroup>
          <Field data-invalid={errors.currentPassword ? true : undefined}>
            <FieldLabel htmlFor={currentId}>Current password</FieldLabel>
            <PasswordInput
              id={currentId}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (errors.currentPassword) setErrors((prev) => ({ ...prev, currentPassword: '' }));
              }}
              aria-invalid={Boolean(errors.currentPassword)}
              disabled={saving}
              disableAutofill
            />
            {errors.currentPassword ? <FieldError>{errors.currentPassword}</FieldError> : null}
          </Field>
          <Field data-invalid={errors.newPassword ? true : undefined}>
            <FieldLabel htmlFor={newId}>New password</FieldLabel>
            <PasswordInput
              id={newId}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (errors.newPassword) setErrors((prev) => ({ ...prev, newPassword: '' }));
              }}
              aria-invalid={Boolean(errors.newPassword)}
              disabled={saving}
            />
            {errors.newPassword ? <FieldError>{errors.newPassword}</FieldError> : null}
          </Field>
          <Field data-invalid={errors.confirmPassword ? true : undefined}>
            <FieldLabel htmlFor={confirmId}>Confirm new password</FieldLabel>
            <PasswordInput
              id={confirmId}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }));
              }}
              aria-invalid={Boolean(errors.confirmPassword)}
              disabled={saving}
            />
            {errors.confirmPassword ? <FieldError>{errors.confirmPassword}</FieldError> : null}
          </Field>
        </FieldGroup>
      </form>
    </FormDialog>
  );
}

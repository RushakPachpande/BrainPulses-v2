import { useEffect, useId, useState, type FormEvent } from 'react';
import { KeyRoundIcon } from 'lucide-react';
import { FormDialog } from '@/components/form-dialog';
import { PasswordInput } from '@/components/password-input';
import { SaveButton } from '@/components/save-button';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Label } from '@/components/ui/label';

export type ResetPasswordPayload = {
  password: string;
  confirmPassword: string;
  mustChangePassword: boolean;
};

export function ResetPasswordDialog({
  open,
  userName,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  userName: string;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: ResetPasswordPayload) => Promise<void>;
}) {
  const formId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const mustChangeId = useId();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setConfirmPassword('');
    setMustChangePassword(true);
    setErrors({});
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const nextErrors: Record<string, string> = {};
    if (!password) nextErrors.password = 'Password is required.';
    else if (password.length < 8) nextErrors.password = 'Password must be at least 8 characters.';
    else if (password.length > 128)
      nextErrors.password = 'Password must be at most 128 characters.';
    if (!confirmPassword) nextErrors.confirmPassword = 'Confirm the password.';
    else if (password !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    await onSubmit({ password, confirmPassword, mustChangePassword });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
      title="Reset password"
      description={`Set a new password for ${userName}. They will be signed out of other sessions.`}
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
          <SaveButton form={formId} pending={Boolean(saving)} pendingLabel="Resetting…">
            Reset password
          </SaveButton>
        </>
      }
    >
      <form id={formId} className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
        <FieldGroup>
          <Field data-invalid={errors.password ? true : undefined}>
            <FieldLabel htmlFor={passwordId}>New password</FieldLabel>
            <PasswordInput
              id={passwordId}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
              }}
              aria-invalid={Boolean(errors.password)}
              disabled={saving}
            />
            {errors.password ? <FieldError>{errors.password}</FieldError> : null}
          </Field>
          <Field data-invalid={errors.confirmPassword ? true : undefined}>
            <FieldLabel htmlFor={confirmId}>Confirm password</FieldLabel>
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
          <div className="flex items-start gap-2">
            <Checkbox
              id={mustChangeId}
              checked={mustChangePassword}
              onCheckedChange={(checked) => setMustChangePassword(checked === true)}
              disabled={saving}
            />
            <Label htmlFor={mustChangeId} className="font-normal leading-snug">
              Require password change at next login
            </Label>
          </div>
        </FieldGroup>
      </form>
    </FormDialog>
  );
}

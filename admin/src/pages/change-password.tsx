import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { KeyRoundIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PasswordInput } from '@/components/password-input';
import { SaveButton } from '@/components/save-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api-client';
import { changeOwnPassword } from '@/services';

export function ChangePasswordPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const formId = useId();
  const newId = useId();
  const confirmId = useId();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const nextErrors: Record<string, string> = {};
    if (!newPassword) nextErrors.newPassword = 'New password is required.';
    else if (newPassword.length < 8)
      nextErrors.newPassword = 'Password must be at least 8 characters.';
    else if (newPassword.length > 128)
      nextErrors.newPassword = 'Password must be at most 128 characters.';
    if (!confirmPassword) nextErrors.confirmPassword = 'Confirm the password.';
    else if (newPassword !== confirmPassword)
      nextErrors.confirmPassword = 'Passwords do not match.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const result = await changeOwnPassword({
        newPassword,
        confirmPassword,
      });
      if (result.status === 'authenticated') {
        auth.acceptSession({
          accessToken: result.session.accessToken,
          user: result.session.user,
          organization: result.session.organization,
          membership: {
            id: result.session.membership.id,
            role: result.session.membership.role as 'super_admin' | 'admin',
            assessmentAccess: result.session.membership.assessmentAccess,
            quizAccess: result.session.membership.quizAccess,
          },
        });
        toast.success('Password updated.');
        void navigate('/dashboard', { replace: true });
        return;
      }
      await auth.signOut();
      toast.success('Password updated. Sign in with your new password.');
      void navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not change password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"
              aria-hidden
            >
              <KeyRoundIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle>Choose your password</CardTitle>
              <CardDescription>
                Your temporary password must be replaced before you can continue.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form id={formId} className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
            <FieldGroup>
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
                <FieldLabel htmlFor={confirmId}>Confirm password</FieldLabel>
                <PasswordInput
                  id={confirmId}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword)
                      setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                  }}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  disabled={saving}
                />
                {errors.confirmPassword ? <FieldError>{errors.confirmPassword}</FieldError> : null}
              </Field>
            </FieldGroup>
            <SaveButton pending={saving} pendingLabel="Saving…">
              Set password
            </SaveButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

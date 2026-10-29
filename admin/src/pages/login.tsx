import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/contexts/auth-context';

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const from =
    (location.state as { from?: string } | null)?.from &&
    (location.state as { from?: string }).from !== '/login'
      ? (location.state as { from: string }).from
      : '/dashboard';

  const [email, setEmail] = useState('admin@brainpulses.com');
  const [password, setPassword] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (auth.status === 'authenticated') {
    return <Navigate to={from} replace />;
  }

  async function onSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await auth.signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onSelectOrg(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    setError(null);
    setSubmitting(true);
    try {
      await auth.selectOrganization(organizationId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not select organization.');
    } finally {
      setSubmitting(false);
    }
  }

  const selectingOrg = auth.status === 'select_organization';
  const orgOptions = selectingOrg ? auth.organizations : [];
  const selectedOrg = orgOptions.find((org) => org.id === organizationId) ?? orgOptions[0];
  const platformBrand = selectedOrg?.displayName?.trim() || 'BrainPulses';

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{selectingOrg ? 'Choose organization' : 'Sign in'}</CardTitle>
          <CardDescription>
            {selectingOrg
              ? `${platformBrand} — select the organization you want to manage.`
              : 'BrainPulses admin — use your organization account.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectingOrg ? (
            <form onSubmit={onSelectOrg}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="organization">Organization</FieldLabel>
                  <Select value={organizationId} onValueChange={setOrganizationId} required>
                    <SelectTrigger id="organization" className="w-full">
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {orgOptions.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {(org.displayName?.trim() || 'BrainPulses') + ' | ' + org.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" className="w-full" disabled={submitting || !organizationId}>
                  Continue
                </Button>
              </FieldGroup>
            </form>
          ) : (
            <form onSubmit={onSignIn}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" className="w-full" disabled={submitting}>
                  Sign in
                </Button>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

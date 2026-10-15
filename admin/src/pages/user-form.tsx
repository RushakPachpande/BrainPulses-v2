import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeftIcon, SaveIcon } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { inviteUser } from '@/services';

export function UserFormPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'super_admin'>('admin');
  const [assessmentAccess, setAssessmentAccess] = useState<'full' | 'edit' | 'view' | 'none'>(
    'full',
  );
  const [quizAccess, setQuizAccess] = useState<'full' | 'edit' | 'view' | 'none'>('full');
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await inviteUser({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        assessmentAccess,
        quizAccess,
      });
      toast.success('User invited.');
      void navigate('/users');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not invite user.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <Button asChild variant="ghost" className="-ml-3 mb-1">
          <Link to="/users">
            <ArrowLeftIcon data-icon="inline-start" /> Back to users
          </Link>
        </Button>
        <h2 className="text-xl font-semibold tracking-tight">Invite User</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create an admin membership for this organization.
        </p>
      </div>
      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>User details</CardTitle>
          <CardDescription>Password must be at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="user-name">
                  Name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="user-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="user-email">
                  Email <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="user-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="user-password">
                  Temporary password <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="user-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>
              <Field>
                <FieldLabel>Role</FieldLabel>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger aria-label="Role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Assessment access</FieldLabel>
                <Select
                  value={assessmentAccess}
                  onValueChange={(v) => setAssessmentAccess(v as typeof assessmentAccess)}
                >
                  <SelectTrigger aria-label="Assessment access">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="edit">Edit</SelectItem>
                    <SelectItem value="view">View</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Quiz access</FieldLabel>
                <Select
                  value={quizAccess}
                  onValueChange={(v) => setQuizAccess(v as typeof quizAccess)}
                >
                  <SelectTrigger aria-label="Quiz access">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="edit">Edit</SelectItem>
                    <SelectItem value="view">View</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => void navigate('/users')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  <SaveIcon data-icon="inline-start" />
                  {saving ? 'Saving…' : 'Invite user'}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

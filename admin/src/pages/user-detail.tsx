import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeftIcon, SaveIcon } from 'lucide-react';
import { FormPageSkeleton } from '@/components/loading-skeletons';
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
import { deactivateMembership, getUser, updateMembershipAccess } from '@/services';

type AccessLevel = 'full' | 'edit' | 'view' | 'none';

function parseAccess(label: string): AccessLevel {
  const key = label.toLowerCase();
  if (key.includes('full')) return 'full';
  if (key.includes('edit')) return 'edit';
  if (key.includes('view')) return 'view';
  return 'none';
}

export function UserDetailPage({ mode }: { mode: 'view' | 'edit' }) {
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const readOnly = mode === 'view';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Admin');
  const [assessmentAccess, setAssessmentAccess] = useState<AccessLevel>('view');
  const [quizAccess, setQuizAccess] = useState<AccessLevel>('view');
  const [status, setStatus] = useState('Active');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await getUser(userId);
        if (cancelled) return;
        setName(user.name);
        setEmail(user.email);
        setRole(user.role);
        setAssessmentAccess(parseAccess(user.assessmentAccess));
        setQuizAccess(parseAccess(user.quizAccess));
        setStatus(user.status);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not load user.');
        void navigate('/users');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, userId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    setSaving(true);
    try {
      await updateMembershipAccess(userId, {
        assessmentAccess,
        quizAccess,
        isActive: status === 'Active',
      });
      toast.success('User updated.');
      void navigate('/users');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update user.');
    } finally {
      setSaving(false);
    }
  }

  async function onDeactivate() {
    setSaving(true);
    try {
      await deactivateMembership(userId);
      toast.success('User deactivated.');
      void navigate('/users');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not deactivate user.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <FormPageSkeleton fields={5} />;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-3 mb-1">
            <Link to="/users">
              <ArrowLeftIcon data-icon="inline-start" /> Back to users
            </Link>
          </Button>
          <h2 className="text-xl font-semibold tracking-tight">
            {mode === 'view' ? 'View User' : 'Edit User'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Membership access for this organization.
          </p>
        </div>
        {mode === 'view' ? (
          <Button asChild>
            <Link to={`/users/${userId}/edit`}>Edit</Link>
          </Button>
        ) : null}
      </div>
      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>User details</CardTitle>
          <CardDescription>{role}</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel>Name</FieldLabel>
                <Input value={name} disabled />
              </Field>
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input value={email} disabled />
              </Field>
              <Field>
                <FieldLabel>Assessment access</FieldLabel>
                <Select
                  value={assessmentAccess}
                  disabled={readOnly}
                  onValueChange={(v) => setAssessmentAccess(v as AccessLevel)}
                >
                  <SelectTrigger className="w-full sm:max-w-xs">
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
                  disabled={readOnly}
                  onValueChange={(v) => setQuizAccess(v as AccessLevel)}
                >
                  <SelectTrigger className="w-full sm:max-w-xs">
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
                <FieldLabel>Status</FieldLabel>
                <Select
                  value={status === 'Active' ? 'Active' : 'Inactive'}
                  disabled={readOnly}
                  onValueChange={setStatus}
                >
                  <SelectTrigger className="w-full sm:max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {!readOnly ? (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => void navigate('/users')}>
                    Cancel
                  </Button>
                  {status === 'Active' ? (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={saving}
                      onClick={() => void onDeactivate()}
                    >
                      Deactivate
                    </Button>
                  ) : null}
                  <Button type="submit" disabled={saving}>
                    <SaveIcon data-icon="inline-start" />
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              ) : null}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

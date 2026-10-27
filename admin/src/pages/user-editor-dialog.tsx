import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { UsersIcon } from 'lucide-react';
import { toast } from 'sonner';
import { FormDialog } from '@/components/form-dialog';
import { SaveButton } from '@/components/save-button';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConfirm } from '@/components/use-confirm';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { ApiError } from '@/lib/api-client';
import { deactivateMembership, getUser, inviteUser, updateMembershipAccess } from '@/services';

type AccessLevel = 'full' | 'edit' | 'view' | 'none';

function parseAccess(label: string): AccessLevel {
  const key = label.toLowerCase();
  if (key.includes('full')) return 'full';
  if (key.includes('edit')) return 'edit';
  if (key.includes('view')) return 'view';
  return 'none';
}

export function UserEditorDialog({
  mode,
  userId,
  onOpenChange,
  onSaved,
}: {
  mode: 'create' | 'edit';
  userId?: string;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const formId = useId();
  const confirm = useConfirm();
  const closeRef = useRef(onOpenChange);
  closeRef.current = onOpenChange;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'super_admin'>('admin');
  const [roleLabel, setRoleLabel] = useState('Admin');
  const [assessmentAccess, setAssessmentAccess] = useState<AccessLevel>('full');
  const [quizAccess, setQuizAccess] = useState<AccessLevel>('full');
  const [status, setStatus] = useState('Active');
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const allowLeave = useLeaveGuard(dirty);

  useEffect(() => {
    if (mode !== 'edit' || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const user = await getUser(userId);
        if (cancelled) return;
        setName(user.name);
        setEmail(user.email);
        setRoleLabel(user.role);
        setAssessmentAccess(parseAccess(user.assessmentAccess));
        setQuizAccess(parseAccess(user.quizAccess));
        setStatus(user.status);
        setDirty(false);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not load user.');
        closeRef.current(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, userId]);

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

    if (mode === 'edit') {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      if (!trimmedName) {
        toast.error('Name is required.');
        return;
      }
      if (!trimmedEmail) {
        toast.error('Email is required.');
        return;
      }
      if (!userId) return;
      setSaving(true);
      try {
        await updateMembershipAccess(userId, {
          name: trimmedName,
          email: trimmedEmail,
          assessmentAccess,
          quizAccess,
          isActive: status === 'Active',
        });
        toast.success('User updated.');
        allowLeave();
        setDirty(false);
        onSaved?.();
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not update user.');
      } finally {
        setSaving(false);
      }
      return;
    }

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
      allowLeave();
      setDirty(false);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not invite user.');
    } finally {
      setSaving(false);
    }
  }

  async function onDeactivate() {
    if (!userId || saving) return;
    const ok = await confirm({
      title: 'Deactivate this user?',
      description: 'They will lose access until an admin reactivates them.',
      confirmLabel: 'Deactivate',
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await deactivateMembership(userId);
      toast.success('User deactivated.');
      allowLeave();
      setDirty(false);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not deactivate user.');
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'create' ? 'Invite User' : 'Edit User';
  const description =
    mode === 'create'
      ? 'Create an admin membership for this organization. Password must be at least 8 characters.'
      : `Membership access for this organization. Role: ${roleLabel}.`;

  return (
    <FormDialog
      icon={UsersIcon}
      title={title}
      description={description}
      busy={saving}
      onOpenChange={(next) => {
        if (!next) void requestClose();
      }}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => void requestClose()}
            disabled={saving}
          >
            Cancel
          </Button>
          {mode === 'edit' && status === 'Active' ? (
            <Button
              type="button"
              variant="destructive"
              disabled={saving || loading}
              onClick={() => void onDeactivate()}
            >
              Deactivate
            </Button>
          ) : null}
          <SaveButton form={formId} pending={saving} disabled={loading}>
            {mode === 'create' ? 'Invite user' : 'Save changes'}
          </SaveButton>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} onChange={() => setDirty(true)}>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${formId}-name`}>
                Name <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id={`${formId}-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required={mode === 'create'}
                disabled={loading || saving}
                autoComplete="name"
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
                required={mode === 'create'}
                disabled={loading || saving}
                autoComplete="email"
              />
            </Field>
          </div>
          {mode === 'create' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${formId}-password`}>
                  Password <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id={`${formId}-password`}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  disabled={saving}
                />
              </Field>
              <Field>
                <FieldLabel>Role</FieldLabel>
                <Select
                  value={role}
                  disabled={saving}
                  onValueChange={(value) => {
                    setDirty(true);
                    setRole(value as typeof role);
                  }}
                >
                  <SelectTrigger aria-label="Role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Assessment access</FieldLabel>
              <Select
                value={assessmentAccess}
                disabled={loading || saving}
                onValueChange={(value) => {
                  setDirty(true);
                  setAssessmentAccess(value as AccessLevel);
                }}
              >
                <SelectTrigger aria-label="Assessment access" className="w-full">
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
                disabled={loading || saving}
                onValueChange={(value) => {
                  setDirty(true);
                  setQuizAccess(value as AccessLevel);
                }}
              >
                <SelectTrigger aria-label="Quiz access" className="w-full">
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
          </div>
          {mode === 'edit' ? (
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select
                value={status === 'Active' ? 'Active' : 'Inactive'}
                disabled={loading || saving}
                onValueChange={(value) => {
                  setDirty(true);
                  setStatus(value);
                }}
              >
                <SelectTrigger aria-label="Status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <p className="text-xs text-muted-foreground">* Required fields.</p>
        </FieldGroup>
      </form>
    </FormDialog>
  );
}

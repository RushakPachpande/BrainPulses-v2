import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react';
import { FormPageSkeleton } from '@/components/loading-skeletons';
import { SaveButton } from '@/components/save-button';
import { confirmSensitiveDelete, useConfirm } from '@/components/use-confirm';
import { AccountStatusPill, AttemptStatusPill } from '@/components/status-pill';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/contexts/auth-context';
import { canFullKind } from '@/lib/access';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  deleteAttempt,
  deleteParticipant,
  getRegistration,
  unassignRegistrations,
  updateParticipant,
  type ActivityKind,
} from '@/services';
import type { RegistrationRow } from '@/services/types';

function blank(value: string) {
  return value === '—' ? '' : value;
}

export function RegistrationDetailPage({
  kind,
  mode,
}: {
  kind: ActivityKind;
  mode: 'view' | 'edit';
}) {
  const formId = useId();
  const { registrationId = '' } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const auth = useAuth();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canFull = canFullKind(membership, kind);
  const isQuiz = kind === 'quiz';
  const editing = mode === 'edit';
  const base = isQuiz ? '/quizzes/registrations' : '/assessments/registrations';
  const reportsBase = isQuiz ? '/quizzes/reports' : '/assessments/reports';
  const [row, setRow] = useState<RegistrationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [course, setCourse] = useState('');
  const [city, setCity] = useState('');
  const [dirty, setDirty] = useState(false);
  const allowLeave = useLeaveGuard(editing && dirty);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await getRegistration(kind, registrationId);
        if (!cancelled) setRow(found);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not load registration.');
        void navigate(base);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base, kind, navigate, registrationId]);

  useEffect(() => {
    if (!row || dirty) return;
    setName(row.name);
    setEmail(row.email);
    setPhone(blank(row.phone));
    setCourse(blank(row.course));
    setCity(blank(row.city));
  }, [row, dirty]);

  async function onUnassign() {
    if (!row) return;
    const ok = await confirm({
      title: 'Unassign this participant?',
      description: 'They will no longer be able to take this activity.',
      confirmLabel: 'Unassign',
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await unassignRegistrations(row.activityId, [row.participantId]);
      toast.success('Participant unassigned.');
      allowLeave();
      void navigate(base);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not unassign.');
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteRegistration() {
    if (!row) return;
    const password = await confirmSensitiveDelete(confirm, {
      title: `Delete ${row.name}'s registration?`,
      description: 'Permanently removes this participant. This cannot be undone.',
      details: [
        'Their attempts and scores are deleted.',
        'They are removed from every activity they are on.',
        'The live registration link can sign them up again as a new Registration ID.',
      ],
      confirmLabel: 'Delete registration',
    });
    if (!password) return;
    setSaving(true);
    try {
      await deleteParticipant(row.participantId, password);
      toast.success('Registration deleted.');
      allowLeave();
      void navigate(base);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete registration.');
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteAttempt() {
    if (!row?.attemptId) return;
    const inProgress = row.attempt === 'In Progress';
    const password = await confirmSensitiveDelete(confirm, {
      title: inProgress ? 'Delete this in-progress attempt?' : 'Delete this attempt?',
      description: inProgress
        ? 'Removes the open attempt so the participant can start again as if they never began. This cannot be undone.'
        : "Removes the participant's attempt and score for this activity. They can start again as if they never attempted. This cannot be undone.",
      confirmLabel: 'Delete attempt',
    });
    if (!password) return;
    setSaving(true);
    try {
      await deleteAttempt(row.attemptId, password);
      toast.success('Attempt deleted.');
      const found = await getRegistration(kind, registrationId);
      setDirty(false);
      setRow(found);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete attempt.');
    } finally {
      setSaving(false);
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!row || saving) return;
    setSaving(true);
    try {
      await updateParticipant(row.participantId, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        course: course.trim() || null,
        city: city.trim() || null,
      });
      setRow({
        ...row,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || '—',
        course: course.trim() || '—',
        city: city.trim() || '—',
      });
      setDirty(false);
      toast.success('Registration updated.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update registration.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !row) return <FormPageSkeleton fields={6} />;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-3 mb-1">
            <Link to={base}>
              <ArrowLeftIcon data-icon="inline-start" /> Back to registrations
            </Link>
          </Button>
          <h2 className="text-xl font-semibold tracking-tight">
            {editing ? 'Edit Registration' : 'View Registration'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {row.name} · {row.activity}
          </p>
        </div>
        {mode === 'view' ? (
          <Button asChild>
            <Link to={`${base}/${registrationId}/edit`}>Edit</Link>
          </Button>
        ) : null}
      </div>
      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Registration</CardTitle>
          <CardDescription>
            {editing
              ? 'Update participant details. The Registration ID stays the same.'
              : 'Assignment and attempt status'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form id={formId} className="grid gap-3 text-sm sm:grid-cols-2" onSubmit={onSave}>
            {editing ? (
              <>
                <Field>
                  <FieldLabel htmlFor={`${formId}-name`}>
                    Full name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id={`${formId}-name`}
                    value={name}
                    required
                    disabled={saving}
                    autoComplete="name"
                    onChange={(event) => {
                      setDirty(true);
                      setName(event.target.value);
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${formId}-email`}>
                    Email address <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id={`${formId}-email`}
                    type="email"
                    value={email}
                    required
                    disabled={saving}
                    autoComplete="email"
                    onChange={(event) => {
                      setDirty(true);
                      setEmail(event.target.value);
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${formId}-phone`}>Phone number</FieldLabel>
                  <Input
                    id={`${formId}-phone`}
                    value={phone}
                    disabled={saving}
                    autoComplete="tel"
                    onChange={(event) => {
                      setDirty(true);
                      setPhone(event.target.value);
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${formId}-course`}>Course</FieldLabel>
                  <Input
                    id={`${formId}-course`}
                    value={course}
                    disabled={saving}
                    onChange={(event) => {
                      setDirty(true);
                      setCourse(event.target.value);
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${formId}-city`}>City</FieldLabel>
                  <Input
                    id={`${formId}-city`}
                    value={city}
                    disabled={saving}
                    autoComplete="address-level2"
                    onChange={(event) => {
                      setDirty(true);
                      setCity(event.target.value);
                    }}
                  />
                </Field>
              </>
            ) : (
              <div>
                <p className="text-muted-foreground">Participant</p>
                <p className="font-medium">{row.name}</p>
                <p>{row.email}</p>
                <p>{row.phone}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Unique ID</p>
              <p className="font-medium">{row.id}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Activity</p>
              <p className="font-medium">{row.activity}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Registered</p>
              <p className="font-medium">{row.registered}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Assignment</p>
              <AccountStatusPill value={row.assignment} />
            </div>
            <div>
              <p className="text-muted-foreground">Attempt</p>
              <AttemptStatusPill value={row.attempt} />
            </div>
            {editing ? null : (
              <div>
                <p className="text-muted-foreground">Course / City</p>
                <p className="font-medium">
                  {row.course} · {row.city}
                </p>
              </div>
            )}
            {canFull ? (
              <div className="col-span-full flex flex-wrap gap-2 border-t pt-4">
                {row.resultId ? (
                  <Button asChild variant="outline">
                    <Link to={`${reportsBase}/${row.resultId}`}>View result</Link>
                  </Button>
                ) : null}
                {row.attemptId ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={saving}
                    aria-busy={saving}
                    onClick={() => void onDeleteAttempt()}
                  >
                    {saving ? (
                      <Loader2Icon data-icon="inline-start" className="animate-spin" />
                    ) : null}
                    Delete attempt
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  disabled={saving}
                  aria-busy={saving}
                  onClick={() => void onDeleteRegistration()}
                >
                  Delete registration
                </Button>
              </div>
            ) : null}
            {editing ? (
              <div className="col-span-full flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void navigate(base)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={saving}
                  onClick={() => void onUnassign()}
                >
                  Unassign participant
                </Button>
                <SaveButton pending={saving}>Save</SaveButton>
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

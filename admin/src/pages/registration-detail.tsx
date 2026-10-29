import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react';
import { FormPageSkeleton } from '@/components/loading-skeletons';
import { useConfirm } from '@/components/use-confirm';
import { AccountStatusPill, AttemptStatusPill } from '@/components/status-pill';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/contexts/auth-context';
import { canFullKind } from '@/lib/access';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  deleteAttempt,
  getRegistration,
  unassignRegistrations,
  type ActivityKind,
} from '@/services';
import type { RegistrationRow } from '@/services/types';

export function RegistrationDetailPage({
  kind,
  mode,
}: {
  kind: ActivityKind;
  mode: 'view' | 'edit';
}) {
  const { registrationId = '' } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const auth = useAuth();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canFull = canFullKind(membership, kind);
  const isQuiz = kind === 'quiz';
  const base = isQuiz ? '/quizzes/registrations' : '/assessments/registrations';
  const reportsBase = isQuiz ? '/quizzes/reports' : '/assessments/reports';
  const [row, setRow] = useState<RegistrationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  async function onUnassign() {
    if (!row) return;
    const ok = await confirm({
      title: 'Unassign this student?',
      description: 'They will no longer be able to take this activity.',
      confirmLabel: 'Unassign',
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await unassignRegistrations(row.activityId, [row.studentId]);
      toast.success('Student unassigned.');
      void navigate(base);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not unassign.');
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteAttempt() {
    if (!row?.attemptId) return;
    const inProgress = row.attempt === 'In Progress';
    const password = await confirm({
      title: inProgress ? 'Delete this in-progress attempt?' : 'Delete this attempt?',
      description: inProgress
        ? 'Removes the open attempt so the student can start again as if they never began. This cannot be undone.'
        : "Removes the student's attempt and score for this activity. They can start again as if they never attempted. This cannot be undone.",
      confirmLabel: 'Delete attempt',
      destructive: true,
      requirePassword: true,
    });
    if (!password) return;
    setSaving(true);
    try {
      await deleteAttempt(row.attemptId, password);
      toast.success('Attempt deleted.');
      const found = await getRegistration(kind, registrationId);
      setRow(found);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete attempt.');
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
            {mode === 'view' ? 'View Registration' : 'Edit Registration'}
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
          <CardDescription>Assignment and attempt status</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Student</p>
            <p className="font-medium">{row.name}</p>
            <p>{row.email}</p>
            <p>{row.phone}</p>
          </div>
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
          <div>
            <p className="text-muted-foreground">Course / City</p>
            <p className="font-medium">
              {row.course} · {row.city}
            </p>
          </div>
          {canFull && (row.attemptId || row.resultId) ? (
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
            </div>
          ) : null}
          {mode === 'edit' ? (
            <div className="col-span-full flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => void navigate(base)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={saving}
                onClick={() => void onUnassign()}
              >
                {saving ? 'Working…' : 'Unassign student'}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react';
import { FormPageSkeleton } from '@/components/loading-skeletons';
import { useConfirm } from '@/components/use-confirm';
import { StatusBadge } from '@/components/status-badge';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/contexts/auth-context';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { canFullKind } from '@/lib/access';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  deleteResult,
  disqualifyAttempt,
  getResult,
  grantReattempt,
  publishResult,
  regradeResult,
  requalifyAttempt,
  type ActivityKind,
} from '@/services';
import type { ResultDetail } from '@/services/types';

export function ResultDetailPage({ kind }: { kind: ActivityKind }) {
  const { resultId = '' } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canFull = canFullKind(membership, kind);
  const isQuiz = kind === 'quiz';
  const base = isQuiz ? '/quizzes/reports' : '/assessments/reports';
  const [row, setRow] = useState<ResultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [regradeScore, setRegradeScore] = useState('');
  const [regradeReason, setRegradeReason] = useState('');
  const [dqNote, setDqNote] = useState('');
  const confirm = useConfirm();
  useLeaveGuard(dirty);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getResult(resultId);
        if (!cancelled) {
          setRow(data);
          setRegradeScore(String(data.score));
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not load result.');
        void navigate(base);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base, navigate, resultId]);

  async function onPublish() {
    const ok = await confirm({
      title: 'Publish this result?',
      description: 'The student will be able to see it according to the activity settings.',
      confirmLabel: 'Publish result',
    });
    if (!ok) return;
    setSaving(true);
    try {
      await publishResult(resultId);
      toast.success('Result published.');
      const data = await getResult(resultId);
      setRow(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not publish result.');
    } finally {
      setSaving(false);
    }
  }

  async function onRegrade() {
    const score = Number(regradeScore);
    if (!Number.isFinite(score) || score < 0) {
      toast.error('Enter a valid score.');
      return;
    }
    if (!regradeReason.trim()) {
      toast.error('Regrade reason is required.');
      return;
    }
    const ok = await confirm({
      title: 'Replace this score?',
      description: 'The stored score will be replaced with the value you entered.',
      confirmLabel: 'Regrade',
    });
    if (!ok) return;
    setSaving(true);
    try {
      await regradeResult(resultId, score, regradeReason.trim());
      toast.success('Result regraded.');
      setDirty(false);
      const data = await getResult(resultId);
      setRow(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not regrade result.');
    } finally {
      setSaving(false);
    }
  }

  async function onDisqualify() {
    if (!row?.attemptId) return;
    const ok = await confirm({
      title: 'Disqualify this attempt?',
      description: 'The result will be marked disqualified and will no longer count.',
      confirmLabel: 'Disqualify',
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await disqualifyAttempt(row.attemptId, dqNote.trim() || undefined);
      toast.success('Attempt disqualified.');
      setDirty(false);
      const data = await getResult(resultId);
      setRow(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not disqualify.');
    } finally {
      setSaving(false);
    }
  }

  async function onRequalify() {
    if (!row?.attemptId) return;
    const ok = await confirm({
      title: 'Restore this attempt?',
      description: 'It will count again and the disqualification will be cleared.',
      confirmLabel: 'Re-qualify',
    });
    if (!ok) return;
    setSaving(true);
    try {
      await requalifyAttempt(row.attemptId);
      toast.success('Attempt re-qualified.');
      setDirty(false);
      const data = await getResult(resultId);
      setRow(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not re-qualify.');
    } finally {
      setSaving(false);
    }
  }

  async function onGrantReattempt(mode: 'continue' | 'restart') {
    if (!row?.activityId || !row.studentId) {
      toast.error('Missing activity or student on this result.');
      return;
    }
    const ok = await confirm({
      title: mode === 'restart' ? 'Grant a restart?' : 'Grant a continue?',
      description:
        mode === 'restart'
          ? 'The student can take this quiz again.'
          : 'The student can resume this attempt.',
      confirmLabel: mode === 'restart' ? 'Grant restart' : 'Grant continue',
    });
    if (!ok) return;
    setSaving(true);
    try {
      await grantReattempt(row.activityId, {
        studentId: row.studentId,
        mode,
        note: dqNote.trim() || undefined,
      });
      toast.success(`Reattempt (${mode}) granted.`);
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not grant reattempt.');
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteResponse() {
    const password = await confirm({
      title: 'Delete this response?',
      description:
        "Removes the student's attempt and score for this activity. They can start again as if they never attempted. This cannot be undone.",
      confirmLabel: 'Delete response',
      destructive: true,
      requirePassword: true,
    });
    if (!password) return;
    setSaving(true);
    try {
      await deleteResult(resultId, password);
      toast.success('Response deleted.');
      setDirty(false);
      void navigate(base);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete response.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !row) return <FormPageSkeleton fields={5} />;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <Button asChild variant="ghost" className="-ml-3 mb-1">
          <Link to={base}>
            <ArrowLeftIcon data-icon="inline-start" /> Back to reports
          </Link>
        </Button>
        <h2 className="text-xl font-semibold tracking-tight">View Result</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {row.student} · {row.activity}
        </p>
      </div>
      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Score summary</CardTitle>
          <CardDescription>Submitted {row.submitted}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Student</p>
            <p className="font-medium">
              {row.student}
              {row.studentCode ? ` (${row.studentCode})` : ''}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Activity</p>
            <p className="font-medium">{row.activity}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Score</p>
            <p className="font-medium tabular-nums">
              {row.score}
              {row.maxScore != null ? ` / ${row.maxScore}` : '%'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <StatusBadge value={row.status} />
          </div>
          <div>
            <p className="text-muted-foreground">Release</p>
            <p className="font-medium">{row.releaseStatus ?? '—'}</p>
          </div>
          {isQuiz ? (
            <div>
              <p className="text-muted-foreground">Disqualified</p>
              <p className="font-medium">{row.disqualified ? 'Yes' : 'No'}</p>
            </div>
          ) : null}
          {canFull ? (
            <div className="col-span-full flex flex-col gap-3 border-t pt-4">
              <div className="flex flex-wrap gap-2">
                {row.releaseStatus !== 'published' ? (
                  <Button
                    type="button"
                    disabled={saving}
                    aria-busy={saving}
                    onClick={() => void onPublish()}
                  >
                    {saving ? (
                      <Loader2Icon data-icon="inline-start" className="animate-spin" />
                    ) : null}
                    Publish result
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  disabled={saving}
                  aria-busy={saving}
                  onClick={() => void onDeleteResponse()}
                >
                  {saving ? (
                    <Loader2Icon data-icon="inline-start" className="animate-spin" />
                  ) : null}
                  Delete response
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="regrade-score">Regrade score</FieldLabel>
                  <Input
                    id="regrade-score"
                    type="number"
                    min={0}
                    value={regradeScore}
                    onChange={(e) => {
                      setDirty(true);
                      setRegradeScore(e.target.value);
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="regrade-reason">Reason</FieldLabel>
                  <Input
                    id="regrade-reason"
                    value={regradeReason}
                    onChange={(e) => {
                      setDirty(true);
                      setRegradeReason(e.target.value);
                    }}
                  />
                </Field>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                aria-busy={saving}
                onClick={() => void onRegrade()}
              >
                {saving ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : null}
                Regrade
              </Button>
              {isQuiz ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="dq-note">Note (disqualify / reattempt)</FieldLabel>
                    <Input
                      id="dq-note"
                      value={dqNote}
                      onChange={(e) => {
                        setDirty(true);
                        setDqNote(e.target.value);
                      }}
                      placeholder="Optional note"
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {row.disqualified ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving}
                        aria-busy={saving}
                        onClick={() => void onRequalify()}
                      >
                        {saving ? (
                          <Loader2Icon data-icon="inline-start" className="animate-spin" />
                        ) : null}
                        Re-qualify
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={saving}
                        aria-busy={saving}
                        onClick={() => void onDisqualify()}
                      >
                        {saving ? (
                          <Loader2Icon data-icon="inline-start" className="animate-spin" />
                        ) : null}
                        Disqualify
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      aria-busy={saving}
                      onClick={() => void onGrantReattempt('continue')}
                    >
                      {saving ? (
                        <Loader2Icon data-icon="inline-start" className="animate-spin" />
                      ) : null}
                      Grant continue
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      aria-busy={saving}
                      onClick={() => void onGrantReattempt('restart')}
                    >
                      {saving ? (
                        <Loader2Icon data-icon="inline-start" className="animate-spin" />
                      ) : null}
                      Grant restart
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

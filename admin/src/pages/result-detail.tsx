import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeftIcon } from 'lucide-react';
import { FormPageSkeleton } from '@/components/loading-skeletons';
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
  const [regradeScore, setRegradeScore] = useState('');
  const [regradeReason, setRegradeReason] = useState('');
  const [dqNote, setDqNote] = useState('');
  useLeaveGuard(saving);

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
    setSaving(true);
    try {
      await regradeResult(resultId, score, regradeReason.trim());
      toast.success('Result regraded.');
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
    setSaving(true);
    try {
      await disqualifyAttempt(row.attemptId, dqNote.trim() || undefined);
      toast.success('Attempt disqualified.');
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
    setSaving(true);
    try {
      await requalifyAttempt(row.attemptId);
      toast.success('Attempt re-qualified.');
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
    setSaving(true);
    try {
      await grantReattempt(row.activityId, {
        studentId: row.studentId,
        mode,
        note: dqNote.trim() || undefined,
      });
      toast.success(`Reattempt (${mode}) granted.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not grant reattempt.');
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
              {row.releaseStatus !== 'published' ? (
                <Button type="button" disabled={saving} onClick={() => void onPublish()}>
                  Publish result
                </Button>
              ) : null}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="regrade-score">Regrade score</FieldLabel>
                  <Input
                    id="regrade-score"
                    type="number"
                    min={0}
                    value={regradeScore}
                    onChange={(e) => setRegradeScore(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="regrade-reason">Reason</FieldLabel>
                  <Input
                    id="regrade-reason"
                    value={regradeReason}
                    onChange={(e) => setRegradeReason(e.target.value)}
                  />
                </Field>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => void onRegrade()}
              >
                Regrade
              </Button>
              {isQuiz ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="dq-note">Note (disqualify / reattempt)</FieldLabel>
                    <Input
                      id="dq-note"
                      value={dqNote}
                      onChange={(e) => setDqNote(e.target.value)}
                      placeholder="Optional note"
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {row.disqualified ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving}
                        onClick={() => void onRequalify()}
                      >
                        Re-qualify
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={saving}
                        onClick={() => void onDisqualify()}
                      >
                        Disqualify
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={() => void onGrantReattempt('continue')}
                    >
                      Grant continue
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={() => void onGrantReattempt('restart')}
                    >
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

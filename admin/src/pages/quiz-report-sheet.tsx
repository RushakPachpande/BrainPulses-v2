import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { StatusPill } from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOrgId } from '@/hooks/use-org-id';
import { adminQueryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { getQuizReportDetail, type QuizReportDetail } from '@/services/quiz-reports';
import {
  AUTO_REASON_LABEL,
  attemptsLabel,
  attemptStatusLabel,
  formatDuration,
  formatMarks,
  formatReportDate,
  negativeLabel,
  percentClass,
  signedMarks,
} from '@/pages/quiz-report-format';

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

function AttemptStatusText({ status }: { status: 'completed' | 'in_progress' | 'not_started' }) {
  const tone = status === 'completed' ? 'ok' : status === 'in_progress' ? 'wn' : 'gy';
  return <StatusPill value={attemptStatusLabel(status)} tone={tone} />;
}

function ResultText({ result }: { result: 'pass' | 'fail' | null }) {
  if (result == null) return <Dash />;
  return (
    <StatusPill
      value={result === 'pass' ? 'Pass' : 'Fail'}
      tone={result === 'pass' ? 'ok' : 'er'}
    />
  );
}

export function DetailBody({
  detail,
  onSelect,
  notStartedMessage = 'No attempts yet. This student registered but has not started the quiz.',
}: {
  detail: QuizReportDetail;
  onSelect: (attemptId: string) => void;
  notStartedMessage?: string;
}) {
  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <dl className="grid grid-cols-1 gap-3 rounded-lg bg-muted p-4 sm:grid-cols-2">
        {(
          [
            ['Registration ID', detail.code],
            ['Email', detail.email],
            ['Phone', detail.phone],
            ['Registered on', formatReportDate(detail.registeredAt)],
            ['Attempts used', attemptsLabel(detail.attemptsStarted, detail.attemptsAllowed)],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium wrap-break-word">{value || <Dash />}</dd>
          </div>
        ))}
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Attempt status</dt>
          <dd className="mt-1">
            <AttemptStatusText status={detail.attemptStatus} />
          </dd>
        </div>
      </dl>

      {detail.note === 'not_started' ? (
        <p className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
          {notStartedMessage}
        </p>
      ) : null}

      {detail.attempts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">All attempts</h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    'Attempt',
                    'Marks scored',
                    'Total marks',
                    '%',
                    'Result',
                    'Time taken',
                    'Submitted',
                    'Auto-submitted',
                    'Attempt status',
                  ].map((label) => (
                    <TableHead key={label} className="whitespace-nowrap">
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.attempts.map((attempt) => (
                  <TableRow
                    key={attempt.id}
                    data-state={attempt.id === detail.selectedAttemptId ? 'selected' : undefined}
                    className={cn(
                      attempt.selectable && 'cursor-pointer',
                      attempt.id === detail.selectedAttemptId && 'bg-accent',
                    )}
                    tabIndex={attempt.selectable ? 0 : undefined}
                    onClick={() => {
                      if (attempt.selectable) onSelect(attempt.id);
                    }}
                    onKeyDown={(event) => {
                      if (!attempt.selectable) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect(attempt.id);
                      }
                    }}
                  >
                    <TableCell className="whitespace-nowrap">
                      {attempt.number}{' '}
                      {attempt.counted ? <StatusPill value="Counted" tone="pr" /> : null}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {attempt.score == null ? <Dash /> : formatMarks(attempt.score)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {attempt.maxScore == null ? <Dash /> : formatMarks(attempt.maxScore)}
                    </TableCell>
                    <TableCell>
                      {attempt.percent == null ? (
                        <Dash />
                      ) : (
                        <span className={percentClass(attempt.percent, detail.passingPercent)}>
                          {attempt.percent}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ResultText result={attempt.result} />
                    </TableCell>
                    <TableCell>
                      {attempt.timeTakenSeconds == null ? (
                        <Dash />
                      ) : (
                        formatDuration(attempt.timeTakenSeconds)
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {attempt.submittedAt ? formatReportDate(attempt.submittedAt) : <Dash />}
                    </TableCell>
                    <TableCell>
                      {attempt.attemptStatus === 'in_progress' ? (
                        <Dash />
                      ) : attempt.autoSubmitted ? (
                        <div>
                          <StatusPill value="Yes" tone="wn" />
                          {attempt.autoSubmitReason ? (
                            <div className="mt-1 text-xs font-medium text-warning">
                              {AUTO_REASON_LABEL[attempt.autoSubmitReason]}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        'No'
                      )}
                    </TableCell>
                    <TableCell>
                      <AttemptStatusText status={attempt.attemptStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {detail.note === 'in_progress' ? (
        <p className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
          This attempt is still in progress. Answers appear here once it is submitted.
        </p>
      ) : null}

      {detail.showSelectPrompt && detail.note == null ? (
        <p className="text-sm text-muted-foreground">Select an attempt to see its answers.</p>
      ) : null}

      {detail.answers ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {detail.answers.summary.correct} correct · {detail.answers.summary.wrong} wrong ·{' '}
            {detail.answers.summary.skipped} not answered ·{' '}
            {negativeLabel(detail.answers.summary.negative)} negative marks
          </p>
          {detail.answers.groups.map((group, index) => (
            <div
              key={group.questions[0]?.questionVersionId ?? index}
              className={cn(
                'flex flex-col gap-3',
                group.passage && 'border-l-2 border-primary/30 pl-3',
              )}
            >
              {group.passage ? (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <div className="mb-1 text-xs font-semibold text-primary">Passage</div>
                  {group.passage}
                </div>
              ) : null}
              {group.questions.map((question) => (
                <article key={question.questionVersionId} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">
                      {question.number}. {question.question}
                    </p>
                    <span
                      className={cn(
                        'text-sm font-semibold whitespace-nowrap tabular-nums',
                        question.marks > 0
                          ? 'text-success'
                          : question.marks < 0
                            ? 'text-destructive'
                            : 'text-muted-foreground',
                      )}
                    >
                      {signedMarks(question.marks)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Answered:{' '}
                    <span
                      className={cn(
                        'font-medium',
                        question.correct === true && 'text-success',
                        question.correct === false && question.answered && 'text-destructive',
                        !question.answered && 'text-foreground',
                      )}
                    >
                      {question.answerText}
                    </span>
                  </p>
                  {question.correctText ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Correct:{' '}
                      <span className="font-medium text-foreground">{question.correctText}</span>
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function QuizReportSheet({
  registrationId,
  onOpenChange,
}: {
  registrationId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const orgId = useOrgId();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  useEffect(() => {
    setAttemptId(null);
  }, [registrationId]);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: adminQueryKeys.quizReportDetail(orgId, registrationId ?? '', attemptId ?? ''),
    queryFn: () => getQuizReportDetail(registrationId ?? '', attemptId),
    enabled: Boolean(orgId && registrationId),
  });

  return (
    <Sheet open={registrationId != null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        <SheetHeader className="pr-12">
          <SheetDescription>
            {data
              ? `${data.quizName}${data.contestName ? ` · ${data.contestName}` : ''}`
              : 'Quiz report'}
          </SheetDescription>
          <SheetTitle>{data?.name ?? 'Participant'}</SheetTitle>
          {data?.resultId ? (
            <Button asChild variant="outline" className="mt-2 w-fit">
              <Link to={`/quizzes/reports/${data.resultId}`}>Open result</Link>
            </Button>
          ) : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isPending ? (
            <p className="px-4 text-sm text-muted-foreground">Loading results.</p>
          ) : null}
          {isError ? (
            <div className="flex flex-col items-start gap-3 px-4">
              <p className="text-sm text-muted-foreground">Couldn&apos;t load results.</p>
              <Button type="button" variant="outline" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : null}
          {data ? <DetailBody detail={data} onSelect={setAttemptId} /> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

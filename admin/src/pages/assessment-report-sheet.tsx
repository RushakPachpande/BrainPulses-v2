import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { DetailBody } from '@/pages/quiz-report-sheet';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useOrgId } from '@/hooks/use-org-id';
import { adminQueryKeys } from '@/lib/query-keys';
import { getAssessmentReportDetail } from '@/services/assessment-reports';

export function AssessmentReportSheet({
  registrationId,
  roundId,
  onOpenChange,
}: {
  registrationId: string | null;
  roundId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const orgId = useOrgId();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const open = Boolean(registrationId && roundId);
  useEffect(() => {
    setAttemptId(null);
  }, [registrationId, roundId]);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: adminQueryKeys.assessmentReportDetail(
      orgId,
      registrationId ?? '',
      roundId ?? '',
      attemptId ?? '',
    ),
    queryFn: () => getAssessmentReportDetail(registrationId ?? '', roundId ?? '', attemptId),
    enabled: Boolean(orgId && registrationId && roundId),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        <SheetHeader className="pr-12">
          <SheetDescription>
            {data
              ? `${data.quizName}${data.roundName ? ` · ${data.roundName}` : ''}`
              : 'Assessment report'}
          </SheetDescription>
          <SheetTitle>{data?.name ?? 'Participant'}</SheetTitle>
          {data?.resultId ? (
            <Button asChild variant="outline" className="mt-2 w-fit">
              <Link to={`/assessments/reports/${data.resultId}`}>Open result</Link>
            </Button>
          ) : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isPending && open ? (
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
          {data ? (
            <DetailBody
              detail={data}
              onSelect={setAttemptId}
              notStartedMessage="No attempts yet. This student has not started this round."
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

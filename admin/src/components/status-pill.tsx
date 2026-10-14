import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { statusTone, type StatusTone } from '@/utils/tone';

export type PillTone = Exclude<StatusTone, ''> | 'pr';

const toneDot: Record<PillTone, string> = {
  ok: 'bg-success',
  wn: 'bg-warning',
  er: 'bg-destructive',
  gy: 'bg-muted-foreground',
  pr: 'bg-primary',
};

export function StatusPill({
  value,
  tone,
  showDot = true,
}: {
  value: string;
  tone: PillTone;
  showDot?: boolean;
}) {
  return (
    <Badge variant="outline" data-tone={tone} className="h-auto gap-1.5 rounded-full px-2.5 py-1">
      {showDot ? (
        <span className={cn('size-1.5 shrink-0 rounded-full', toneDot[tone])} aria-hidden="true" />
      ) : null}
      {value}
    </Badge>
  );
}

/** Active / Draft / Completed (activity + question bank flow). */
export function FlowStatusPill({ status }: { status: string }) {
  const tone: PillTone = status === 'Completed' ? 'pr' : status === 'Active' ? 'ok' : 'wn';
  return <StatusPill value={status} tone={tone} />;
}

export function AssignmentStatusPill({ value }: { value: string }) {
  return <StatusPill value={value} tone={value === 'Assigned' ? 'ok' : 'wn'} />;
}

export function AttemptStatusPill({ value }: { value: string }) {
  const tone: PillTone = value === 'Completed' ? 'ok' : value === 'In Progress' ? 'wn' : 'er';
  return <StatusPill value={value} tone={tone} />;
}

/** Active / Inactive (and other values mapped by statusTone). */
export function AccountStatusPill({ value }: { value: string }) {
  const tone = statusTone(value);
  if (!tone) return <StatusPill value={value} tone="gy" />;
  return <StatusPill value={value} tone={tone} />;
}

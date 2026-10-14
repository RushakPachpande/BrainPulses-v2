import { StatusPill } from '@/components/status-pill';
import { statusTone } from '@/utils/tone';

export function StatusBadge({ value }: { value: string }) {
  const tone = statusTone(value) || 'gy';
  return <StatusPill value={value} tone={tone} showDot={false} />;
}

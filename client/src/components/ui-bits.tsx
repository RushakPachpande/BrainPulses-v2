import type { LucideIcon } from 'lucide-react';
import { BookOpen, Target } from 'lucide-react';
import type { ReactNode } from 'react';

export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  );
}

export function Status({ value }: { value: string }) {
  const tone =
    value === 'Completed' || value === 'Available' || value === 'Submitted'
      ? 'success'
      : value === 'In progress'
        ? 'brand'
        : 'warning';
  return (
    <span className={`status status-${tone}`}>
      <i />
      {value}
    </span>
  );
}

export function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon size={18} />
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-detail">{detail}</div>
    </div>
  );
}

export function KindIcon({ kind }: { kind: string }) {
  return kind === 'quiz' || kind === 'Quiz' ? <BookOpen size={19} /> : <Target size={19} />;
}

export function formatKind(kind: string) {
  return kind === 'quiz' ? 'Quiz' : kind === 'assessment' ? 'Assessment' : kind;
}

export function formatDateLabel(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatDuration(minutes: number | null | undefined) {
  if (minutes == null) return '—';
  return `${minutes} min`;
}

export function timeRemaining(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function answerLabel(answer: unknown): string | null {
  if (!answer || typeof answer !== 'object') return null;
  if ('label' in answer && typeof (answer as { label: unknown }).label === 'string') {
    return (answer as { label: string }).label;
  }
  return null;
}

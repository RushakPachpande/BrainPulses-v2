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

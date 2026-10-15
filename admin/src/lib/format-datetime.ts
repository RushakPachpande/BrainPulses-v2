const dateFmt = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const timeFmt = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatAdminDate(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? dateFmt.format(d) : '—';
}

export function formatAdminTime(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? timeFmt.format(d) : '—';
}

export function formatAdminDateTime(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : '—';
}

export function formatRelativeTime(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatAdminDate(d);
}

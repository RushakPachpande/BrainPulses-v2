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
  if (answer == null) return null;
  if (typeof answer === 'string') {
    const trimmed = answer.trim();
    return trimmed || null;
  }
  if (Array.isArray(answer)) {
    const labels = answer
      .map((item) => (typeof item === 'string' ? item : answerLabel(item)))
      .filter((item): item is string => Boolean(item));
    return labels.length > 0 ? labels.join(', ') : null;
  }
  if (typeof answer !== 'object') return null;
  const obj = answer as Record<string, unknown>;
  if (typeof obj.label === 'string') return obj.label;
  if (Array.isArray(obj.labels)) {
    const labels = obj.labels.filter((item): item is string => typeof item === 'string');
    return labels.length > 0 ? labels.join(', ') : null;
  }
  if (typeof obj.value === 'string' || typeof obj.value === 'number') {
    return String(obj.value);
  }
  if (typeof obj.text === 'string') {
    const trimmed = obj.text.trim();
    return trimmed || null;
  }
  return null;
}

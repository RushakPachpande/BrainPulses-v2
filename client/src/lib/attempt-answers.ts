export type AttemptAnswerValue =
  { label: string } | { labels: string[] } | { value: number } | { text: string };

export type AnswerMap = Record<string, AttemptAnswerValue>;

export function answerFromResponse(answer: unknown): AttemptAnswerValue | null {
  if (answer == null) return null;
  if (typeof answer === 'string') {
    const trimmed = answer.trim();
    return trimmed ? { label: trimmed } : null;
  }
  if (typeof answer === 'number' && Number.isFinite(answer)) {
    return { value: answer };
  }
  if (Array.isArray(answer)) {
    const labels = answer.map(String).filter(Boolean);
    return labels.length ? { labels } : null;
  }
  if (typeof answer !== 'object') return null;
  const obj = answer as Record<string, unknown>;
  if (typeof obj.label === 'string' && obj.label) return { label: obj.label };
  if (Array.isArray(obj.labels)) {
    const labels = obj.labels.map(String).filter(Boolean);
    return labels.length ? { labels } : null;
  }
  if (typeof obj.value === 'number' && Number.isFinite(obj.value)) return { value: obj.value };
  if (
    typeof obj.value === 'string' &&
    obj.value.trim() !== '' &&
    !Number.isNaN(Number(obj.value))
  ) {
    return { value: Number(obj.value) };
  }
  if (typeof obj.text === 'string') return { text: obj.text };
  return null;
}

export function isAnswered(answer: AttemptAnswerValue | undefined): boolean {
  if (!answer) return false;
  if ('label' in answer) return Boolean(answer.label);
  if ('labels' in answer) return answer.labels.length > 0;
  if ('value' in answer) return Number.isFinite(answer.value);
  if ('text' in answer) return answer.text.trim().length > 0;
  return false;
}

export function instructionForType(type: string): string {
  switch (type) {
    case 'multiple_mcq':
    case 'image_selection':
      return 'Select all answers that apply.';
    case 'numeric':
      return 'Enter a numeric answer.';
    case 'short_text':
      return 'Type a short answer.';
    case 'long_text':
      return 'Type your answer in the box below.';
    case 'true_false':
      return 'Choose True or False.';
    case 'comprehension_mcq':
      return 'Read the passage, then choose one answer.';
    default:
      return 'Choose one answer from the options below.';
  }
}

export function isMultiSelectType(type: string): boolean {
  return type === 'multiple_mcq' || type === 'image_selection';
}

export function isSingleSelectType(type: string): boolean {
  return (
    type === 'single_mcq' ||
    type === 'true_false' ||
    type === 'image_mcq' ||
    type === 'comprehension_mcq' ||
    type === 'passage' ||
    type === 'match'
  );
}

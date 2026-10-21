import type { Prisma } from '#prisma';

type AnswerKey = {
  correctLabels?: string[];
  value?: number | string;
  numericTolerance?: number;
};

function selectedLabels(answer: unknown): string[] {
  if (Array.isArray(answer)) {
    return answer.map(String);
  }
  if (answer && typeof answer === 'object') {
    const obj = answer as Record<string, unknown>;
    if ('labels' in obj) {
      return (Array.isArray(obj.labels) ? obj.labels : []).map(String);
    }
    if ('label' in obj && obj.label != null) {
      return [String(obj.label)];
    }
  }
  if (typeof answer === 'string') {
    return [answer];
  }
  return [];
}

function scoreLabelSet(
  type: string,
  correct: Set<string>,
  selected: string[],
  points: number,
): number {
  if (correct.size === 0) return 0;

  if (type === 'multiple_mcq' || type === 'image_selection') {
    const sel = new Set(selected);
    if (sel.size !== correct.size) return 0;
    for (const c of correct) {
      if (!sel.has(c)) return 0;
    }
    return points;
  }

  return selected.length === 1 && correct.has(selected[0]!) ? points : 0;
}

/**
 * Returns earned points, or `null` when the item should be excluded from maxScore
 * (unscored text with no reference answer).
 */
export function scoreObjective(
  type: string,
  answerKey: unknown,
  answer: unknown,
  points: number,
): number | null {
  const key = (answerKey ?? {}) as AnswerKey;

  if (type === 'short_text' || type === 'long_text') {
    const expected =
      key.value !== undefined && key.value !== null ? String(key.value).trim().toLowerCase() : '';
    if (!expected) return null;
    let got = '';
    if (typeof answer === 'string') got = answer;
    else if (answer && typeof answer === 'object' && 'text' in (answer as object)) {
      got = String((answer as { text: unknown }).text ?? '');
    } else if (answer && typeof answer === 'object' && 'value' in (answer as object)) {
      got = String((answer as { value: unknown }).value ?? '');
    }
    return got.trim().toLowerCase() === expected ? points : 0;
  }

  if (type === 'numeric') {
    const expected = Number(key.value);
    const got = Number((answer as { value?: unknown })?.value ?? answer);
    if (Number.isNaN(expected) || Number.isNaN(got)) return 0;
    const tol = key.numericTolerance ?? 0;
    return Math.abs(expected - got) <= tol ? points : 0;
  }

  const correct = new Set((key.correctLabels ?? []).map(String));
  const selected = selectedLabels(answer);
  return scoreLabelSet(type, correct, selected, points);
}

export function toNumber(d: Prisma.Decimal | number): number {
  return typeof d === 'number' ? d : Number(d);
}

import type { Prisma } from '#prisma';

type AnswerKey = {
  correctLabels?: string[];
  value?: number | string;
  numericTolerance?: number;
};

export function scoreObjective(
  type: string,
  answerKey: unknown,
  answer: unknown,
  points: number,
): number | null {
  const key = (answerKey ?? {}) as AnswerKey;

  if (type === 'short_text') {
    return null;
  }

  if (type === 'numeric') {
    const expected = Number(key.value);
    const got = Number((answer as { value?: unknown })?.value ?? answer);
    if (Number.isNaN(expected) || Number.isNaN(got)) return 0;
    const tol = key.numericTolerance ?? 0;
    return Math.abs(expected - got) <= tol ? points : 0;
  }

  const correct = new Set((key.correctLabels ?? []).map(String));
  if (correct.size === 0) return 0;

  let selected: string[] = [];
  if (Array.isArray(answer)) {
    selected = answer.map(String);
  } else if (answer && typeof answer === 'object' && 'labels' in (answer as object)) {
    selected = ((answer as { labels: unknown[] }).labels ?? []).map(String);
  } else if (answer && typeof answer === 'object' && 'label' in (answer as object)) {
    selected = [String((answer as { label: unknown }).label)];
  } else if (typeof answer === 'string') {
    selected = [answer];
  }

  if (type === 'multiple_mcq') {
    const sel = new Set(selected);
    if (sel.size !== correct.size) return 0;
    for (const c of correct) {
      if (!sel.has(c)) return 0;
    }
    return points;
  }

  return selected.length === 1 && correct.has(selected[0]!) ? points : 0;
}

export function toNumber(d: Prisma.Decimal | number): number {
  return typeof d === 'number' ? d : Number(d);
}

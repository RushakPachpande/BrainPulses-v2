import type { BankQuestionItem, BankQuestionOption } from '@/services';
import type { BankAuthorType } from './bank-question-types';
import { isBankAuthorType, isOptionFilled } from './bank-question-types';

export type OptionDraft = {
  label: string;
  body: string;
  isCorrect: boolean;
  imageUrl: string;
};

export type QuestionDraft = {
  type: BankAuthorType;
  question: string;
  points: number;
  options: OptionDraft[];
  passageText: string;
  questionImageUrl: string;
  referenceValue: string;
  numericTolerance: string;
};

const LETTERS = ['A', 'B', 'C', 'D'] as const;

export function emptyOptions(count = 4, multiCorrect = false): OptionDraft[] {
  return LETTERS.slice(0, count).map((label, i) => ({
    label,
    body: '',
    isCorrect: multiCorrect ? false : i === 0,
    imageUrl: '',
  }));
}

export function trueFalseOptions(correct: 'A' | 'B' = 'A'): OptionDraft[] {
  return [
    { label: 'A', body: 'True', isCorrect: correct === 'A', imageUrl: '' },
    { label: 'B', body: 'False', isCorrect: correct === 'B', imageUrl: '' },
  ];
}

export function emptyDraft(type: BankAuthorType = 'single_mcq'): QuestionDraft {
  if (type === 'true_false') {
    return {
      type,
      question: '',
      points: 1,
      options: trueFalseOptions(),
      passageText: '',
      questionImageUrl: '',
      referenceValue: '',
      numericTolerance: '0',
    };
  }
  if (type === 'multiple_mcq' || type === 'image_selection') {
    return {
      type,
      question: '',
      points: 1,
      options: emptyOptions(4, true),
      passageText: '',
      questionImageUrl: '',
      referenceValue: '',
      numericTolerance: '0',
    };
  }
  if (type === 'numeric' || type === 'short_text' || type === 'long_text') {
    return {
      type,
      question: '',
      points: 1,
      options: [],
      passageText: '',
      questionImageUrl: '',
      referenceValue: '',
      numericTolerance: '0',
    };
  }
  return {
    type,
    question: '',
    points: 1,
    options: emptyOptions(4, false),
    passageText: '',
    questionImageUrl: '',
    referenceValue: '',
    numericTolerance: '0',
  };
}

export function draftFromItem(item: BankQuestionItem): QuestionDraft {
  const type: BankAuthorType = isBankAuthorType(item.type) ? item.type : 'single_mcq';
  const base = emptyDraft(type);
  const byLabel = new Map((item.options ?? []).map((o) => [o.label, o]));
  const correctFromKey = new Set(item.correctLabels ?? []);

  let options = base.options;
  if (type === 'true_false') {
    options = trueFalseOptions();
    for (const o of options) {
      const existing = byLabel.get(o.label);
      if (existing) {
        o.body = existing.body || o.body;
        o.isCorrect = Boolean(existing.isCorrect) || correctFromKey.has(o.label);
      } else {
        o.isCorrect = correctFromKey.has(o.label);
      }
    }
  } else if (
    type === 'single_mcq' ||
    type === 'multiple_mcq' ||
    type === 'image_mcq' ||
    type === 'image_selection' ||
    type === 'comprehension_mcq'
  ) {
    const labels =
      (item.options?.length ?? 0) > 0 ? item.options!.map((o) => o.label) : LETTERS.slice(0, 4);
    options = labels.map((label) => {
      const existing = byLabel.get(label);
      return {
        label,
        body: existing?.body ?? '',
        isCorrect: Boolean(existing?.isCorrect) || correctFromKey.has(label),
        imageUrl: existing?.imageUrl ?? '',
      };
    });
    while (options.length < 2) {
      options.push({
        label: LETTERS[options.length] ?? String(options.length + 1),
        body: '',
        isCorrect: false,
        imageUrl: '',
      });
    }
    normalizeCorrectFlags(options, type === 'multiple_mcq' || type === 'image_selection');
  }

  const ref =
    item.referenceValue !== undefined && item.referenceValue !== null
      ? String(item.referenceValue)
      : '';

  return {
    type,
    question: item.question,
    points: item.points || 1,
    options,
    passageText: item.passageText ?? '',
    questionImageUrl: item.questionImageUrl ?? '',
    referenceValue: ref,
    numericTolerance: item.numericTolerance !== undefined ? String(item.numericTolerance) : '0',
  };
}

function normalizeCorrectFlags(options: OptionDraft[], multi: boolean) {
  if (multi) {
    if (!options.some((o) => o.isCorrect) && options.some((o) => isOptionFilled(o))) {
      const first = options.find((o) => isOptionFilled(o));
      if (first) first.isCorrect = true;
    }
    return;
  }
  if (!options.some((o) => o.isCorrect)) {
    const first = options.find((o) => isOptionFilled(o));
    if (first) first.isCorrect = true;
  } else {
    let kept = false;
    for (const o of options) {
      if (!o.isCorrect) continue;
      if (kept) o.isCorrect = false;
      else kept = true;
    }
  }
}

export function validateDraft(draft: QuestionDraft): string | null {
  if (!draft.question.trim()) return 'Question is required.';
  if (draft.points < 1) return 'Points must be at least 1.';

  const filled = draft.options.filter((o) => isOptionFilled(o));
  const correct = filled.filter((o) => o.isCorrect);

  switch (draft.type) {
    case 'single_mcq':
    case 'image_mcq':
    case 'comprehension_mcq':
      if (filled.length < 2) return 'Add at least two options.';
      if (correct.length !== 1) return 'Mark exactly one correct option.';
      if (draft.type === 'comprehension_mcq' && !draft.passageText.trim()) {
        return 'Passage text is required.';
      }
      break;
    case 'true_false':
      if (filled.length !== 2) return 'True/False requires two options.';
      if (correct.length !== 1) return 'Mark exactly one correct option.';
      break;
    case 'multiple_mcq':
    case 'image_selection':
      if (filled.length < 2) return 'Add at least two options.';
      if (correct.length < 1) return 'Mark at least one correct option.';
      if (draft.type === 'image_selection' && filled.some((o) => !o.imageUrl.trim())) {
        return 'Each image-selection option needs an image URL.';
      }
      break;
    case 'numeric':
      if (draft.referenceValue.trim() === '' || Number.isNaN(Number(draft.referenceValue))) {
        return 'Enter a numeric correct answer.';
      }
      break;
    case 'short_text':
    case 'long_text':
      break;
    default:
      break;
  }
  return null;
}

export function draftToPayload(draft: QuestionDraft): {
  type: string;
  question: string;
  points: number;
  options?: { label: string; body: string; isCorrect: boolean; imageUrl?: string | null }[];
  answerKey: Record<string, unknown>;
} {
  const question = draft.question.trim();
  const points = draft.points;
  const type = draft.type;

  if (type === 'numeric') {
    const tol = Number(draft.numericTolerance);
    return {
      type,
      question,
      points,
      options: [],
      answerKey: {
        value: Number(draft.referenceValue),
        ...(Number.isFinite(tol) ? { numericTolerance: tol } : {}),
      },
    };
  }

  if (type === 'short_text' || type === 'long_text') {
    const answerKey: Record<string, unknown> = {};
    if (draft.referenceValue.trim()) answerKey.value = draft.referenceValue.trim();
    return { type, question, points, options: [], answerKey };
  }

  const options = draft.options
    .filter((o) => isOptionFilled(o))
    .map((o) => ({
      label: o.label,
      body: o.body.trim(),
      isCorrect: o.isCorrect,
      ...(o.imageUrl.trim() ? { imageUrl: o.imageUrl.trim() } : { imageUrl: null }),
    }));
  const correctLabels = options.filter((o) => o.isCorrect).map((o) => o.label);
  const answerKey: Record<string, unknown> = { correctLabels };
  if (draft.passageText.trim()) answerKey.passageText = draft.passageText.trim();
  if (draft.questionImageUrl.trim()) answerKey.questionImageUrl = draft.questionImageUrl.trim();

  return { type, question, points, options, answerKey };
}

/** Quiz banks persist only single_mcq; coerce legacy image_mcq on save. */
export function draftToPayloadForKind(
  draft: QuestionDraft,
  kind: 'quiz' | 'assessment',
): ReturnType<typeof draftToPayload> {
  const payload = draftToPayload(draft);
  if (kind === 'quiz' && (payload.type === 'image_mcq' || payload.type === 'single_mcq')) {
    return { ...payload, type: 'single_mcq' };
  }
  return payload;
}

export function optionsForReadOnly(item: BankQuestionItem): BankQuestionOption[] {
  return item.options ?? [];
}

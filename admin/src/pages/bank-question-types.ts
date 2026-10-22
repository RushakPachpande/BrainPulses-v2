/** Authorable types in the bank form (LevelUP-aligned). Legacy passage/match stay API-only. */
export const BANK_QUESTION_TYPES = [
  { value: 'single_mcq', label: 'Single choice' },
  { value: 'multiple_mcq', label: 'Multiple choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'numeric', label: 'Numerical' },
  { value: 'short_text', label: 'Short text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'image_mcq', label: 'Image multiple choice' },
  { value: 'image_selection', label: 'Image selection' },
  { value: 'comprehension_mcq', label: 'Reading comprehension' },
] as const;

export type BankAuthorType = (typeof BANK_QUESTION_TYPES)[number]['value'];

export type BankKind = 'quiz' | 'assessment';

const QUIZ_TYPES = [{ value: 'single_mcq' as const, label: 'Single choice' }];

const CHOICE_MEDIA_TYPES = new Set<string>([
  'single_mcq',
  'multiple_mcq',
  'true_false',
  'image_mcq',
  'image_selection',
  'comprehension_mcq',
]);

const LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  BANK_QUESTION_TYPES.map((t) => [t.value, t.label]),
);

export function bankQuestionTypeLabel(type: string): string {
  return LABEL_BY_VALUE[type] ?? type.replaceAll('_', ' ');
}

export function isBankAuthorType(type: string): type is BankAuthorType {
  return BANK_QUESTION_TYPES.some((t) => t.value === type);
}

/** Types shown in the authoring picker for this bank kind. */
export function typesForKind(kind: BankKind): readonly { value: BankAuthorType; label: string }[] {
  return kind === 'quiz' ? QUIZ_TYPES : BANK_QUESTION_TYPES;
}

/** Choice types that support optional stem / option images. */
export function supportsChoiceMedia(type: string): boolean {
  return CHOICE_MEDIA_TYPES.has(type);
}

/** Quiz banks may only author single_mcq; legacy image_mcq is readable until coerced on save. */
export function isQuizAllowedType(type: string): boolean {
  return type === 'single_mcq' || type === 'image_mcq';
}

export function isOptionFilled(o: { body?: string; imageUrl?: string }): boolean {
  return Boolean((o.body ?? '').trim() || (o.imageUrl ?? '').trim());
}

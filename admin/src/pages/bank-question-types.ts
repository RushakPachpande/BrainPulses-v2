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

const LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  BANK_QUESTION_TYPES.map((t) => [t.value, t.label]),
);

export function bankQuestionTypeLabel(type: string): string {
  return LABEL_BY_VALUE[type] ?? type.replaceAll('_', ' ');
}

export function isBankAuthorType(type: string): type is BankAuthorType {
  return BANK_QUESTION_TYPES.some((t) => t.value === type);
}

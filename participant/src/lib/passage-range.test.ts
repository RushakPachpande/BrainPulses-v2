import { describe, expect, it } from 'vitest';
import { passageHintLabel, passageQuestionRange } from './passage-range';

describe('passageQuestionRange', () => {
  const questions = [
    { passageText: 'A' },
    { passageText: 'A' },
    { passageText: 'A' },
    { passageText: 'B' },
    {},
  ];

  it('returns the contiguous 1-based range for a shared passage', () => {
    expect(passageQuestionRange(questions, 1)).toEqual({ start: 1, end: 3 });
    expect(passageQuestionRange(questions, 3)).toEqual({ start: 4, end: 4 });
  });

  it('returns null when there is no passage', () => {
    expect(passageQuestionRange(questions, 4)).toBeNull();
  });
});

describe('passageHintLabel', () => {
  it('names a single question or a range', () => {
    expect(passageHintLabel({ start: 16, end: 16 })).toBe(
      'Read carefully. Question 16 is about this passage.',
    );
    expect(passageHintLabel({ start: 16, end: 22 })).toBe(
      'Read carefully. Questions 16–22 are about this passage.',
    );
  });
});

/** 1-based inclusive range of questions that share the same passage text. */
export function passageQuestionRange(
  questions: Array<{ passageText?: string }>,
  index: number,
): { start: number; end: number } | null {
  const text = questions[index]?.passageText?.trim();
  if (!text) return null;
  let start = index;
  while (start > 0 && questions[start - 1]?.passageText?.trim() === text) start -= 1;
  let end = index;
  while (end < questions.length - 1 && questions[end + 1]?.passageText?.trim() === text) end += 1;
  return { start: start + 1, end: end + 1 };
}

export function passageHintLabel(range: { start: number; end: number } | null): string {
  if (!range) return 'Read carefully before answering.';
  if (range.start === range.end) {
    return `Read carefully. Question ${range.start} is about this passage.`;
  }
  return `Read carefully. Questions ${range.start}–${range.end} are about this passage.`;
}

export function formatAttemptAllowance(input: {
  attemptsUsed?: number;
  maxAttempts?: number | null;
  extraAttempts?: number;
}): string {
  const used = input.attemptsUsed ?? 0;
  const base =
    input.maxAttempts == null ? `${used} used · Unlimited` : `${used} of ${input.maxAttempts} used`;
  const extra = input.extraAttempts ?? 0;
  const atCap = input.maxAttempts != null && used >= input.maxAttempts;
  if (atCap && extra > 0) {
    return `${base} · ${extra} extra ${extra === 1 ? 'attempt' : 'attempts'} granted`;
  }
  return base;
}

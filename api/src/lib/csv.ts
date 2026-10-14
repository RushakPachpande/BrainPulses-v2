/** Strip CSV formula injection prefixes from cell values. */
export function sanitizeCsvCell(value: string): string {
  const trimmed = value.trim();
  if (/^[=+\-@|]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

export function stripFormulaInjection(value: string): string {
  return value
    .replace(/^['\t\r\n ]*([=+\-@|])/, '$1')
    .replace(/^[=+\-@|]+/, '')
    .trim();
}

export type ImportResultView = {
  kind: 'success' | 'warning' | 'error';
  title: string;
  summary: string;
  created: number;
  issues: string[];
  tip?: string;
};

export function importResultFromCounts(
  created: number,
  issues: string[],
  noun: string,
): ImportResultView {
  if (created === 0 && issues.length > 0) {
    return {
      kind: 'error',
      title: 'Import failed',
      summary: `No ${noun} were created.`,
      created: 0,
      issues,
      tip: 'Each line names the Excel row, the column, and why that row was skipped. Delete rows that already match a saved question. If a saved question differs from the file, confirm the update when asked. New questions in the file are still added.',
    };
  }
  if (issues.length > 0) {
    return {
      kind: 'warning',
      title: 'Import finished with issues',
      summary: `${created} ${noun}${created === 1 ? '' : 's'} created; some rows were skipped.`,
      created,
      issues,
      tip: 'The rows above were skipped because they already match a saved question, or the cells need a fix. New questions in the same file are still added. If a saved question differs, confirm the update when asked.',
    };
  }
  return {
    kind: 'success',
    title: 'Import complete',
    summary: `${created} ${noun}${created === 1 ? '' : 's'} created.`,
    created,
    issues: [],
    tip: 'You can edit any record from the list.',
  };
}

export function importResultFromError(err: unknown, tip?: string): ImportResultView {
  const message = err instanceof Error ? err.message : 'Could not import file.';
  return {
    kind: 'error',
    title: 'Import failed',
    summary: message,
    created: 0,
    issues: [],
    tip:
      tip ??
      'Upload an Excel (.xlsx) file only. Download Sample Excel for the expected columns, then try again.',
  };
}

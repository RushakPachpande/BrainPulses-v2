/** Data file cap for Excel imports. */
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export function xlsxOnlyRejectedMessage(originalName?: string): string {
  const name = originalName?.trim();
  const fileBit = name ? ` “${name}”` : '';
  return `File${fileBit} is not a supported spreadsheet. Upload an Excel (.xlsx) file only. Download Sample Excel for the correct template.`;
}

export function isXlsxFilename(name: string): boolean {
  return /\.xlsx$/i.test(name) && !/\.xlsx\./i.test(name);
}

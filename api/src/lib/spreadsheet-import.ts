import ExcelJS from 'exceljs';
import { unprocessable } from './errors.js';

/** Data rows per file. One past this is rejected; this exact count is accepted. */
export const MAX_IMPORT_ROWS = 1000;
/** Header scan is inclusive: row 20 can be the header, row 21 cannot. */
export const HEADER_SCAN_LIMIT = 20;
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export type ImportIssueParts = {
  sheetRow: number;
  column?: string;
  value?: string;
  problem: string;
  expected?: string;
  example?: string;
};

export type SpreadsheetColumnSpec<T extends string> = {
  /** Official header written in the sample workbook. */
  key: T;
  /** Normalized aliases (after normalizeHeaderKey). Official key is always included. */
  aliases?: string[];
};

export type SpreadsheetParseResult<T extends string> = {
  rows: Array<Record<T, string> & { sheetRow: number }>;
  ignoredColumns: string[];
  headerRow: number;
};

function quoteValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '(empty)';
  const clipped = trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
  return `"${clipped}"`;
}

/** Clear, actionable messages for spreadsheet import failures. */
export function formatImportIssue(parts: ImportIssueParts): string {
  const where = parts.column
    ? `Sheet row ${parts.sheetRow}, column “${parts.column}”`
    : `Sheet row ${parts.sheetRow}`;
  const valueBit =
    parts.value !== undefined
      ? `: ${quoteValue(parts.value)} — ${parts.problem}`
      : `: ${parts.problem}`;
  const expectedBit = parts.expected ? ` What to enter: ${parts.expected}.` : '';
  const exampleBit = parts.example ? ` For example: ${parts.example}.` : '';
  return `${where}${valueBit}.${expectedBit}${exampleBit}`
    .replace(/\.\.+/g, '.')
    .replace(/\. \./g, '.');
}

export function summarizeImportFailure(issueCount: number, noun = 'issue'): string {
  const n = Math.max(0, issueCount);
  const label = n === 1 ? noun : `${noun}s`;
  return `Import blocked: ${n} ${label} found. Fix the rows listed below, then upload again. Download Sample Excel if you need the correct column layout.`;
}

export function xlsxOnlyRejectedMessage(originalName?: string): string {
  const name = originalName?.trim();
  const fileBit = name ? ` “${name}”` : '';
  return `File${fileBit} is not a supported spreadsheet. Upload an Excel (.xlsx) file only. Download Sample Excel for the correct template.`;
}

function headerList(keys: string[], labels?: Partial<Record<string, string>>): string {
  return keys
    .map((key) => {
      const label = labels?.[key];
      return label && label.toLowerCase() !== key.toLowerCase() ? `${label} (${key})` : key;
    })
    .join(', ');
}

export function missingImportColumnsMessage(
  missing: string[],
  found: string[],
  unrecognized: string[],
  labels?: Partial<Record<string, string>>,
): string {
  const parts = [
    `The spreadsheet is missing required columns. Expected headers: ${headerList(missing, labels)}.`,
  ];
  if (found.length > 0) parts.push(`Found: ${headerList(found, labels)}.`);
  parts.push(
    'Put these names in the header row (usually row 1). You can change the column order, but do not rename a header. Data starts on the next row.',
  );
  if (unrecognized.length > 0) {
    parts.push(
      `These headers were not recognized: ${unrecognized.join(', ')}. Check the spelling against Sample Excel.`,
    );
  } else {
    parts.push('Download Sample Excel and keep the header row exactly as shown.');
  }
  return parts.join(' ');
}

export function duplicateImportColumnsMessage(
  key: string,
  headers: string[],
  label?: string,
): string {
  const named = label ? ` (${label})` : '';
  return `The spreadsheet has more than one column for “${key}”${named}: ${headers.join(' and ')}. Keep only one column for that field and delete the extra one. Download Sample Excel if you need the correct layout.`;
}

export function emptyImportMessage(what: string): string {
  return `No ${what} found in the file. The header row is there, but nothing is filled in under it. Add at least one data row, or download Sample Excel and replace the example rows with your own.`;
}

export function noWorksheetMessage(): string {
  return 'The file has no worksheet. Open it in Excel, ensure there is at least one sheet with a header row, save as .xlsx, and try again.';
}

export function tooManyImportRowsMessage(max = MAX_IMPORT_ROWS): string {
  return `This file has too many rows. One import can include up to ${max} data rows, not counting the header. Split the sheet and upload the rest as a second file.`;
}

/** Undo the leading apostrophe sanitizeCsvCell adds so a round-trip keeps the real text. */
export function readImportedText(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length > 1 && trimmed.startsWith("'") && /^[=+\-@|]/.test(trimmed.slice(1))) {
    return trimmed.slice(1).trim();
  }
  return trimmed;
}

export function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return readImportedText(String(value));
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('error' in value) return '';
    if ('formula' in value) {
      const result = value.result;
      if (result != null && result !== '') return cellText(result);
      return '';
    }
    if ('text' in value && typeof value.text === 'string') return readImportedText(value.text);
    if ('richText' in value && Array.isArray(value.richText)) {
      return readImportedText(value.richText.map((part) => part.text ?? '').join(''));
    }
    if ('result' in value && value.result != null) return cellText(value.result);
  }
  return readImportedText(String(value));
}

export function normalizeHeaderKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function buildAliasMap<T extends string>(
  columns: readonly SpreadsheetColumnSpec<T>[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const col of columns) {
    const keys = new Set<string>([
      normalizeHeaderKey(col.key),
      ...(col.aliases ?? []).map((alias) => normalizeHeaderKey(alias)),
    ]);
    for (const key of keys) {
      if (!key) continue;
      if (map.has(key) && map.get(key) !== col.key) {
        throw new Error(`Alias “${key}” maps to both ${map.get(key)} and ${col.key}`);
      }
      map.set(key, col.key);
    }
  }
  return map;
}

export function excelRowCells(row: ExcelJS.Row): string[] {
  const cells: string[] = [];
  row.eachCell((cell, col) => {
    cells[col - 1] = cellText(cell.value);
  });
  return cells.map((cell) => cell ?? '');
}

function sheetPreview(sheet: ExcelJS.Worksheet): string[][] {
  const last = Math.min(Math.max(sheet.rowCount, 1), HEADER_SCAN_LIMIT);
  const rows: string[][] = [];
  for (let rowNumber = 1; rowNumber <= last; rowNumber += 1) {
    rows.push(excelRowCells(sheet.getRow(rowNumber)));
  }
  return rows;
}

type HeaderCandidate<T extends string> = {
  index: number;
  columns: Map<number, T>;
  ignored: string[];
  foundKeys: T[];
  duplicates: Array<{ key: T; headers: string[] }>;
};

function mapHeaderRow<T extends string>(
  cells: string[],
  aliasMap: Map<string, T>,
  index: number,
): HeaderCandidate<T> | null {
  const columns = new Map<number, T>();
  const ignored: string[] = [];
  const seen = new Map<T, string[]>();

  cells.forEach((cell, colIndex) => {
    const raw = String(cell ?? '').trim();
    if (!raw) return;
    const key = aliasMap.get(normalizeHeaderKey(raw));
    if (!key) {
      ignored.push(raw);
      return;
    }
    const prior = seen.get(key) ?? [];
    prior.push(raw);
    seen.set(key, prior);
    if (prior.length === 1) columns.set(colIndex, key);
  });

  const foundKeys = [...new Set(columns.values())];
  if (foundKeys.length === 0) return null;

  const duplicates: Array<{ key: T; headers: string[] }> = [];
  for (const [key, headers] of seen) {
    if (headers.length > 1) duplicates.push({ key, headers });
  }

  return { index, columns, ignored, foundKeys, duplicates };
}

function findHeader<T extends string>(
  rows: string[][],
  aliasMap: Map<string, T>,
  required: readonly T[],
  labels?: Partial<Record<T, string>>,
): HeaderCandidate<T> {
  let best: HeaderCandidate<T> | null = null;
  let bestScore = 0;
  const limit = Math.min(rows.length, HEADER_SCAN_LIMIT);

  for (let index = 0; index < limit; index += 1) {
    const hit = mapHeaderRow(rows[index] ?? [], aliasMap, index);
    if (!hit) continue;
    const score = hit.foundKeys.length;
    if (score > bestScore) {
      best = hit;
      bestScore = score;
    }
  }

  if (!best) {
    throw unprocessable(
      missingImportColumnsMessage([...required], [], [], labels).replace(
        'Expected headers:',
        `No header row found in the first ${HEADER_SCAN_LIMIT} rows. Expected headers:`,
      ),
    );
  }

  if (best.duplicates.length > 0) {
    const first = best.duplicates[0]!;
    throw unprocessable(
      duplicateImportColumnsMessage(first.key, first.headers, labels?.[first.key]),
    );
  }

  const missing = required.filter((key) => !best.foundKeys.includes(key));
  if (missing.length > 0) {
    throw unprocessable(missingImportColumnsMessage(missing, best.foundKeys, best.ignored, labels));
  }

  return best;
}

function sheetHeaderScore<T extends string>(
  sheet: ExcelJS.Worksheet,
  aliasMap: Map<string, T>,
): number {
  let best = 0;
  for (const row of sheetPreview(sheet)) {
    const candidate = mapHeaderRow(row, aliasMap, 0);
    if (candidate && candidate.foundKeys.length > best) best = candidate.foundKeys.length;
  }
  return best;
}

function pickWorksheet<T extends string>(
  workbook: ExcelJS.Workbook,
  preferredName: string | undefined,
  aliasMap: Map<string, T>,
  required: readonly T[],
): ExcelJS.Worksheet {
  if (preferredName) {
    const named = workbook.getWorksheet(preferredName);
    if (named && sheetHeaderScore(named, aliasMap) === required.length) return named;
  }

  let bestSheet: ExcelJS.Worksheet | null = null;
  let bestScore = 0;
  for (const sheet of workbook.worksheets) {
    const score = sheetHeaderScore(sheet, aliasMap);
    if (score > bestScore) {
      bestSheet = sheet;
      bestScore = score;
    }
  }

  if (bestSheet) return bestSheet;
  const first = workbook.worksheets[0];
  if (!first) throw unprocessable(noWorksheetMessage());
  return first;
}

function rowFromCells<T extends string>(
  cells: string[],
  columns: Map<number, T>,
  keys: readonly T[],
  sheetRow: number,
): (Record<T, string> & { sheetRow: number }) | null {
  const values = {} as Record<T, string>;
  for (const key of keys) values[key] = '';
  let any = false;
  for (const [index, key] of columns) {
    const text = readImportedText(String(cells[index] ?? ''));
    if (text) any = true;
    values[key] = text;
  }
  if (!any) return null;
  return { ...values, sheetRow };
}

export type ParseXlsxOptions<T extends string> = {
  columns: readonly SpreadsheetColumnSpec<T>[];
  /** Official keys that must all be present (defaults to every column key). */
  required?: readonly T[];
  /** Plain names for header keys, used in missing-column errors. */
  labels?: Partial<Record<T, string>>;
  preferredSheetName?: string;
  emptyNoun: string;
  maxRows?: number;
};

/**
 * Parse an .xlsx buffer into keyed rows. Column order does not matter.
 * Throws AppError when the file type, headers, or row count are invalid.
 */
export async function parseXlsxWorkbook<T extends string>(
  buffer: Buffer,
  filename: string,
  options: ParseXlsxOptions<T>,
): Promise<SpreadsheetParseResult<T>> {
  const name = filename.toLowerCase();
  if (name.endsWith('.xls') && !name.endsWith('.xlsx')) {
    throw unprocessable(
      `Legacy .xls files are not supported. Save “${filename}” as Excel (.xlsx) and try again. Download Sample Excel for the correct template.`,
    );
  }
  if (!name.endsWith('.xlsx')) {
    throw unprocessable(xlsxOnlyRejectedMessage(filename));
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw unprocessable(
      `Excel file “${filename}” could not be parsed. Upload a valid .xlsx file. Download Sample Excel for the correct template.`,
    );
  }

  const keys = options.columns.map((c) => c.key);
  const required = options.required ?? keys;
  const aliasMap = buildAliasMap(options.columns);
  const sheet = pickWorksheet(workbook, options.preferredSheetName, aliasMap, required);
  const header = findHeader(sheetPreview(sheet), aliasMap, required, options.labels);

  const maxRows = options.maxRows ?? MAX_IMPORT_ROWS;
  const rows: Array<Record<T, string> & { sheetRow: number }> = [];
  sheet.eachRow((excelRow, rowNumber) => {
    if (rowNumber <= header.index + 1) return;
    const row = rowFromCells(excelRowCells(excelRow), header.columns, keys, rowNumber);
    if (row) rows.push(row);
  });

  if (rows.length > maxRows) throw unprocessable(tooManyImportRowsMessage(maxRows));
  if (rows.length === 0) throw unprocessable(emptyImportMessage(options.emptyNoun));

  return {
    rows,
    ignoredColumns: header.ignored,
    headerRow: header.index + 1,
  };
}

export function isXlsxFilename(name: string): boolean {
  return /\.xlsx$/i.test(name) && !/\.xlsx\./i.test(name);
}

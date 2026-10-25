import { parse as parseCsv } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';
import type { z } from 'zod';
import { sanitizeCsvCell } from '../../lib/csv.js';
import { unprocessable } from '../../lib/errors.js';
import {
  authorableTypesForKind,
  createQuestionSchema,
  type BankKind,
  type QuestionTypeValue,
} from './schema.js';

export const BANK_IMPORT_HEADERS = [
  'type',
  'question',
  'points',
  'optionA',
  'optionB',
  'optionC',
  'optionD',
  'optionE',
  'optionF',
  'correct',
  'numericValue',
  'numericTolerance',
  'referenceAnswer',
  'stemImageUrl',
  'optionA_imageUrl',
  'optionB_imageUrl',
  'optionC_imageUrl',
  'optionD_imageUrl',
  'optionE_imageUrl',
  'optionF_imageUrl',
  'passageText',
] as const;

export type BankImportHeader = (typeof BANK_IMPORT_HEADERS)[number];

/** Quiz sheets omit `type` — every row is single choice. */
export const QUIZ_BANK_IMPORT_HEADERS = BANK_IMPORT_HEADERS.filter(
  (h): h is Exclude<BankImportHeader, 'type'> => h !== 'type',
);

export function headersForKind(kind: BankKind): readonly BankImportHeader[] {
  return kind === 'quiz' ? QUIZ_BANK_IMPORT_HEADERS : BANK_IMPORT_HEADERS;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export type BankImportRow = Record<BankImportHeader, string> & { sheetRow: number };

export type BankCreatePayload = z.infer<typeof createQuestionSchema>;

export type ExportableQuestion = {
  type: string;
  question: string;
  points: number;
  options: {
    label: string;
    body: string;
    isCorrect: boolean;
    imageUrl?: string | null;
  }[];
  correctLabels?: string[];
  passageText?: string;
  questionImageUrl?: string;
  referenceValue?: unknown;
  numericTolerance?: number;
};

export type ImportIssue = { row: number; message: string };

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('result' in value && value.result != null)
      return cellText(value.result as ExcelJS.CellValue);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText
        .map((r) => r.text ?? '')
        .join('')
        .trim();
    }
  }
  return String(value).trim();
}

function normalizeHeaderKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

const HEADER_ALIAS: Record<string, BankImportHeader | 'skip'> = {
  type: 'type',
  question: 'question',
  stem: 'question',
  text: 'question',
  points: 'points',
  point: 'points',
  marks: 'points',
  optiona: 'optionA',
  optionb: 'optionB',
  optionc: 'optionC',
  optiond: 'optionD',
  optione: 'optionE',
  optionf: 'optionF',
  a: 'optionA',
  b: 'optionB',
  c: 'optionC',
  d: 'optionD',
  e: 'optionE',
  f: 'optionF',
  correct: 'correct',
  answer: 'correct',
  numericvalue: 'numericValue',
  value: 'numericValue',
  numerictolerance: 'numericTolerance',
  tolerance: 'numericTolerance',
  referenceanswer: 'referenceAnswer',
  reference: 'referenceAnswer',
  stemimageurl: 'stemImageUrl',
  questionimageurl: 'stemImageUrl',
  optionaimageurl: 'optionA_imageUrl',
  optionbimageurl: 'optionB_imageUrl',
  optioncimageurl: 'optionC_imageUrl',
  optiondimageurl: 'optionD_imageUrl',
  optioneimageurl: 'optionE_imageUrl',
  optionfimageurl: 'optionF_imageUrl',
  passagetext: 'passageText',
  passage: 'passageText',
  passagebody: 'passageText',
};

function emptyRow(sheetRow: number): BankImportRow {
  const row = { sheetRow } as BankImportRow;
  for (const h of BANK_IMPORT_HEADERS) row[h] = '';
  return row;
}

function sheetHasRequiredHeaders(headers: (string | undefined)[]): boolean {
  const keys = new Set(headers.filter(Boolean).map((h) => normalizeHeaderKey(h!)));
  // Assessment sheets include type; quiz sheets may omit it (always single_mcq).
  return keys.has('question') || keys.has('stem') || keys.has('text');
}

function pickWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const named = workbook.getWorksheet('Questions');
  if (named) return named;
  for (const sheet of workbook.worksheets) {
    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, col) => {
      headers[col] = cellText(cell.value);
    });
    if (sheetHasRequiredHeaders(headers)) return sheet;
  }
  const first = workbook.worksheets[0];
  if (!first) throw unprocessable('No worksheet found in the file.');
  return first;
}

function rowsFromSheet(sheet: ExcelJS.Worksheet): BankImportRow[] {
  const headerByCol: Record<number, BankImportHeader> = {};
  sheet.getRow(1).eachCell((cell, col) => {
    const alias = HEADER_ALIAS[normalizeHeaderKey(cellText(cell.value))];
    if (alias && alias !== 'skip') headerByCol[col] = alias;
  });

  if (!Object.values(headerByCol).includes('question')) {
    throw unprocessable('Missing required column. Expected question (or stem).');
  }

  const rows: BankImportRow[] = [];
  sheet.eachRow((excelRow, rowNumber) => {
    if (rowNumber === 1) return;
    const row = emptyRow(rowNumber);
    let any = false;
    excelRow.eachCell((cell, col) => {
      const key = headerByCol[col];
      if (!key) return;
      const text = cellText(cell.value);
      if (text) any = true;
      row[key] = text;
    });
    if (!any) return;
    if (!row.question.trim() && !row.type.trim()) return;
    rows.push(row);
  });
  return rows;
}

function rowsFromCsvString(csv: string): BankImportRow[] {
  let records: Record<string, string>[];
  try {
    records = parseCsv(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch {
    throw unprocessable('CSV could not be parsed.');
  }

  return records
    .map((raw, i) => {
      const row = emptyRow(i + 2);
      for (const [key, value] of Object.entries(raw)) {
        const alias = HEADER_ALIAS[normalizeHeaderKey(key)];
        if (!alias || alias === 'skip') continue;
        row[alias] = String(value ?? '').trim();
      }
      return row;
    })
    .filter((r) => r.question.trim() || r.type.trim());
}

export async function parseBankQuestionsFile(
  buffer: Buffer,
  filename: string,
  mimetype?: string,
): Promise<BankImportRow[]> {
  const name = filename.toLowerCase();
  const isCsv = name.endsWith('.csv') || mimetype === 'text/csv' || mimetype === 'application/csv';

  if (isCsv) {
    return rowsFromCsvString(buffer.toString('utf8'));
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw unprocessable('Excel file could not be parsed. Use .xlsx or .csv.');
  }
  return rowsFromSheet(pickWorksheet(workbook));
}

export function parseBankQuestionsCsv(csv: string): BankImportRow[] {
  return rowsFromCsvString(csv);
}

function parseCorrectLetters(raw: string): string[] {
  return raw
    .toUpperCase()
    .split(/[,+\s|]+/)
    .map((s) => s.trim())
    .filter((s) => /^[A-F]$/.test(s));
}

function collectOptions(row: BankImportRow): {
  label: string;
  body: string;
  isCorrect: boolean;
  imageUrl?: string | null;
}[] {
  const letters = parseCorrectLetters(row.correct);
  const options: {
    label: string;
    body: string;
    isCorrect: boolean;
    imageUrl?: string | null;
  }[] = [];

  for (const letter of OPTION_LETTERS) {
    const bodyKey = `option${letter}` as BankImportHeader;
    const imageKey = `option${letter}_imageUrl` as BankImportHeader;
    const body = (row[bodyKey] ?? '').trim();
    const imageUrl = (row[imageKey] ?? '').trim();
    if (!body && !imageUrl) continue;
    options.push({
      label: letter,
      body,
      isCorrect: letters.includes(letter),
      ...(imageUrl ? { imageUrl } : {}),
    });
  }
  return options;
}

/**
 * Map a sheet row to a createQuestion payload. Throws Error with a user-facing message on failure.
 */
export function rowToCreatePayload(
  row: BankImportRow,
  kind: BankKind = 'assessment',
): BankCreatePayload {
  const typeRaw = row.type.trim().toLowerCase();
  const allowed = authorableTypesForKind(kind);
  let type: QuestionTypeValue;
  if (kind === 'quiz') {
    // Quiz sheets omit type; blank or single_mcq both mean single choice.
    if (typeRaw && typeRaw !== 'single_mcq' && typeRaw !== 'image_mcq') {
      throw new Error(`Quiz banks only support single-choice questions. Got “${row.type.trim()}”.`);
    }
    type = 'single_mcq';
  } else {
    if (!typeRaw) throw new Error('type is required');
    if (!allowed.has(typeRaw)) {
      throw new Error(`Unknown type “${row.type.trim()}”. Use one of: ${[...allowed].join(', ')}`);
    }
    type = typeRaw as QuestionTypeValue;
  }

  const question = row.question.trim();
  if (!question) throw new Error('question is required');

  const pointsRaw = row.points.trim();
  const points = pointsRaw === '' ? 1 : Number(pointsRaw);
  if (!Number.isFinite(points) || points <= 0) throw new Error('points must be a positive number');

  const stemImageUrl = row.stemImageUrl.trim();
  let options = collectOptions(row);
  const answerKey: Record<string, unknown> = {};

  if (type === 'true_false' && options.length === 0) {
    const letters = parseCorrectLetters(row.correct);
    const correctLetter = letters[0] ?? 'A';
    options = [
      { label: 'A', body: 'True', isCorrect: correctLetter === 'A' },
      { label: 'B', body: 'False', isCorrect: correctLetter === 'B' },
    ];
    if (!options.some((o) => o.isCorrect)) {
      options[0]!.isCorrect = true;
    }
  }

  if (type === 'numeric') {
    const value = row.numericValue.trim();
    if (!value) throw new Error('numericValue is required for numeric questions');
    if (Number.isNaN(Number(value))) throw new Error('numericValue must be a number');
    answerKey.value = Number(value);
    const tol = row.numericTolerance.trim();
    if (tol !== '') {
      const n = Number(tol);
      if (Number.isNaN(n)) throw new Error('numericTolerance must be a number');
      answerKey.numericTolerance = n;
    }
    options = [];
  } else if (type === 'short_text' || type === 'long_text') {
    const ref = row.referenceAnswer.trim();
    if (ref) answerKey.value = ref;
    options = [];
  } else if (type === 'comprehension_mcq') {
    const passage = row.passageText.trim();
    if (!passage) throw new Error('passageText is required for comprehension_mcq');
    answerKey.passageText = passage;
  }

  if (stemImageUrl) answerKey.questionImageUrl = stemImageUrl;

  if (
    type === 'single_mcq' ||
    type === 'multiple_mcq' ||
    type === 'true_false' ||
    type === 'image_mcq' ||
    type === 'image_selection' ||
    type === 'comprehension_mcq'
  ) {
    answerKey.correctLabels = options.filter((o) => o.isCorrect).map((o) => o.label);
  }

  const candidate = {
    type,
    question,
    points,
    options,
    answerKey,
  };

  const parsed = createQuestionSchema.safeParse(candidate);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? 'Invalid question row');
  }
  return parsed.data;
}

function sampleDataRows(kind: BankKind = 'assessment'): Record<BankImportHeader, string>[] {
  const blank = (): Record<BankImportHeader, string> => {
    const o = {} as Record<BankImportHeader, string>;
    for (const h of BANK_IMPORT_HEADERS) o[h] = '';
    return o;
  };

  const rows: Record<BankImportHeader, string>[] = [];

  {
    const r = blank();
    if (kind !== 'quiz') r.type = 'single_mcq';
    r.question = 'Which planet is known as the Red Planet?';
    r.points = '1';
    r.optionA = 'Venus';
    r.optionB = 'Mars';
    r.optionC = 'Jupiter';
    r.optionD = 'Saturn';
    r.correct = 'B';
    rows.push(r);
  }
  {
    const r = blank();
    if (kind !== 'quiz') r.type = 'single_mcq';
    r.question = 'Which of the following is the Taj Mahal?';
    r.points = '1';
    r.optionA = '';
    r.optionB = '';
    r.optionC = '';
    r.optionA_imageUrl = 'https://example.com/taj-mahal.png';
    r.optionB_imageUrl = 'https://example.com/eiffel.png';
    r.optionC_imageUrl = 'https://example.com/colosseum.png';
    r.correct = 'A';
    rows.push(r);
  }
  {
    const r = blank();
    if (kind !== 'quiz') r.type = 'single_mcq';
    r.question = 'What landmark is shown?';
    r.points = '1';
    r.stemImageUrl = 'https://example.com/landmark.png';
    r.optionA = 'Taj Mahal';
    r.optionB = 'Eiffel Tower';
    r.optionC = 'Colosseum';
    r.correct = 'A';
    rows.push(r);
  }

  if (kind === 'quiz') return rows;

  {
    const r = blank();
    r.type = 'multiple_mcq';
    r.question = 'Select all prime numbers.';
    r.points = '2';
    r.optionA = '2';
    r.optionB = '3';
    r.optionC = '4';
    r.optionD = '5';
    r.correct = 'A,B,D';
    rows.push(r);
  }
  {
    const r = blank();
    r.type = 'true_false';
    r.question = 'The Pacific Ocean is the largest ocean on Earth.';
    r.points = '1';
    r.correct = 'A';
    rows.push(r);
  }
  {
    const r = blank();
    r.type = 'numeric';
    r.question = 'What is 7 × 8?';
    r.points = '1';
    r.numericValue = '56';
    r.numericTolerance = '0';
    rows.push(r);
  }
  {
    const r = blank();
    r.type = 'short_text';
    r.question = 'Name the capital of France.';
    r.points = '1';
    r.referenceAnswer = 'Paris';
    rows.push(r);
  }
  {
    const r = blank();
    r.type = 'long_text';
    r.question = 'Briefly explain photosynthesis.';
    r.points = '3';
    r.referenceAnswer = 'Plants convert light energy into chemical energy.';
    rows.push(r);
  }
  {
    const r = blank();
    r.type = 'image_mcq';
    r.question = 'Which color is shown in the stem image?';
    r.points = '1';
    r.stemImageUrl = 'https://example.com/stem.png';
    r.optionA = 'Red';
    r.optionB = 'Blue';
    r.optionC = 'Green';
    r.correct = 'B';
    rows.push(r);
  }
  {
    const r = blank();
    r.type = 'image_selection';
    r.question = 'Select all images that show a cat.';
    r.points = '2';
    r.optionA = 'Cat 1';
    r.optionB = 'Dog';
    r.optionC = 'Cat 2';
    r.optionA_imageUrl = 'https://example.com/cat1.png';
    r.optionB_imageUrl = 'https://example.com/dog.png';
    r.optionC_imageUrl = 'https://example.com/cat2.png';
    r.correct = 'A,C';
    rows.push(r);
  }
  {
    const r = blank();
    r.type = 'comprehension_mcq';
    r.question = 'According to the passage, what color is the fox?';
    r.points = '1';
    r.passageText = 'The quick brown fox jumps over the lazy dog.';
    r.optionA = 'Brown';
    r.optionB = 'Black';
    r.optionC = 'White';
    r.optionD = 'Grey';
    r.correct = 'A';
    rows.push(r);
  }

  return rows;
}

function fillSheetFromRows(
  sheet: ExcelJS.Worksheet,
  rows: Record<BankImportHeader, string>[],
  headers: readonly BankImportHeader[] = BANK_IMPORT_HEADERS,
) {
  sheet.addRow([...headers]);
  for (const row of rows) {
    sheet.addRow(headers.map((h) => sanitizeCsvCell(row[h] ?? '')));
  }
  sheet.getRow(1).font = { bold: true };
  sheet.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.min(28, Math.max(12, h.length + 2)),
  }));
}

export async function buildSampleWorkbook(kind: BankKind = 'assessment'): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const instructions = workbook.addWorksheet('Instructions');
  const headers = headersForKind(kind);
  instructions.addRow(['BrainPulses question bank import']);
  instructions.addRow([]);
  instructions.addRow(['1. Fill the Questions sheet. Do not rename column headers.']);
  if (kind === 'quiz') {
    instructions.addRow(['2. Quiz questions are always single choice — there is no type column.']);
    instructions.addRow([
      '3. Options may be text (optionA–F), image (option*_imageUrl), or both. Stem image via stemImageUrl.',
    ]);
    instructions.addRow(['4. Mark the single correct letter in correct (e.g. B).']);
  } else {
    instructions.addRow(['2. type must be one of the authorable types listed below.']);
    instructions.addRow([
      '3. For choice types, put option text in optionA–optionF and/or option*_imageUrl; mark correct with letters (e.g. B or A,C).',
    ]);
    instructions.addRow(['4. true_false may leave options blank (defaults to True/False as A/B).']);
    instructions.addRow(['5. numeric uses numericValue (+ optional numericTolerance).']);
    instructions.addRow(['6. short_text / long_text use optional referenceAnswer.']);
    instructions.addRow(['7. comprehension_mcq requires passageText.']);
    instructions.addRow(['8. image_selection requires option*_imageUrl for each filled option.']);
    instructions.addRow([
      '9. Optional stemImageUrl works on choice types; option images work on any choice type.',
    ]);
    instructions.addRow([]);
    instructions.addRow(['Authorable types:']);
    for (const t of authorableTypesForKind(kind)) {
      instructions.addRow([t]);
    }
  }
  instructions.getColumn(1).width = 100;

  const questions = workbook.addWorksheet('Questions');
  fillSheetFromRows(questions, sampleDataRows(kind), headers);

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function buildSampleCsv(kind: BankKind = 'assessment'): string {
  const rows = sampleDataRows(kind);
  const headers = headersForKind(kind);
  return stringify(
    rows.map((r) => headers.map((h) => sanitizeCsvCell(r[h] ?? ''))),
    { header: true, columns: [...headers] },
  );
}

export function questionToExportRow(q: ExportableQuestion): Record<BankImportHeader, string> {
  const row = {} as Record<BankImportHeader, string>;
  for (const h of BANK_IMPORT_HEADERS) row[h] = '';

  row.type = q.type;
  row.question = q.question;
  row.points = String(q.points);
  if (q.questionImageUrl) row.stemImageUrl = q.questionImageUrl;
  if (q.passageText) row.passageText = q.passageText;

  if (q.type === 'numeric') {
    if (q.referenceValue !== undefined && q.referenceValue !== null) {
      row.numericValue = String(q.referenceValue);
    }
    if (typeof q.numericTolerance === 'number') {
      row.numericTolerance = String(q.numericTolerance);
    }
    return row;
  }

  if (q.type === 'short_text' || q.type === 'long_text') {
    if (q.referenceValue !== undefined && q.referenceValue !== null && q.referenceValue !== '') {
      row.referenceAnswer = String(q.referenceValue);
    }
    return row;
  }

  const correct: string[] = [];
  for (const letter of OPTION_LETTERS) {
    const opt = q.options.find((o) => o.label.toUpperCase() === letter);
    if (!opt) continue;
    const bodyKey = `option${letter}` as BankImportHeader;
    const imageKey = `option${letter}_imageUrl` as BankImportHeader;
    row[bodyKey] = opt.body;
    if (opt.imageUrl) row[imageKey] = opt.imageUrl;
    if (opt.isCorrect || q.correctLabels?.includes(opt.label)) correct.push(letter);
  }
  row.correct = correct.join(',');
  return row;
}

export async function buildExportWorkbook(
  questions: ExportableQuestion[],
  kind: BankKind = 'assessment',
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Questions');
  const headers = headersForKind(kind);
  fillSheetFromRows(
    sheet,
    questions.map((q) => questionToExportRow(q)),
    headers,
  );
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function buildExportCsv(
  questions: ExportableQuestion[],
  kind: BankKind = 'assessment',
): string {
  const rows = questions.map((q) => questionToExportRow(q));
  const headers = headersForKind(kind);
  return stringify(
    rows.map((r) => headers.map((h) => sanitizeCsvCell(r[h] ?? ''))),
    { header: true, columns: [...headers] },
  );
}

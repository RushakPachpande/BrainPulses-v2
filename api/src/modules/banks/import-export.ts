import { randomBytes } from 'node:crypto';
import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';
import type { z } from 'zod';
import { sanitizeCsvCell } from '../../lib/csv.js';
import {
  MAX_IMPORT_ROWS,
  parseXlsxWorkbook,
  readImportedText,
  type SpreadsheetColumnSpec,
} from '../../lib/spreadsheet-import.js';
import {
  authorableTypesForKind,
  createQuestionSchema,
  type BankKind,
  type QuestionTypeValue,
} from './schema.js';

export { MAX_IMPORT_ROWS, readImportedText };

const MAX_POINTS = 100_000_000;

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

/** Quiz sheets use the same columns. `type` may be blank; see `rowToCreatePayload`. */
export const QUIZ_BANK_IMPORT_HEADERS = BANK_IMPORT_HEADERS;

export function headersForKind(_kind: BankKind = 'assessment'): readonly BankImportHeader[] {
  return BANK_IMPORT_HEADERS;
}

export const BANK_IMPORT_COLUMNS: SpreadsheetColumnSpec<BankImportHeader>[] = [
  { key: 'type' },
  { key: 'question', aliases: ['stem', 'text', 'questiontext', 'prompt', 'Question Text'] },
  { key: 'points', aliases: ['point', 'marks'] },
  { key: 'optionA', aliases: ['a', 'Option A'] },
  { key: 'optionB', aliases: ['b', 'Option B'] },
  { key: 'optionC', aliases: ['c', 'Option C'] },
  { key: 'optionD', aliases: ['d', 'Option D'] },
  { key: 'optionE', aliases: ['e', 'Option E'] },
  { key: 'optionF', aliases: ['f', 'Option F'] },
  {
    key: 'correct',
    aliases: ['answer', 'correctanswer', 'rightanswer', 'answers', 'answerkey', 'Correct Answer'],
  },
  { key: 'numericValue', aliases: ['value'] },
  { key: 'numericTolerance', aliases: ['tolerance'] },
  { key: 'referenceAnswer', aliases: ['reference'] },
  { key: 'stemImageUrl', aliases: ['questionimageurl'] },
  { key: 'optionA_imageUrl' },
  { key: 'optionB_imageUrl' },
  { key: 'optionC_imageUrl' },
  { key: 'optionD_imageUrl' },
  { key: 'optionE_imageUrl' },
  { key: 'optionF_imageUrl' },
  { key: 'passageText', aliases: ['passage', 'passagebody'] },
];

/** Codes are unique per imported row and stay within the 40-character column. */
export function newImportQuestionCode(sheetRow: number, sequence: number): string {
  const row = Math.max(0, Math.trunc(sheetRow)).toString(36);
  const seq = Math.max(0, Math.trunc(sequence)).toString(36);
  return `Q-${Date.now().toString(36)}-${row}-${seq}-${randomBytes(2).toString('hex')}`;
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

/** Empty keyed row for tests and helpers. */
export function emptyBankImportRow(sheetRow = 2): BankImportRow {
  const row = { sheetRow } as BankImportRow;
  for (const h of BANK_IMPORT_HEADERS) row[h] = '';
  return row;
}

export async function parseBankQuestionsFile(
  buffer: Buffer,
  filename: string,
  _mimetype?: string,
): Promise<BankImportRow[]> {
  const parsed = await parseXlsxWorkbook(buffer, filename, {
    columns: BANK_IMPORT_COLUMNS,
    preferredSheetName: 'Questions',
    emptyNoun: 'questions',
  });
  return parsed.rows
    .filter((row) => row.question.trim() || row.type.trim())
    .map((row) => row as BankImportRow);
}

type ChoiceOption = {
  label: string;
  body: string;
  isCorrect: boolean;
  imageUrl?: string | null;
};

/** Labels as written in the authoring UI, plus the stored type values. */
const TYPE_ALIASES: Record<string, QuestionTypeValue> = {
  singlemcq: 'single_mcq',
  singlechoice: 'single_mcq',
  single: 'single_mcq',
  mcq: 'single_mcq',
  scq: 'single_mcq',
  mcqsingleoption: 'single_mcq',
  multiplemcq: 'multiple_mcq',
  multiplechoice: 'multiple_mcq',
  multiple: 'multiple_mcq',
  msq: 'multiple_mcq',
  multiselect: 'multiple_mcq',
  msqmultipleoptions: 'multiple_mcq',
  truefalse: 'true_false',
  tf: 'true_false',
  boolean: 'true_false',
  numeric: 'numeric',
  numerical: 'numeric',
  number: 'numeric',
  shorttext: 'short_text',
  shortanswer: 'short_text',
  longtext: 'long_text',
  longanswer: 'long_text',
  essay: 'long_text',
  imagemcq: 'image_mcq',
  imagemultiplechoice: 'image_mcq',
  imageselection: 'image_selection',
  comprehensionmcq: 'comprehension_mcq',
  comprehension: 'comprehension_mcq',
  readingcomprehension: 'comprehension_mcq',
};

function resolveExplicitType(raw: string, kind: BankKind): QuestionTypeValue {
  const token = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  const mapped = TYPE_ALIASES[token];
  if (!mapped) {
    throw new Error(
      `Unknown type “${raw.trim()}”. Use one of: ${[...authorableTypesForKind(kind)].join(', ')}`,
    );
  }
  if (!authorableTypesForKind(kind).has(mapped)) {
    // Quiz edit already saves legacy image_mcq as single_mcq. Import does the same.
    if (kind === 'quiz' && mapped === 'image_mcq') return 'single_mcq';
    if (kind === 'quiz') {
      throw new Error(
        `Quiz banks only support single-choice or multiple-choice questions. Got “${raw.trim()}”.`,
      );
    }
    throw new Error(`Type “${raw.trim()}” is not allowed for assessment banks.`);
  }
  return mapped;
}

function splitAnswerTokens(raw: string): string[] {
  const tokens: string[] = [];
  for (const chunk of raw.split(/[,+;|]+/)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const andParts = trimmed.split(/\s+and\s+/i);
    if (
      andParts.length > 1 &&
      andParts.every((part) => /^[A-F]$/i.test(part.trim()) || /^[1-6]$/.test(part.trim()))
    ) {
      tokens.push(...andParts.map((part) => part.trim()));
      continue;
    }
    if (/^[A-F](?:\s+[A-F])+$/i.test(trimmed)) {
      tokens.push(...trimmed.split(/\s+/));
      continue;
    }
    tokens.push(trimmed);
  }
  return tokens;
}

function trueFalseLetter(token: string): 'A' | 'B' | null {
  const compact = token
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  if (compact === 'a' || compact === 't' || compact === 'true' || compact === 'yes') return 'A';
  if (compact === 'b' || compact === 'f' || compact === 'false' || compact === 'no') return 'B';
  return null;
}

function letterFromToken(token: string): string | null {
  const compact = token.replace(/\s+/g, '');
  const option = compact.match(/^(?:option)?([A-F])$/i);
  if (option?.[1]) return option[1].toUpperCase();
  if (/^[1-6]$/.test(compact)) return OPTION_LETTERS[Number(compact) - 1] ?? null;
  return null;
}

function expandLetterRun(token: string): string[] | null {
  const compact = token.replace(/\s+/g, '');
  if (!/^[A-F]{2,6}$/i.test(compact)) return null;
  const letters = compact.toUpperCase().split('');
  if (new Set(letters).size !== letters.length) return null;
  return letters;
}

function labelsForCorrect(raw: string, options: { label: string; body: string }[], type: string) {
  const labels: string[] = [];
  const add = (label: string) => {
    if (!labels.includes(label)) labels.push(label);
  };
  for (const token of splitAnswerTokens(raw)) {
    const body = options.find(
      (option) => option.body.trim().toLowerCase() === token.trim().toLowerCase(),
    );
    if (body) {
      add(body.label);
      continue;
    }
    if (type === 'true_false') {
      const letter = trueFalseLetter(token);
      if (letter) add(letter);
      continue;
    }
    const run = expandLetterRun(token);
    if (run) {
      for (const letter of run) add(letter);
      continue;
    }
    const letter = letterFromToken(token);
    if (letter) add(letter);
  }
  return labels;
}

function collectOptions(row: BankImportRow): ChoiceOption[] {
  const options: ChoiceOption[] = [];
  for (const letter of OPTION_LETTERS) {
    const bodyKey = `option${letter}` as BankImportHeader;
    const imageKey = `option${letter}_imageUrl` as BankImportHeader;
    const body = readImportedText(row[bodyKey] ?? '');
    const imageUrl = readImportedText(row[imageKey] ?? '');
    if (!body && !imageUrl) continue;
    options.push({
      label: letter,
      body,
      isCorrect: false,
      ...(imageUrl ? { imageUrl } : {}),
    });
  }
  return options;
}

function applyCorrect(options: ChoiceOption[], labels: string[]) {
  const selected = new Set(labels);
  for (const option of options) option.isCorrect = selected.has(option.label);
}

const CHOICE_TYPES = new Set<QuestionTypeValue>([
  'single_mcq',
  'multiple_mcq',
  'true_false',
  'image_mcq',
  'image_selection',
  'comprehension_mcq',
]);

/**
 * Map a sheet row to a createQuestion payload. Throws Error with a user-facing message on failure.
 */
export function rowToCreatePayload(
  row: BankImportRow,
  kind: BankKind = 'assessment',
): BankCreatePayload {
  const typeRaw = row.type.trim();
  let type: QuestionTypeValue | null = typeRaw ? resolveExplicitType(typeRaw, kind) : null;
  if (!type && kind !== 'quiz') throw new Error('type is required');

  const question = readImportedText(row.question);
  if (!question) throw new Error('question is required');

  const pointsRaw = row.points.trim();
  const points = pointsRaw === '' ? 1 : Number(pointsRaw);
  if (!Number.isFinite(points) || points <= 0) throw new Error('points must be a positive number');
  if (points >= MAX_POINTS) throw new Error('points must be less than 100000000');

  const stemImageUrl = readImportedText(row.stemImageUrl);
  let options = collectOptions(row);
  const answerKey: Record<string, unknown> = {};

  if (type === 'numeric') {
    const value = readImportedText(row.numericValue);
    if (!value) throw new Error('numericValue is required for numeric questions');
    if (Number.isNaN(Number(value))) throw new Error('numericValue must be a number');
    answerKey.value = Number(value);
    const tol = readImportedText(row.numericTolerance);
    if (tol !== '') {
      const n = Number(tol);
      if (Number.isNaN(n)) throw new Error('numericTolerance must be a number');
      answerKey.numericTolerance = n;
    }
    options = [];
  } else if (type === 'short_text' || type === 'long_text') {
    const ref = readImportedText(row.referenceAnswer);
    if (ref) answerKey.value = ref;
    options = [];
  } else {
    if (type === 'true_false' && options.length === 0) {
      const labels = labelsForCorrect(
        row.correct,
        [
          { label: 'A', body: 'True' },
          { label: 'B', body: 'False' },
        ],
        'true_false',
      );
      if (labels.length !== 1) {
        throw new Error('Mark True or False (A or B) in the correct column.');
      }
      options = [
        { label: 'A', body: 'True', isCorrect: labels[0] === 'A' },
        { label: 'B', body: 'False', isCorrect: labels[0] === 'B' },
      ];
    } else {
      const labels = labelsForCorrect(row.correct, options, type ?? 'single_mcq');
      if (!type) type = labels.length >= 2 ? 'multiple_mcq' : 'single_mcq';
      applyCorrect(options, labels);
    }
    if (type === 'comprehension_mcq') {
      const passage = readImportedText(row.passageText);
      if (!passage) throw new Error('passageText is required for comprehension_mcq');
      answerKey.passageText = passage;
    }
  }

  if (stemImageUrl) answerKey.questionImageUrl = stemImageUrl;

  if (type && CHOICE_TYPES.has(type)) {
    answerKey.correctLabels = options
      .filter((option) => option.isCorrect)
      .map((option) => option.label);
  }

  const candidate = {
    type: type ?? 'single_mcq',
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
    r.type = 'single_mcq';
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
    r.type = 'single_mcq';
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
    r.type = 'single_mcq';
    r.question = 'What landmark is shown?';
    r.points = '1';
    r.stemImageUrl = 'https://example.com/landmark.png';
    r.optionA = 'Taj Mahal';
    r.optionB = 'Eiffel Tower';
    r.optionC = 'Colosseum';
    r.correct = 'A';
    rows.push(r);
  }

  if (kind === 'quiz') {
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
    return rows;
  }

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
  {
    const r = blank();
    r.type = 'comprehension_mcq';
    r.question = 'According to the passage, what does the fox jump over?';
    r.points = '1';
    r.passageText = 'The quick brown fox jumps over the lazy dog.';
    r.optionA = 'A dog';
    r.optionB = 'A cat';
    r.optionC = 'A log';
    r.optionD = 'A wall';
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
  headers.forEach((header, index) => {
    sheet.getColumn(index + 1).width = Math.min(36, Math.max(12, header.length + 2));
  });
}

export async function buildSampleWorkbook(kind: BankKind = 'assessment'): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const instructions = workbook.addWorksheet('Instructions');
  const headers = headersForKind(kind);
  instructions.addRow(['BrainPulses question bank import']);
  instructions.addRow([]);
  instructions.addRow(['1. Fill the Questions sheet. Do not rename the column headers.']);
  instructions.addRow([
    '2. Delete the example rows before you import, or those example questions will be created.',
  ]);
  instructions.addRow([
    '3. Import adds questions. It does not update or replace questions already in the bank.',
  ]);
  instructions.addRow([
    '4. Save as Excel (.xlsx) only. CSV and legacy .xls are not supported. Up to 1000 rows, 10 MB.',
  ]);
  instructions.addRow([
    '5. Keep every column header from the Questions sheet (order may change). Missing or misspelled headers block the import.',
  ]);
  if (kind === 'quiz') {
    instructions.addRow([
      '6. type is single_mcq (one correct option) or multiple_mcq (one or more). You can also write MCQ or MSQ.',
    ]);
    instructions.addRow([
      '7. If type is blank, one correct answer becomes single_mcq and two or more become multiple_mcq.',
    ]);
  } else {
    instructions.addRow([
      '6. type is required. Use a value below, or the label from the question form (for example Single choice or True / False).',
    ]);
    instructions.addRow([
      '7. true_false may leave options blank (True is A, False is B). Mark the correct one; a blank correct cell is rejected.',
    ]);
    instructions.addRow([
      '8. numeric uses numericValue and optional numericTolerance. Negative numbers are allowed.',
    ]);
    instructions.addRow(['9. short_text and long_text use optional referenceAnswer.']);
    instructions.addRow([
      '10. comprehension_mcq requires passageText on every row. Rows with the same passage text share one passage. image_selection requires an image URL on every filled option.',
    ]);
  }
  instructions.addRow([
    'Mark correct with letters (B or A,C), the option text (Mars), or True/False. optionA–F can be text, an image URL, or both.',
  ]);
  instructions.addRow([
    'stemImageUrl is the question image. Use a library path such as /api/files/<id> or an https URL.',
  ]);
  if (kind !== 'quiz') {
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

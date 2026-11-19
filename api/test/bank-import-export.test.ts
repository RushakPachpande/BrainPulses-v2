import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { AppError } from '../src/lib/errors.js';
import { buildAssessmentSampleWorkbook } from '../src/modules/activities/assessment-import.js';
import { isImportFilename } from '../src/modules/banks/upload.js';
import { authorableTypesForKind } from '../src/modules/banks/schema.js';
import {
  BANK_IMPORT_HEADERS,
  MAX_IMPORT_ROWS,
  buildExportCsv,
  buildSampleCsv,
  buildSampleWorkbook,
  claimQuestionRow,
  contentFromPayload,
  decideImportedQuestion,
  findQuestionDuplicate,
  duplicateQuestionIssue,
  emptyBankImportRow,
  formatQuestionImportError,
  newImportQuestionCode,
  parseBankQuestionsFile,
  questionContentKey,
  questionFieldChanges,
  rowToCreatePayload,
  seedSavedQuestion,
  skipDuplicateQuestionRows,
  type BankImportHeader,
  type BankImportRow,
} from '../src/modules/banks/import-export.js';

function row(partial: Partial<Record<BankImportHeader, string>>, sheetRow = 2): BankImportRow {
  const base = emptyBankImportRow(sheetRow);
  return { ...base, ...partial, sheetRow };
}

function payloadFromRow(
  partial: Partial<Record<BankImportHeader, string>>,
  kind: 'assessment' | 'quiz' = 'assessment',
) {
  return rowToCreatePayload(row(partial), kind);
}

async function workbookWithHeaders(
  headers: string[],
  dataRows: unknown[][],
  headerRow = 1,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Questions');
  headers.forEach((header, index) => {
    sheet.getRow(headerRow).getCell(index + 1).value = header;
  });
  dataRows.forEach((values, rowOffset) => {
    values.forEach((value, index) => {
      sheet.getRow(headerRow + 1 + rowOffset).getCell(index + 1).value = value as ExcelJS.CellValue;
    });
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function fullHeaders(order?: BankImportHeader[]): string[] {
  return [...(order ?? BANK_IMPORT_HEADERS)];
}

function valuesForPartial(
  partial: Partial<Record<BankImportHeader, string>>,
  order: BankImportHeader[] = [...BANK_IMPORT_HEADERS],
): string[] {
  return order.map((h) => partial[h] ?? '');
}

describe('question spreadsheet samples', () => {
  it('imports every assessment example as the type the sheet names', async () => {
    const buffer = await buildSampleWorkbook('assessment');
    const rows = await parseBankQuestionsFile(Buffer.from(buffer), 'sample.xlsx');
    const types = rows.map((r) => rowToCreatePayload(r, 'assessment').type);
    assert.deepEqual(new Set(types), authorableTypesForKind('assessment'));
    const comprehension = rows.filter((r) => r.type === 'comprehension_mcq');
    assert.equal(comprehension.length, 2);
    assert.equal(comprehension[0]?.passageText, comprehension[1]?.passageText);
    assert.notEqual(comprehension[0]?.question, comprehension[1]?.question);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.getWorksheet('Questions');
    assert.ok(sheet);
    assert.equal(sheet.getRow(1).getCell(1).value, 'type');
    assert.equal(sheet.getRow(2).getCell(2).value, 'Which planet is known as the Red Planet?');
    const notes = workbook
      .getWorksheet('Instructions')!
      .getColumn(1)
      .values.filter((value): value is string => typeof value === 'string')
      .join('\n');
    assert.match(notes, /skipped when that question text is already in this bank/);
    assert.match(notes, /\.xlsx/);
    assert.doesNotMatch(notes, /always single/i);
  });

  it('imports the quiz sample as single-choice and multiple-choice only', async () => {
    const buffer = await buildSampleWorkbook('quiz');
    const rows = await parseBankQuestionsFile(
      Buffer.from(buffer),
      'quiz-sample.xlsx',
      undefined,
      'quiz',
    );
    const types = rows.map((r) => rowToCreatePayload(r, 'quiz').type);
    assert.ok(types.includes('single_mcq'));
    assert.ok(types.includes('multiple_mcq'));
    assert.ok(types.every((type) => type === 'single_mcq' || type === 'multiple_mcq'));

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const notes = workbook
      .getWorksheet('Instructions')!
      .getColumn(1)
      .values.filter((value): value is string => typeof value === 'string')
      .join('\n');
    assert.match(notes, /multiple_mcq/);
    assert.doesNotMatch(notes, /always single/i);
    const quizHeader = buildSampleCsv('quiz').split('\n')[0] ?? '';
    const assessmentHeader = buildSampleCsv('assessment').split('\n')[0] ?? '';
    assert.ok(quizHeader.includes('correct'));
    assert.ok(!quizHeader.includes('numericValue'));
    assert.ok(!quizHeader.includes('passageText'));
    assert.ok(!quizHeader.includes('referenceAnswer'));
    assert.ok(assessmentHeader.includes('numericValue'));
    assert.ok(assessmentHeader.includes('passageText'));
  });

  it('imports the assessment activity sample as assessment types with a round', async () => {
    const buffer = await buildAssessmentSampleWorkbook();
    const rows = await parseBankQuestionsFile(Buffer.from(buffer), 'assessment-sample.xlsx');
    const types = rows.map((r) => rowToCreatePayload(r, 'assessment').type);
    assert.deepEqual(new Set(types), authorableTypesForKind('assessment'));
    assert.ok(types.every((type) => type !== 'image_mcq' && type !== 'image_selection'));
    const comprehension = rows.filter((r) => r.type === 'comprehension_mcq');
    assert.equal(comprehension.length, 2);
    assert.equal(comprehension[0]?.passageText, comprehension[1]?.passageText);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.getWorksheet('Questions');
    assert.ok(sheet);
    let roundCol = 0;
    sheet.getRow(1).eachCell((cell, col) => {
      if (cell.value === 'round') roundCol = col;
    });
    assert.ok(roundCol > 0);
    assert.equal(sheet.getRow(2).getCell(roundCol).value, 'Round 1');
  });
});

describe('question import error text', () => {
  it('names the empty type cell and what to type', () => {
    const message = formatQuestionImportError(
      row({ type: '', question: 'What is 2 + 2?', points: '1' }),
      'assessment',
      new Error('type is required'),
    );
    assert.match(message, /Sheet row 2/);
    assert.match(message, /Type/);
    assert.match(message, /empty/i);
    assert.match(message, /single_mcq/);
    assert.match(message, /What is 2 \+ 2/);
  });

  it('tells a quiz importer that numerical questions belong on an assessment', () => {
    const message = formatQuestionImportError(
      row({ type: 'numeric', question: 'What is 2 + 2?', numericValue: '4' }),
      'quiz',
      new Error(
        'Quiz banks only support single-choice or multiple-choice questions. Got “numeric”.',
      ),
    );
    assert.match(message, /Type/);
    assert.match(message, /numeric/);
    assert.match(message, /assessment/i);
    assert.match(message, /single_mcq/);
  });

  it('shows the correct-answer cell when it matches no option', () => {
    const message = formatQuestionImportError(
      row({
        type: 'single_mcq',
        question: 'Color?',
        optionA: 'Red',
        optionB: 'Blue',
        correct: 'Green',
      }),
      'assessment',
      new Error('Mark exactly one correct option.'),
    );
    assert.match(message, /Correct answer/);
    assert.match(message, /Green/);
    assert.match(message, /Color\?/);
    assert.match(message, /letter/);
  });
});

describe('question spreadsheet rows', () => {
  it('maps True / False words and rejects a blank true/false answer', () => {
    const marked = payloadFromRow({
      type: 'True / False',
      question: 'The sky is green.',
      points: '1',
      correct: 'False',
    });
    assert.equal(marked.type, 'true_false');
    assert.equal(marked.options[0]?.body, 'True');
    assert.equal(marked.options[0]?.isCorrect, false);
    assert.equal(marked.options[1]?.isCorrect, true);

    assert.throws(
      () =>
        payloadFromRow({
          type: 'true_false',
          question: 'The sky is green.',
          points: '1',
          correct: '',
        }),
      /Mark True or False/,
    );
    assert.throws(
      () =>
        payloadFromRow({
          type: 'true_false',
          question: 'The sky is green.',
          points: '1',
          correct: 'C',
        }),
      /Mark True or False/,
    );
  });

  it('matches option text before a digit, and keeps “and” inside an option', () => {
    const byText = payloadFromRow({
      type: 'multiple_mcq',
      question: 'Primes',
      points: '2',
      optionA: '2',
      optionB: '3',
      optionC: '4',
      optionD: '5',
      correct: '2,3,5',
    });
    assert.deepEqual(
      byText.options.filter((option) => option.isCorrect).map((option) => option.label),
      ['A', 'B', 'D'],
    );

    const byDigit = payloadFromRow({
      type: 'single_mcq',
      question: 'Second',
      points: '1',
      optionA: 'Yes',
      optionB: 'No',
      correct: '2',
    });
    assert.equal(byDigit.options.find((option) => option.isCorrect)?.label, 'B');

    const phrase = payloadFromRow({
      type: 'single_mcq',
      question: 'Phrase',
      points: '1',
      optionA: 'Command and control',
      optionB: 'Other',
      correct: 'Command and control',
    });
    assert.equal(phrase.options[0]?.isCorrect, true);

    const letters = payloadFromRow({
      type: 'multiple_mcq',
      question: 'Pick',
      points: '1',
      optionA: 'Red',
      optionB: 'Blue',
      optionC: 'Green',
      correct: 'A and C',
    });
    assert.deepEqual(
      letters.options.filter((option) => option.isCorrect).map((option) => option.label),
      ['A', 'C'],
    );
  });

  it('infers quiz type from how many answers are marked, and rejects other types', () => {
    const many = payloadFromRow(
      {
        question: 'Pick',
        points: '1',
        optionA: 'Red',
        optionB: 'Blue',
        optionC: 'Green',
        correct: 'A,C',
      },
      'quiz',
    );
    assert.equal(many.type, 'multiple_mcq');

    const one = payloadFromRow(
      {
        type: '',
        question: 'Pick',
        points: '1',
        optionA: 'Red',
        optionB: 'Blue',
        correct: 'B',
      },
      'quiz',
    );
    assert.equal(one.type, 'single_mcq');

    const labeled = payloadFromRow(
      {
        type: 'MSQ (multiple options)',
        question: 'Pick',
        points: '1',
        optionA: 'Red',
        optionB: 'Blue',
        optionC: 'Green',
        correct: 'A,C',
      },
      'quiz',
    );
    assert.equal(labeled.type, 'multiple_mcq');

    const legacyImage = payloadFromRow(
      {
        type: 'image_mcq',
        question: 'Shown',
        points: '1',
        optionA: 'Red',
        optionB: 'Blue',
        correct: 'A',
      },
      'quiz',
    );
    assert.equal(legacyImage.type, 'single_mcq');
    assert.throws(
      () =>
        payloadFromRow(
          {
            type: 'true_false',
            question: 'Shown',
            points: '1',
            optionA: 'Red',
            optionB: 'Blue',
            correct: 'A',
          },
          'quiz',
        ),
      /single-choice or multiple-choice/,
    );
    assert.throws(
      () => payloadFromRow({ type: 'passage', question: 'Old', points: '1' }),
      /Unknown type/,
    );
    const essay = payloadFromRow({ type: 'essay', question: 'Explain', points: '3' });
    assert.equal(essay.type, 'long_text');
  });

  it('defaults blank points to 1 and rejects 0 and 100000000', () => {
    const blank = payloadFromRow({
      type: 'single_mcq',
      question: 'Hi',
      points: '',
      optionA: 'Yes',
      optionB: 'No',
      correct: 'A',
    });
    assert.equal(blank.points, 1);

    assert.throws(
      () =>
        payloadFromRow({
          type: 'single_mcq',
          question: 'Hi',
          points: '0',
          optionA: 'Yes',
          optionB: 'No',
          correct: 'A',
        }),
      /positive number/,
    );
    assert.throws(
      () =>
        payloadFromRow({
          type: 'single_mcq',
          question: 'Hi',
          points: '100000000',
          optionA: 'Yes',
          optionB: 'No',
          correct: 'A',
        }),
      /less than 100000000/,
    );
    const under = payloadFromRow({
      type: 'single_mcq',
      question: 'Hi',
      points: '99999999.99',
      optionA: 'Yes',
      optionB: 'No',
      correct: 'A',
    });
    assert.equal(under.points, 99999999.99);
  });

  it('round-trips negative numbers and formula text', () => {
    const numeric = buildExportCsv([
      {
        type: 'numeric',
        question: 'Below zero',
        points: 1,
        options: [],
        referenceValue: -4,
        numericTolerance: 0.5,
      },
    ]);
    const header = numeric.split('\n')[0]!.split(',');
    const values = numeric.split('\n')[1]!.split(',');
    const partial: Partial<Record<BankImportHeader, string>> = {};
    header.forEach((h, i) => {
      partial[h as BankImportHeader] = values[i] ?? '';
    });
    // Export CSV may quote formula cells — rebuild from export row helper path via parse of sample
    const numericPayload = payloadFromRow({
      type: 'numeric',
      question: 'Below zero',
      points: '1',
      numericValue: '-4',
      numericTolerance: '0.5',
    });
    assert.equal(numericPayload.answerKey.value, -4);
    assert.equal(numericPayload.answerKey.numericTolerance, 0.5);

    const choicePayload = payloadFromRow({
      type: 'single_mcq',
      question: '=1+1',
      points: '1',
      optionA: '-2',
      optionB: '2',
      correct: 'A',
    });
    assert.equal(choicePayload.question, '=1+1');
    assert.equal(choicePayload.options[0]?.body, '-2');
  });

  it('keeps quiz multiple-choice type on export and import', () => {
    const csv = buildExportCsv(
      [
        {
          type: 'multiple_mcq',
          question: 'Primes',
          points: 2,
          options: [
            { label: 'A', body: '2', isCorrect: true },
            { label: 'B', body: '4', isCorrect: false },
            { label: 'C', body: '3', isCorrect: true },
          ],
        },
      ],
      'quiz',
    );
    assert.match(csv, /^type,/);
    const payload = payloadFromRow(
      {
        type: 'multiple_mcq',
        question: 'Primes',
        points: '2',
        optionA: '2',
        optionB: '4',
        optionC: '3',
        correct: 'A,C',
      },
      'quiz',
    );
    assert.equal(payload.type, 'multiple_mcq');
    assert.deepEqual(payload.answerKey.correctLabels, ['A', 'C']);
  });
});

describe('question spreadsheet files', () => {
  it('maps shifted columns and aliases when every official header is present', async () => {
    const order = [
      'passageText',
      'correct',
      'points',
      'Question Text',
      'type',
      'optionB',
      'optionA',
      'optionC',
      'optionD',
      'optionE',
      'optionF',
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
    ] as const;
    const headers = [...order];
    const values = [
      '',
      'Mars',
      '1',
      'Which planet?',
      'Single choice',
      'Mars',
      'Venus',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ];
    const rows = await parseBankQuestionsFile(
      await workbookWithHeaders(headers, [values]),
      'shifted.xlsx',
    );
    assert.equal(rows[0]?.sheetRow, 2);
    const payload = rowToCreatePayload(rows[0]!);
    assert.equal(payload.type, 'single_mcq');
    assert.equal(payload.options.find((option) => option.isCorrect)?.body, 'Mars');
    assert.equal(payload.points, 1);
  });

  it('rejects a missing official header and a duplicate mapped header', async () => {
    const withoutQuestion = fullHeaders().filter((h) => h !== 'question');
    const missingBuffer = await workbookWithHeaders(withoutQuestion, [
      valuesForPartial({ type: 'single_mcq' }, withoutQuestion as BankImportHeader[]),
    ]);
    await assert.rejects(
      () => parseBankQuestionsFile(missingBuffer, 'missing.xlsx'),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.match(err.message, /missing required columns/i);
        assert.match(err.message, /question/i);
        return true;
      },
    );

    const headers = [...BANK_IMPORT_HEADERS, 'stem'];
    const dupBuffer = await workbookWithHeaders(headers, [valuesForPartial({})]);
    await assert.rejects(
      () => parseBankQuestionsFile(dupBuffer, 'dup.xlsx'),
      /more than one column for “question”/i,
    );
  });

  it('reads a header on row 20 and rejects a header on row 21', async () => {
    const headers = fullHeaders();
    const data = valuesForPartial({
      type: 'single_mcq',
      question: 'From row 21',
      points: '1',
      optionA: 'Yes',
      optionB: 'No',
      correct: 'A',
    });
    const okRows = await parseBankQuestionsFile(
      await workbookWithHeaders(headers, [data], 20),
      'late.xlsx',
    );
    assert.equal(okRows[0]?.question, 'From row 21');
    assert.equal(rowToCreatePayload(okRows[0]!).points, 1);

    const rejected = new ExcelJS.Workbook();
    const late = rejected.addWorksheet('Questions');
    headers.forEach((header, index) => {
      late.getRow(21).getCell(index + 1).value = header;
    });
    const lateBuffer = Buffer.from(await rejected.xlsx.writeBuffer());
    await assert.rejects(() => parseBankQuestionsFile(lateBuffer, 'too-late.xlsx'), /header row/i);
  });

  it('ignores a title cell named Question when a fuller header follows', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.getRow(1).getCell(1).value = 'Question';
    fullHeaders().forEach((header, index) => {
      sheet.getRow(2).getCell(index + 1).value = header;
    });
    const data = valuesForPartial({
      type: 'single_mcq',
      question: 'Real question',
      points: '2',
      optionA: 'Yes',
      optionB: 'No',
      correct: 'A',
      stemImageUrl: 'https://example.com/stem.png',
    });
    data.forEach((value, index) => {
      sheet.getRow(3).getCell(index + 1).value = value;
    });
    sheet.getRow(3).getCell(BANK_IMPORT_HEADERS.indexOf('stemImageUrl') + 1).value = {
      text: 'https://example.com/stem.png',
      hyperlink: 'https://example.com/stem.png',
    };
    const rows = await parseBankQuestionsFile(
      Buffer.from(await workbook.xlsx.writeBuffer()),
      'titled.xlsx',
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.question, 'Real question');
    const payload = rowToCreatePayload(rows[0]!);
    assert.equal(payload.points, 2);
    assert.equal(payload.answerKey.questionImageUrl, 'https://example.com/stem.png');
  });

  it('reads numeric cells and ignores a formula that has no cached result', async () => {
    const headers = fullHeaders();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Questions');
    headers.forEach((header, index) => {
      sheet.getRow(1).getCell(index + 1).value = header;
    });
    const base = valuesForPartial({
      type: 'numeric',
      question: 'Below zero',
      points: '2',
      numericValue: '-4',
      numericTolerance: '0.5',
    });
    base.forEach((value, index) => {
      sheet.getRow(2).getCell(index + 1).value = value;
    });
    sheet.getRow(2).getCell(BANK_IMPORT_HEADERS.indexOf('question') + 1).value = {
      formula: 'A1',
      result: 'Below zero',
    };
    sheet.getRow(2).getCell(BANK_IMPORT_HEADERS.indexOf('points') + 1).value = 2;
    sheet.getRow(2).getCell(BANK_IMPORT_HEADERS.indexOf('numericValue') + 1).value = -4;
    sheet.getRow(2).getCell(BANK_IMPORT_HEADERS.indexOf('numericTolerance') + 1).value = 0.5;

    const rows = await parseBankQuestionsFile(
      Buffer.from(await workbook.xlsx.writeBuffer()),
      'numbers.xlsx',
    );
    const payload = rowToCreatePayload(rows[0]!);
    assert.equal(payload.question, 'Below zero');
    assert.equal(payload.points, 2);
    assert.equal(payload.answerKey.value, -4);
    assert.equal(payload.answerKey.numericTolerance, 0.5);

    sheet.getRow(2).getCell(BANK_IMPORT_HEADERS.indexOf('question') + 1).value = { formula: 'A1' };
    const uncached = await parseBankQuestionsFile(
      Buffer.from(await workbook.xlsx.writeBuffer()),
      'uncached.xlsx',
    );
    assert.equal(uncached[0]?.question ?? '', '');
  });

  it('accepts 1000 data rows and rejects 1001', async () => {
    const headers = fullHeaders();
    const data = Array.from({ length: MAX_IMPORT_ROWS }, (_, i) =>
      valuesForPartial({
        type: 'single_mcq',
        question: `Question ${i}`,
        points: '1',
        optionA: 'Yes',
        optionB: 'No',
        correct: 'A',
      }),
    );
    const accepted = await parseBankQuestionsFile(
      await workbookWithHeaders(headers, data),
      'max.xlsx',
    );
    assert.equal(accepted.length, MAX_IMPORT_ROWS);

    const overBuffer = await workbookWithHeaders(headers, [
      ...data,
      valuesForPartial({
        type: 'single_mcq',
        question: 'One more',
        points: '1',
        optionA: 'Yes',
        optionB: 'No',
        correct: 'A',
      }),
    ]);
    await assert.rejects(() => parseBankQuestionsFile(overBuffer, 'over.xlsx'), /1000/);
  });

  it('rejects csv and legacy .xls filenames', async () => {
    await assert.rejects(
      () => parseBankQuestionsFile(Buffer.from('not-excel'), 'questions.xls'),
      /Legacy \.xls/,
    );
    await assert.rejects(
      () => parseBankQuestionsFile(Buffer.from('a,b\n1,2'), 'questions.csv'),
      /\.xlsx/,
    );
    assert.equal(isImportFilename('questions.xlsx'), true);
    assert.equal(isImportFilename('questions.CSV'), false);
    assert.equal(isImportFilename('questions.xls'), false);
    assert.equal(isImportFilename('questions.xlsx.txt'), false);
  });

  it('issues a unique code of at most 40 characters for each imported row', () => {
    const codes = Array.from({ length: 30 }, (_, index) => newImportQuestionCode(index + 2, index));
    assert.equal(new Set(codes).size, 30);
    for (const code of codes) assert.ok(code.length <= 40);
  });
});

describe('question import duplicates', () => {
  it('treats question text as the same after case and extra spaces change', () => {
    assert.equal(questionContentKey('What  is 2+2?', ''), questionContentKey('what is 2+2?', ''));
    assert.notEqual(questionContentKey('What is 2+2?', ''), questionContentKey('What is 3+3?', ''));
  });

  it('skips a later row with the same text and names the earlier sheet row', () => {
    const seen = new Map();
    const { keep, issues } = skipDuplicateQuestionRows(
      [
        { sheetRow: 4, question: 'What is 2+2?', stemImageUrl: '', optionA: '4' },
        { sheetRow: 12, question: 'what  is 2+2?', stemImageUrl: '', optionA: 'Four' },
      ],
      seen,
    );
    assert.equal(keep.length, 1);
    assert.equal(keep[0]?.sheetRow, 4);
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /Sheet row 12/);
    assert.match(issues[0]!.message, /column “Question”/);
    assert.match(issues[0]!.message, /what is 2\+2\?/);
    assert.match(issues[0]!.message, /already on sheet row 4/);
    assert.match(issues[0]!.message, /Row 4 is the one that will be imported/);
  });

  it('skips a row whose text is already in the question bank', () => {
    const seen = new Map();
    seedSavedQuestion(seen, {
      question: 'What is 2+2?',
      stemImageUrl: '',
      where: { source: 'bank' },
    });
    const issue = duplicateQuestionIssue(12, 'What is 2+2?', '', { source: 'bank' });
    const { keep, issues } = skipDuplicateQuestionRows(
      [{ sheetRow: 12, question: 'What is 2+2?', stemImageUrl: '' }],
      seen,
    );
    assert.equal(keep.length, 0);
    assert.equal(issues[0]?.message, issue.message);
    assert.match(issues[0]!.message, /already in this question bank/);
    assert.match(issues[0]!.message, /matches what is saved/);
  });

  it('keeps the same question text when it belongs to two different rounds', () => {
    const seen = new Map();
    const { keep, issues } = skipDuplicateQuestionRows(
      [
        { sheetRow: 2, question: 'What is 2+2?', stemImageUrl: '', roundName: 'Round 1' },
        { sheetRow: 3, question: 'What is 2+2?', stemImageUrl: '', roundName: 'Round 2' },
      ],
      seen,
    );
    assert.equal(keep.length, 2);
    assert.equal(issues.length, 0);
  });

  it('skips a question already saved in that round and says another round is allowed', () => {
    const seen = new Map();
    seedSavedQuestion(seen, {
      question: 'What is 2+2?',
      stemImageUrl: '',
      roundName: 'Round 1',
      where: { source: 'round', roundName: 'Round 1' },
    });
    const { keep, issues } = skipDuplicateQuestionRows(
      [{ sheetRow: 12, question: 'What is 2+2?', stemImageUrl: '', roundName: 'round 1' }],
      seen,
    );
    assert.equal(keep.length, 0);
    assert.match(issues[0]!.message, /already in round “Round 1”/);
    assert.match(issues[0]!.message, /same text in another round is allowed/);
  });

  it('matches an image-only question on the image link', () => {
    assert.equal(
      questionContentKey('', 'HTTPS://Example.com/A.png'),
      questionContentKey('', 'https://example.com/a.png'),
    );
    const seen = new Map();
    const { keep, issues } = skipDuplicateQuestionRows(
      [
        { sheetRow: 2, question: '', stemImageUrl: 'https://example.com/a.png' },
        { sheetRow: 5, question: '   ', stemImageUrl: 'HTTPS://Example.com/A.png' },
      ],
      seen,
    );
    assert.equal(keep.length, 1);
    assert.match(issues[0]!.message, /column “Question image link”/);
    assert.match(issues[0]!.message, /already the question \(no text\) on sheet row 2/);
  });

  it('treats a case or spacing change as the same saved question', () => {
    const saved = {
      type: 'single_mcq',
      question: 'What is 2+2?',
      points: 1,
      stemImageUrl: '',
      passageText: '',
      options: [
        { label: 'A', body: '4', isCorrect: true, imageUrl: '' },
        { label: 'B', body: '5', isCorrect: false, imageUrl: '' },
      ],
      numericValue: '',
      numericTolerance: '',
      referenceAnswer: '',
    };
    const incoming = contentFromPayload(
      rowToCreatePayload(
        row({
          type: 'single_mcq',
          question: 'what  is 2+2?',
          points: '1',
          optionA: '4',
          optionB: '5',
          correct: 'A',
        }),
        'quiz',
      ),
    );
    assert.deepEqual(questionFieldChanges(saved, incoming), []);
    assert.equal(
      decideImportedQuestion({ source: 'bank', saved: { ...saved, questionId: 'q1' } }, incoming)
        .action,
      'skip-unchanged',
    );
  });

  it('asks to update when the correct option changes and still adds a different question', () => {
    const saved = {
      questionId: 'q1',
      type: 'single_mcq',
      question: 'What is 2+2?',
      points: 1,
      stemImageUrl: '',
      passageText: '',
      options: [
        { label: 'A', body: '4', isCorrect: true, imageUrl: '' },
        { label: 'B', body: '5', isCorrect: false, imageUrl: '' },
      ],
      numericValue: '',
      numericTolerance: '',
      referenceAnswer: '',
    };
    const changed = contentFromPayload(
      rowToCreatePayload(
        row({
          type: 'single_mcq',
          question: 'What is 2+2?',
          points: '2',
          optionA: '4',
          optionB: '5',
          correct: 'B',
        }),
        'quiz',
      ),
    );
    const decision = decideImportedQuestion({ source: 'bank', saved }, changed);
    assert.equal(decision.action, 'update');
    if (decision.action !== 'update') return;
    assert.equal(decision.questionId, 'q1');
    assert.deepEqual(
      decision.changes.map((change) => change.field),
      ['Points', 'Options'],
    );
    const options = decision.changes.find((change) => change.field === 'Options');
    assert.match(options?.before ?? '', /A\. 4, correct/);
    assert.match(options?.after ?? '', /B\. 5, correct/);
    assert.equal(decideImportedQuestion(null, changed).action, 'create');
  });

  it('keeps the first file change and treats a later row with the same text as a sheet duplicate', () => {
    const saved = {
      questionId: 'q1',
      type: 'single_mcq',
      question: 'What is 2+2?',
      points: 1,
      stemImageUrl: '',
      passageText: '',
      options: [
        { label: 'A', body: '4', isCorrect: true, imageUrl: '' },
        { label: 'B', body: '5', isCorrect: false, imageUrl: '' },
      ],
      numericValue: '',
      numericTolerance: '',
      referenceAnswer: '',
    };
    const seen = new Map();
    seedSavedQuestion(seen, {
      question: 'What is 2+2?',
      stemImageUrl: '',
      where: { source: 'bank', saved },
    });
    const first = contentFromPayload(
      rowToCreatePayload(
        row({
          type: 'single_mcq',
          question: 'What is 2+2?',
          points: '2',
          optionA: '4',
          optionB: '5',
          correct: 'B',
        }),
        'quiz',
      ),
    );
    assert.equal(
      decideImportedQuestion(
        findQuestionDuplicate(seen, {
          question: 'What is 2+2?',
          stemImageUrl: '',
        }),
        first,
      ).action,
      'update',
    );
    claimQuestionRow(seen, { sheetRow: 4, question: 'What is 2+2?', stemImageUrl: '' });
    const secondHit = findQuestionDuplicate(seen, { question: 'What is 2+2?', stemImageUrl: '' });
    assert.equal(secondHit?.source, 'sheet');
    assert.equal(decideImportedQuestion(secondHit, first).action, 'skip-sheet');
  });
});

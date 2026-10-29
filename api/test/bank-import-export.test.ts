import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { isImportFilename } from '../src/modules/banks/upload.js';
import { authorableTypesForKind } from '../src/modules/banks/schema.js';
import {
  MAX_IMPORT_ROWS,
  buildExportCsv,
  buildSampleCsv,
  buildSampleWorkbook,
  newImportQuestionCode,
  parseBankQuestionsCsv,
  parseBankQuestionsFile,
  rowToCreatePayload,
} from '../src/modules/banks/import-export.js';

function payloadFromCsv(csv: string, kind: 'assessment' | 'quiz' = 'assessment') {
  const rows = parseBankQuestionsCsv(csv);
  assert.equal(rows.length, 1);
  return rowToCreatePayload(rows[0]!, kind);
}

describe('question spreadsheet samples', () => {
  it('imports every assessment example as the type the sheet names', async () => {
    const buffer = await buildSampleWorkbook('assessment');
    const rows = await parseBankQuestionsFile(Buffer.from(buffer), 'sample.xlsx');
    const types = rows.map((row) => rowToCreatePayload(row, 'assessment').type);
    assert.deepEqual(new Set(types), authorableTypesForKind('assessment'));
    const comprehension = rows.filter((row) => row.type === 'comprehension_mcq');
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
    assert.match(notes, /does not update or replace/);
    assert.doesNotMatch(notes, /always single/i);
  });

  it('imports the quiz sample as single-choice and multiple-choice only', async () => {
    const buffer = await buildSampleWorkbook('quiz');
    const rows = await parseBankQuestionsFile(Buffer.from(buffer), 'quiz-sample.xlsx');
    const types = rows.map((row) => rowToCreatePayload(row, 'quiz').type);
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
    assert.equal(
      buildSampleCsv('quiz').split('\n')[0],
      buildSampleCsv('assessment').split('\n')[0],
    );
  });
});

describe('question spreadsheet rows', () => {
  it('accepts the form labels and a header that is not on the first row', () => {
    const csv = [
      'Notes for the coordinator',
      'Question Text,Correct Answer,Points,Option A,Option B,Type',
      'Which planet?,Mars,1,Venus,Mars,Single choice',
    ].join('\n');
    const rows = parseBankQuestionsCsv(csv);
    assert.equal(rows[0]?.sheetRow, 3);
    const payload = rowToCreatePayload(rows[0]!);
    assert.equal(payload.type, 'single_mcq');
    assert.equal(payload.options.find((option) => option.isCorrect)?.body, 'Mars');
    assert.equal(payload.points, 1);
  });

  it('maps True / False words and rejects a blank true/false answer', () => {
    const marked = payloadFromCsv(
      'type,question,points,correct\nTrue / False,The sky is green.,1,False',
    );
    assert.equal(marked.type, 'true_false');
    assert.equal(marked.options[0]?.body, 'True');
    assert.equal(marked.options[0]?.isCorrect, false);
    assert.equal(marked.options[1]?.isCorrect, true);

    assert.throws(
      () => payloadFromCsv('type,question,points,correct\ntrue_false,The sky is green.,1,'),
      /Mark True or False/,
    );
    assert.throws(
      () => payloadFromCsv('type,question,points,correct\ntrue_false,The sky is green.,1,C'),
      /Mark True or False/,
    );
  });

  it('matches option text before a digit, and keeps “and” inside an option', () => {
    const byText = payloadFromCsv(
      'type,question,points,optionA,optionB,optionC,optionD,correct\nmultiple_mcq,Primes,2,2,3,4,5,"2,3,5"',
    );
    assert.deepEqual(
      byText.options.filter((option) => option.isCorrect).map((option) => option.label),
      ['A', 'B', 'D'],
    );

    const byDigit = payloadFromCsv(
      'type,question,points,optionA,optionB,correct\nsingle_mcq,Second,1,Yes,No,2',
    );
    assert.equal(byDigit.options.find((option) => option.isCorrect)?.label, 'B');

    const phrase = payloadFromCsv(
      'type,question,points,optionA,optionB,correct\nsingle_mcq,Phrase,1,Command and control,Other,Command and control',
    );
    assert.equal(phrase.options[0]?.isCorrect, true);

    const letters = payloadFromCsv(
      'type,question,points,optionA,optionB,optionC,correct\nmultiple_mcq,Pick,1,Red,Blue,Green,A and C',
    );
    assert.deepEqual(
      letters.options.filter((option) => option.isCorrect).map((option) => option.label),
      ['A', 'C'],
    );
  });

  it('infers quiz type from how many answers are marked, and rejects other types', () => {
    const many = payloadFromCsv(
      'question,points,optionA,optionB,optionC,correct\nPick,1,Red,Blue,Green,"A,C"',
      'quiz',
    );
    assert.equal(many.type, 'multiple_mcq');

    const one = payloadFromCsv(
      'type,question,points,optionA,optionB,correct\n,Pick,1,Red,Blue,B',
      'quiz',
    );
    assert.equal(one.type, 'single_mcq');

    const labeled = payloadFromCsv(
      'type,question,points,optionA,optionB,optionC,correct\nMSQ (multiple options),Pick,1,Red,Blue,Green,"A,C"',
      'quiz',
    );
    assert.equal(labeled.type, 'multiple_mcq');

    const legacyImage = payloadFromCsv(
      'type,question,points,optionA,optionB,correct\nimage_mcq,Shown,1,Red,Blue,A',
      'quiz',
    );
    assert.equal(legacyImage.type, 'single_mcq');
    assert.throws(
      () =>
        payloadFromCsv(
          'type,question,points,optionA,optionB,correct\ntrue_false,Shown,1,Red,Blue,A',
          'quiz',
        ),
      /single-choice or multiple-choice/,
    );
    assert.throws(
      () => payloadFromCsv('type,question,points,correct\npassage,Old,1,'),
      /Unknown type/,
    );
    const essay = payloadFromCsv('type,question,points\nessay,Explain,3');
    assert.equal(essay.type, 'long_text');
  });

  it('defaults blank points to 1 and rejects 0 and 100000000', () => {
    const blank = payloadFromCsv(
      'type,question,points,optionA,optionB,correct\nsingle_mcq,Hi,,Yes,No,A',
    );
    assert.equal(blank.points, 1);

    assert.throws(
      () =>
        payloadFromCsv('type,question,points,optionA,optionB,correct\nsingle_mcq,Hi,0,Yes,No,A'),
      /positive number/,
    );
    assert.throws(
      () =>
        payloadFromCsv(
          'type,question,points,optionA,optionB,correct\nsingle_mcq,Hi,100000000,Yes,No,A',
        ),
      /less than 100000000/,
    );
    const under = payloadFromCsv(
      'type,question,points,optionA,optionB,correct\nsingle_mcq,Hi,99999999.99,Yes,No,A',
    );
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
    const numericPayload = payloadFromCsv(numeric);
    assert.equal(numericPayload.answerKey.value, -4);
    assert.equal(numericPayload.answerKey.numericTolerance, 0.5);

    const choice = buildExportCsv([
      {
        type: 'single_mcq',
        question: '=1+1',
        points: 1,
        options: [
          { label: 'A', body: '-2', isCorrect: true },
          { label: 'B', body: '2', isCorrect: false },
        ],
      },
    ]);
    const choicePayload = payloadFromCsv(choice);
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
    const payload = payloadFromCsv(csv, 'quiz');
    assert.equal(payload.type, 'multiple_mcq');
    assert.deepEqual(payload.answerKey.correctLabels, ['A', 'C']);
  });
});

describe('question spreadsheet files', () => {
  it('reads a header on row 20 and rejects a header on row 21', async () => {
    const accepted = new ExcelJS.Workbook();
    const okSheet = accepted.addWorksheet('Questions');
    const headers = ['type', 'question', 'points', 'optionA', 'optionB', 'correct'];
    headers.forEach((header, index) => {
      okSheet.getRow(20).getCell(index + 1).value = header;
    });
    ['single_mcq', 'From row 21', 1, 'Yes', 'No', 'A'].forEach((value, index) => {
      okSheet.getRow(21).getCell(index + 1).value = value;
    });
    const okRows = await parseBankQuestionsFile(
      Buffer.from(await accepted.xlsx.writeBuffer()),
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
    await assert.rejects(
      () => parseBankQuestionsFile(lateBuffer, 'too-late.xlsx'),
      /Expected question/,
    );
  });

  it('ignores a title cell named Question when a fuller header follows', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.getRow(1).getCell(1).value = 'Question';
    ['type', 'question', 'points', 'optionA', 'optionB', 'correct', 'stemImageUrl'].forEach(
      (header, index) => {
        sheet.getRow(2).getCell(index + 1).value = header;
      },
    );
    ['single_mcq', 'Real question', 2, 'Yes', 'No', 'A'].forEach((value, index) => {
      sheet.getRow(3).getCell(index + 1).value = value;
    });
    sheet.getRow(3).getCell(7).value = {
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
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Questions');
    ['type', 'question', 'points', 'numericValue', 'numericTolerance'].forEach((header, index) => {
      sheet.getRow(1).getCell(index + 1).value = header;
    });
    sheet.getRow(2).getCell(1).value = 'numeric';
    sheet.getRow(2).getCell(2).value = { formula: 'A1', result: 'Below zero' };
    sheet.getRow(2).getCell(3).value = 2;
    sheet.getRow(2).getCell(4).value = -4;
    sheet.getRow(2).getCell(5).value = 0.5;
    const rows = await parseBankQuestionsFile(
      Buffer.from(await workbook.xlsx.writeBuffer()),
      'numbers.xlsx',
    );
    const payload = rowToCreatePayload(rows[0]!);
    assert.equal(payload.question, 'Below zero');
    assert.equal(payload.points, 2);
    assert.equal(payload.answerKey.value, -4);
    assert.equal(payload.answerKey.numericTolerance, 0.5);

    sheet.getRow(2).getCell(2).value = { formula: 'A1' };
    const uncached = await parseBankQuestionsFile(
      Buffer.from(await workbook.xlsx.writeBuffer()),
      'uncached.xlsx',
    );
    assert.equal(uncached[0]?.question ?? '', '');
  });

  it('accepts 1000 data rows, rejects 1001, and strips a UTF-8 BOM', () => {
    const header = 'type,question,points,optionA,optionB,correct';
    const line = (index: number) => `single_mcq,Question ${index},1,Yes,No,A`;
    const accepted = [header, ...Array.from({ length: MAX_IMPORT_ROWS }, (_, i) => line(i))].join(
      '\n',
    );
    assert.equal(parseBankQuestionsCsv(accepted).length, MAX_IMPORT_ROWS);
    const rejected = [
      header,
      ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => line(i)),
    ].join('\n');
    assert.throws(() => parseBankQuestionsCsv(rejected), /1000/);

    const bom = payloadFromCsv(
      '\uFEFFtype,question,points,optionA,optionB,correct\nsingle_mcq,Hello,1,Yes,No,A',
    );
    assert.equal(bom.question, 'Hello');
    assert.deepEqual(parseBankQuestionsCsv(''), []);
  });

  it('rejects legacy .xls and filenames that are not csv or xlsx', async () => {
    await assert.rejects(
      () => parseBankQuestionsFile(Buffer.from('not-excel'), 'questions.xls'),
      /Legacy \.xls/,
    );
    assert.equal(isImportFilename('questions.xlsx'), true);
    assert.equal(isImportFilename('questions.CSV'), true);
    assert.equal(isImportFilename('questions.xls'), false);
    assert.equal(isImportFilename('questions.xlsx.txt'), false);
  });

  it('issues a unique code of at most 40 characters for each imported row', () => {
    const codes = Array.from({ length: 30 }, (_, index) => newImportQuestionCode(index + 2, index));
    assert.equal(new Set(codes).size, 30);
    for (const code of codes) assert.ok(code.length <= 40);
  });
});

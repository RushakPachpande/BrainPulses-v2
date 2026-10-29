import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { AppError } from '../src/lib/errors.js';
import { formatImportIssue, parseXlsxWorkbook } from '../src/lib/spreadsheet-import.js';
import {
  parseStudentsFile,
  STUDENT_IMPORT_HEADERS,
} from '../src/modules/students/import-export.js';
import { parseUsersFile, USER_IMPORT_HEADERS } from '../src/modules/users/import-export.js';

async function sheetBuffer(
  sheetName: string,
  headers: string[],
  rows: string[][],
  headerOrder?: string[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  const cols = headerOrder ?? headers;
  sheet.addRow(cols);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('spreadsheet import helpers', () => {
  it('formats row issues with column, value, expected, and example', () => {
    const message = formatImportIssue({
      sheetRow: 4,
      column: 'email',
      value: 'not-an-email',
      problem: 'this is not a valid email',
      expected: 'a real email address',
      example: 'student@college.edu',
    });
    assert.match(message, /Sheet row 4/);
    assert.match(message, /email/);
    assert.match(message, /not-an-email/);
    assert.match(message, /student@college\.edu/);
  });

  it('maps shifted student columns and rejects a misspelled header', async () => {
    const order = ['cohort', 'email', 'name', 'code', 'city', 'phone', 'course'];
    const buffer = await sheetBuffer(
      'Students',
      [...STUDENT_IMPORT_HEADERS],
      [['2026', 'asha@college.edu', 'Asha Verma', '', 'Pune', '', 'PGDM']],
      order,
    );
    const { rows } = await parseStudentsFile(buffer, 'students.xlsx');
    assert.equal(rows[0]?.name, 'Asha Verma');
    assert.equal(rows[0]?.email, 'asha@college.edu');
    assert.equal(rows[0]?.cohort, '2026');

    const bad = await sheetBuffer(
      'Students',
      ['name', 'emial', 'phone', 'course', 'city', 'cohort', 'code'],
      [['Asha', 'a@b.com', '', '', '', '', '']],
    );
    await assert.rejects(
      () => parseStudentsFile(bad, 'bad.xlsx'),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.match(err.message, /email/i);
        assert.match(err.message, /emial/i);
        return true;
      },
    );
  });

  it('maps shifted user columns', async () => {
    const order = ['quizAccess', 'password', 'email', 'name', 'role', 'assessmentAccess'];
    const buffer = await sheetBuffer(
      'Users',
      [...USER_IMPORT_HEADERS],
      [['view', 'ChangeMe123!', 'priya@org.example', 'Priya', 'admin', 'full']],
      order,
    );
    const { rows } = await parseUsersFile(buffer, 'users.xlsx');
    assert.equal(rows[0]?.email, 'priya@org.example');
    assert.equal(rows[0]?.password, 'ChangeMe123!');
    assert.equal(rows[0]?.quizAccess, 'view');
  });

  it('rejects csv filenames in the shared reader', async () => {
    await assert.rejects(
      () =>
        parseXlsxWorkbook(Buffer.from('a,b'), 'rows.csv', {
          columns: [{ key: 'name' }, { key: 'email' }],
          emptyNoun: 'rows',
        }),
      /\.xlsx/,
    );
  });
});

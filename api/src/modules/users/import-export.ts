import ExcelJS from 'exceljs';
import { sanitizeCsvCell } from '../../lib/csv.js';
import {
  formatImportIssue,
  parseXlsxWorkbook,
  type SpreadsheetColumnSpec,
} from '../../lib/spreadsheet-import.js';

export const USER_IMPORT_HEADERS = [
  'name',
  'email',
  'password',
  'role',
  'assessmentAccess',
  'quizAccess',
] as const;

export type UserImportHeader = (typeof USER_IMPORT_HEADERS)[number];

export type UserImportRow = Record<UserImportHeader, string> & { sheetRow: number };

export type UserImportIssue = { row: number; message: string };

export const USER_IMPORT_COLUMNS: SpreadsheetColumnSpec<UserImportHeader>[] = [
  { key: 'name', aliases: ['full name', 'fullname', 'user name'] },
  { key: 'email', aliases: ['e-mail', 'mail', 'login email'] },
  { key: 'password', aliases: ['pass', 'temporary password'] },
  { key: 'role', aliases: ['membership role', 'user role'] },
  { key: 'assessmentAccess', aliases: ['assessment access', 'assessments'] },
  { key: 'quizAccess', aliases: ['quiz access', 'quizzes'] },
];

export async function parseUsersFile(
  buffer: Buffer,
  filename: string,
): Promise<{ rows: UserImportRow[]; ignoredColumns: string[] }> {
  const parsed = await parseXlsxWorkbook(buffer, filename, {
    columns: USER_IMPORT_COLUMNS,
    preferredSheetName: 'Users',
    emptyNoun: 'users',
  });
  return {
    rows: parsed.rows as UserImportRow[],
    ignoredColumns: parsed.ignoredColumns,
  };
}

function sampleRows(): Record<UserImportHeader, string>[] {
  return [
    {
      name: 'Priya Shah',
      email: 'priya.shah@org.example',
      password: 'ChangeMe123!',
      role: 'admin',
      assessmentAccess: 'full',
      quizAccess: 'edit',
    },
    {
      name: 'Dev Observer',
      email: 'viewer@org.example',
      password: 'ChangeMe123!',
      role: 'admin',
      assessmentAccess: 'view',
      quizAccess: 'view',
    },
  ];
}

export async function buildUserSampleWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const instructions = workbook.addWorksheet('Instructions');
  instructions.addRow(['BrainPulses admin user import']);
  instructions.addRow([]);
  instructions.addRow(['1. Fill the Users sheet. Do not rename the column headers.']);
  instructions.addRow([
    '2. Delete the example rows before you import, or those example users will be invited.',
  ]);
  instructions.addRow([
    '3. Required values on every data row: name, email, and password (8–128 characters).',
  ]);
  instructions.addRow([
    '4. role is admin or super_admin (blank = admin). Only a super admin can import another super_admin.',
  ]);
  instructions.addRow([
    '5. assessmentAccess and quizAccess are full, edit, view, or none (blank = full). You cannot grant access above your own level.',
  ]);
  instructions.addRow([
    '6. Save as Excel (.xlsx) only. CSV is not supported. Up to 1000 rows, 10 MB.',
  ]);
  instructions.addRow([
    '7. Column order may change. Every header from the Users sheet must still be present and spelled correctly.',
  ]);
  instructions.getColumn(1).width = 100;

  const sheet = workbook.addWorksheet('Users');
  sheet.addRow([...USER_IMPORT_HEADERS]);
  for (const row of sampleRows()) {
    sheet.addRow(USER_IMPORT_HEADERS.map((h) => sanitizeCsvCell(row[h] ?? '')));
  }
  sheet.getRow(1).font = { bold: true };
  USER_IMPORT_HEADERS.forEach((header, index) => {
    sheet.getColumn(index + 1).width = Math.min(28, Math.max(12, header.length + 2));
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function userRowIssue(
  sheetRow: number,
  problem: string,
  opts?: { column?: string; value?: string; expected?: string; example?: string },
): UserImportIssue {
  return {
    row: sheetRow,
    message: formatImportIssue({
      sheetRow,
      problem,
      column: opts?.column,
      value: opts?.value,
      expected: opts?.expected,
      example: opts?.example,
    }),
  };
}

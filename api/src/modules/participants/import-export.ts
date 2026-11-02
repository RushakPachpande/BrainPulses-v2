import ExcelJS from 'exceljs';
import { sanitizeCsvCell } from '../../lib/csv.js';
import {
  formatImportIssue,
  parseXlsxWorkbook,
  type SpreadsheetColumnSpec,
} from '../../lib/spreadsheet-import.js';

export const PARTICIPANT_IMPORT_HEADERS = [
  'name',
  'email',
  'phone',
  'course',
  'city',
  'cohort',
  'code',
] as const;

export type ParticipantImportHeader = (typeof PARTICIPANT_IMPORT_HEADERS)[number];

export type ParticipantImportRow = Record<ParticipantImportHeader, string> & { sheetRow: number };

export type ParticipantImportIssue = { row: number; message: string };

export const PARTICIPANT_IMPORT_COLUMNS: SpreadsheetColumnSpec<ParticipantImportHeader>[] = [
  { key: 'name', aliases: ['full name', 'participant name', 'fullname'] },
  { key: 'email', aliases: ['e-mail', 'mail', 'login email'] },
  { key: 'phone', aliases: ['mobile', 'phone number', 'mobile number'] },
  { key: 'course', aliases: ['program', 'programme'] },
  { key: 'city', aliases: ['town'] },
  { key: 'cohort', aliases: ['batch', 'batch year', 'year'] },
  { key: 'code', aliases: ['unique id', 'uniqueid', 'participant id', 'participant code'] },
];

export async function parseParticipantsFile(
  buffer: Buffer,
  filename: string,
): Promise<{ rows: ParticipantImportRow[]; ignoredColumns: string[] }> {
  const parsed = await parseXlsxWorkbook(buffer, filename, {
    columns: PARTICIPANT_IMPORT_COLUMNS,
    preferredSheetName: 'Participants',
    emptyNoun: 'participants',
  });
  return {
    rows: parsed.rows as ParticipantImportRow[],
    ignoredColumns: parsed.ignoredColumns,
  };
}

function sampleRows(): Record<ParticipantImportHeader, string>[] {
  return [
    {
      name: 'Asha Verma',
      email: 'asha.verma@college.edu',
      phone: '+919876543210',
      course: 'PGDM',
      city: 'Pune',
      cohort: '2026',
      code: '',
    },
    {
      name: 'Rohan Patel',
      email: 'rohan.patel@college.edu',
      phone: '',
      course: 'MBA',
      city: 'Mumbai',
      cohort: '2026',
      code: 'BP-DEMO-001',
    },
  ];
}

export async function buildParticipantSampleWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const instructions = workbook.addWorksheet('Instructions');
  instructions.addRow(['BrainPulses participant import']);
  instructions.addRow([]);
  instructions.addRow(['1. Fill the Participants sheet. Do not rename the column headers.']);
  instructions.addRow([
    '2. Delete the example rows before you import, or those example participants will be created.',
  ]);
  instructions.addRow([
    '3. Required values on every data row: name and email. phone, course, city, cohort, and code may be blank.',
  ]);
  instructions.addRow([
    '4. Leave code blank to auto-generate a Unique ID. If you set code, it must be unique in this organization.',
  ]);
  instructions.addRow([
    '5. Save as Excel (.xlsx) only. CSV is not supported. Up to 1000 rows, 10 MB.',
  ]);
  instructions.addRow([
    '6. Column order may change. Every header from the Participants sheet must still be present and spelled correctly.',
  ]);
  instructions.getColumn(1).width = 100;

  const sheet = workbook.addWorksheet('Participants');
  sheet.addRow([...PARTICIPANT_IMPORT_HEADERS]);
  for (const row of sampleRows()) {
    sheet.addRow(PARTICIPANT_IMPORT_HEADERS.map((h) => sanitizeCsvCell(row[h] ?? '')));
  }
  sheet.getRow(1).font = { bold: true };
  PARTICIPANT_IMPORT_HEADERS.forEach((header, index) => {
    sheet.getColumn(index + 1).width = Math.min(28, Math.max(12, header.length + 2));
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function participantRowIssue(
  sheetRow: number,
  problem: string,
  opts?: { column?: string; value?: string; expected?: string; example?: string },
): ParticipantImportIssue {
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

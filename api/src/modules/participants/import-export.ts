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
    labels: {
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      course: 'Course',
      city: 'City',
      cohort: 'Cohort',
      code: 'Unique ID',
    },
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
  const { createWorkbook } = await import('../../lib/excel-workbook.js');
  const workbook = await createWorkbook();
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
    '4. Leave code blank to auto-generate a Unique ID. Email, phone, and Unique ID must each be unique in this organization. A row that matches someone already saved is skipped.',
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

export type SavedParticipantIdentity = {
  name: string;
  email: string;
  code: string;
  phone: string | null;
};

function savedPersonLabel(person: SavedParticipantIdentity): string {
  const name = person.name.trim() || 'an existing participant';
  const code = person.code.trim();
  return code ? `${name} (Unique ID ${code})` : name;
}

/**
 * First match wins: Unique ID, then email, then phone.
 * Phone values must already be normalized the same way on both sides.
 */
export function savedParticipantConflict(
  sheetRow: number,
  row: { email: string; code: string; phone?: string },
  existing: SavedParticipantIdentity[],
): ParticipantImportIssue | null {
  const email = row.email.trim().toLowerCase();
  const code = row.code.trim();
  const phone = row.phone?.trim() ?? '';

  if (code) {
    const match = existing.find(
      (person) => person.code.trim().toLowerCase() === code.toLowerCase(),
    );
    if (match) {
      return participantRowIssue(
        sheetRow,
        `this Unique ID is already used by ${savedPersonLabel(match)}`,
        {
          column: 'Unique ID',
          value: code,
          expected:
            'delete this row, or use a different Unique ID. Leave the cell blank only when this is a new person',
        },
      );
    }
  }

  if (email) {
    const match = existing.find((person) => person.email.trim().toLowerCase() === email);
    if (match) {
      return participantRowIssue(
        sheetRow,
        `this email is already used by ${savedPersonLabel(match)}`,
        {
          column: 'Email',
          value: email,
          expected: 'delete this row, or use a different email',
        },
      );
    }
  }

  if (phone) {
    const match = existing.find((person) => (person.phone ?? '').trim() === phone);
    if (match) {
      return participantRowIssue(
        sheetRow,
        `this phone number is already used by ${savedPersonLabel(match)}`,
        {
          column: 'Phone',
          value: phone,
          expected:
            'delete this row, or use a different phone number. Leave the cell blank if this person has no phone',
        },
      );
    }
  }

  return null;
}

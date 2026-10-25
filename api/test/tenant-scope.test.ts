import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeCsvCell } from '../src/lib/csv.js';
import { withTenantOrganization } from '../src/lib/tenant-scope.js';
import { buildExportCsv, buildExportWorkbook } from '../src/modules/banks/import-export.js';
import ExcelJS from 'exceljs';

describe('tenant create scope', () => {
  it('keeps the request organization when the row omits it', () => {
    const row = withTenantOrganization('activityBank', { activityId: 'a1' }, 'org-1');
    assert.equal(row.organizationId, 'org-1');
    assert.equal(row.activityId, 'a1');
  });

  it('rejects a create row that names another organization', () => {
    assert.throws(
      () => withTenantOrganization('activityBank', { organizationId: 'org-2' }, 'org-1'),
      /Tenant scope mismatch on activityBank create/,
    );
  });
});

describe('csv formula injection', () => {
  it('prefixes formula triggers and leaves ordinary text', () => {
    assert.equal(sanitizeCsvCell('=1+1'), "'=1+1");
    assert.equal(sanitizeCsvCell('  +cmd'), "'+cmd");
    assert.equal(sanitizeCsvCell('@SUM(A1)'), "'@SUM(A1)");
    assert.equal(sanitizeCsvCell('Round 1'), 'Round 1');
  });

  it('prefixes formula text in question-bank CSV and xlsx exports', async () => {
    const question = {
      type: 'short_text',
      question: '=1+1',
      points: 1,
      options: [] as { label: string; body: string; isCorrect: boolean }[],
    };
    const csv = buildExportCsv([question]);
    assert.match(csv, /'=1\+1/);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await buildExportWorkbook([question])) as unknown as ExcelJS.Buffer);
    const sheet = workbook.getWorksheet('Questions');
    assert.ok(sheet);
    const header = sheet.getRow(1).values as Array<string | undefined>;
    const questionCol = header.indexOf('question');
    assert.ok(questionCol > 0);
    assert.equal(sheet.getRow(2).getCell(questionCol).value, "'=1+1");
  });
});

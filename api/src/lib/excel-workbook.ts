import type { Workbook } from 'exceljs';

type ExcelNamespace = {
  Workbook: new () => Workbook;
};

/** ExcelJS is CommonJS. Dynamic import exposes the constructor on `default`, not as a named export. */
async function loadExcel(): Promise<ExcelNamespace> {
  const mod = (await import('exceljs')) as { default?: ExcelNamespace } & ExcelNamespace;
  return mod.default?.Workbook ? mod.default : mod;
}

export async function createWorkbook(): Promise<Workbook> {
  const excel = await loadExcel();
  return new excel.Workbook();
}

export async function loadWorkbook(buffer: Buffer): Promise<Workbook> {
  const workbook = await createWorkbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<Workbook['xlsx']['load']>[0]);
  return workbook;
}

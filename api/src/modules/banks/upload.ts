import { isXlsxFilename } from '../../lib/xlsx-file.js';
import { xlsxImportUpload } from '../../lib/xlsx-upload.js';

export function isImportFilename(name: string): boolean {
  return isXlsxFilename(name);
}

export const bankImportUpload = xlsxImportUpload;

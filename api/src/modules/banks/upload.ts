import multer from 'multer';
import { badRequest } from '../../lib/errors.js';

const IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export function isImportFilename(name: string): boolean {
  return /\.(csv|xlsx)$/i.test(name);
}

export const bankImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMPORT_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isImportFilename(file.originalname)) {
      cb(null, true);
      return;
    }
    cb(badRequest('Upload a .csv or .xlsx file. Legacy .xls is not supported.'));
  },
});

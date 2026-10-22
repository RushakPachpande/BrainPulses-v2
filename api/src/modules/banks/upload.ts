import multer from 'multer';
import { badRequest } from '../../lib/errors.js';

const IMPORT_MAX_BYTES = 10 * 1024 * 1024;

const allowedExt = /\.(csv|xlsx|xls)$/i;
const allowedMime = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

export const bankImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMPORT_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const nameOk = allowedExt.test(file.originalname);
    const mimeOk = allowedMime.has(file.mimetype);
    if (nameOk || mimeOk) {
      cb(null, true);
      return;
    }
    cb(badRequest('Upload a .csv or .xlsx file.'));
  },
});

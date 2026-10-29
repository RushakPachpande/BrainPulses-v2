import multer from 'multer';
import { badRequest } from './errors.js';
import { IMPORT_MAX_BYTES, isXlsxFilename, xlsxOnlyRejectedMessage } from './spreadsheet-import.js';

/** Multipart field `file` — Excel (.xlsx) only, 10 MB max. */
export const xlsxImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMPORT_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isXlsxFilename(file.originalname)) {
      cb(null, true);
      return;
    }
    cb(badRequest(xlsxOnlyRejectedMessage(file.originalname)));
  },
});

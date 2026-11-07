import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { sendSmsOtp } from '../twilio.js';
import type {
  AssessmentExportJob,
  ExportJobResult,
  ImportJobResult,
  JobPayload,
  JobResult,
  QuizExportJob,
  SpreadsheetImportJob,
} from './types.js';

async function ensureJobDir() {
  const dir = path.resolve(env.UPLOAD_DIR, 'temporary', 'jobs');
  await mkdir(dir, { recursive: true });
  return dir;
}

async function writeExportFile(
  jobId: string,
  fileName: string,
  contentType: string,
  body: Buffer | string,
): Promise<ExportJobResult> {
  const dir = await ensureJobDir();
  const safeName = fileName.replace(/[^\w.-]+/g, '_');
  const storagePath = path.join(dir, `${jobId}-${safeName}`);
  await writeFile(storagePath, body);
  return { kind: 'export', fileName: safeName, contentType, storagePath };
}

async function processQuizExport(jobId: string, data: QuizExportJob): Promise<ExportJobResult> {
  const { buildReportCsv, buildReportWorkbook, reportFileBase } =
    await import('../../modules/quiz-reports/export.js');
  const service = await import('../../modules/quiz-reports/service.js');
  const exported = await service.exportQuizReportRows(data.organizationId, data.actor, {
    ...data.query,
    includeAbsent: data.includeAbsent,
  } as never);
  const base = reportFileBase(exported.quizName);
  if (data.format === 'csv') {
    const body = buildReportCsv(exported.rows, data.columns as never);
    return writeExportFile(jobId, `${base}.csv`, 'text/csv; charset=utf-8', body);
  }
  const buffer = await buildReportWorkbook(exported.rows, data.columns as never);
  return writeExportFile(
    jobId,
    `${base}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  );
}

async function processAssessmentExport(
  jobId: string,
  data: AssessmentExportJob,
): Promise<ExportJobResult> {
  const { assessmentFileBase, buildAssessmentCsv, buildAssessmentWorkbook } =
    await import('../../modules/assessment-reports/export.js');
  const service = await import('../../modules/assessment-reports/service.js');
  const exported = await service.exportAssessmentRows(data.organizationId, data.actor, {
    ...data.query,
    includeAbsent: data.includeAbsent,
  } as never);
  const base = assessmentFileBase(exported.assessmentName, exported.roundName);
  if (data.format === 'csv') {
    const body = buildAssessmentCsv(exported.rows, data.columns as never);
    return writeExportFile(jobId, `${base}.csv`, 'text/csv; charset=utf-8', body);
  }
  const buffer = await buildAssessmentWorkbook(exported.rows, data.columns as never);
  return writeExportFile(
    jobId,
    `${base}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  );
}

async function processImport(data: SpreadsheetImportJob): Promise<ImportJobResult> {
  const buffer = await readFile(data.tempPath);
  try {
    if (data.type === 'import.participants') {
      const service = await import('../../modules/participants/service.js');
      const result = await service.importParticipantsFile(data.organizationId, data.userId, {
        buffer,
        originalname: data.originalname,
      });
      return { kind: 'import', data: result };
    }
    if (data.type === 'import.users') {
      const service = await import('../../modules/users/service.js');
      if (!data.actor) throw new Error('actor is required for user import.');
      const result = await service.importUsersFile(
        data.organizationId,
        data.userId,
        data.actor.role,
        {
          assessmentAccess: data.actor.assessmentAccess,
          quizAccess: data.actor.quizAccess,
        },
        { buffer, originalname: data.originalname },
      );
      return { kind: 'import', data: result };
    }
    if (data.type === 'import.bank-questions') {
      if (!data.bankId) throw new Error('bankId is required for bank question import.');
      if (!data.actor) throw new Error('actor is required for bank question import.');
      const service = await import('../../modules/banks/service.js');
      const result = await service.importQuestionsFile(
        data.organizationId,
        data.userId,
        {
          role: data.actor.role,
          assessmentAccess: data.actor.assessmentAccess,
          quizAccess: data.actor.quizAccess,
        },
        data.bankId,
        {
          buffer,
          originalname: data.originalname,
          mimetype:
            data.mimetype ??
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        data.idempotencyKey,
      );
      return { kind: 'import', data: result };
    }
    throw new Error(`Unknown import type: ${(data as SpreadsheetImportJob).type}`);
  } finally {
    await unlink(data.tempPath).catch(() => undefined);
  }
}

export async function processJobPayload(
  payload: JobPayload,
  jobId = `inline-${Date.now()}`,
): Promise<JobResult> {
  switch (payload.type) {
    case 'sms.otp':
      await sendSmsOtp(payload.phone, payload.otp);
      return { kind: 'sms', sent: true };
    case 'report.quiz-export':
      return processQuizExport(jobId, payload);
    case 'report.assessment-export':
      return processAssessmentExport(jobId, payload);
    case 'import.participants':
    case 'import.users':
    case 'import.bank-questions':
      return processImport(payload);
    default: {
      const _exhaustive: never = payload;
      throw new Error(`Unhandled job type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** Persist an uploaded spreadsheet under temporary/jobs for a worker to consume. */
export async function writeImportTempFile(
  jobKey: string,
  originalname: string,
  buffer: Buffer,
): Promise<string> {
  const dir = await ensureJobDir();
  const ext = path.extname(originalname) || '.xlsx';
  const tempPath = path.join(dir, `import-${jobKey}${ext}`);
  await writeFile(tempPath, buffer);
  return tempPath;
}

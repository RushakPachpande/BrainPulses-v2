/** BullMQ job names for BrainPulses background work. */

import type { AccessLevel, MembershipRole } from '#prisma';

export const QUEUE_NAME = 'brainpulses-jobs' as const;

export type JobActor = {
  userId: string;
  role: MembershipRole;
  assessmentAccess: AccessLevel;
  quizAccess: AccessLevel;
};

export type ImportActor = {
  role: MembershipRole;
  assessmentAccess: AccessLevel;
  quizAccess: AccessLevel;
};

export type JobName =
  | 'sms.otp'
  | 'report.quiz-export'
  | 'report.assessment-export'
  | 'import.participants'
  | 'import.users'
  | 'import.bank-questions';

export type JobStatus =
  | 'queued'
  | 'active'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'waiting'
  | 'unknown';

export type SmsOtpJob = {
  type: 'sms.otp';
  phone: string;
  otp: string;
  requestId?: string;
};

export type QuizExportJob = {
  type: 'report.quiz-export';
  organizationId: string;
  actor: JobActor;
  query: Record<string, unknown>;
  columns: string[];
  format: 'xlsx' | 'csv';
  includeAbsent: boolean;
  requestId?: string;
};

export type AssessmentExportJob = {
  type: 'report.assessment-export';
  organizationId: string;
  actor: JobActor;
  query: Record<string, unknown>;
  columns: string[];
  format: 'xlsx' | 'csv';
  includeAbsent: boolean;
  requestId?: string;
};

export type SpreadsheetImportJob = {
  type: 'import.participants' | 'import.users' | 'import.bank-questions';
  organizationId: string;
  userId: string;
  actor?: ImportActor;
  bankId?: string;
  idempotencyKey?: string;
  tempPath: string;
  originalname: string;
  mimetype?: string;
  requestId?: string;
};

export type JobPayload = SmsOtpJob | QuizExportJob | AssessmentExportJob | SpreadsheetImportJob;

export type ExportJobResult = {
  kind: 'export';
  fileName: string;
  contentType: string;
  storagePath: string;
};

export type ImportJobResult = {
  kind: 'import';
  data: unknown;
};

export type SmsJobResult = {
  kind: 'sms';
  sent: true;
};

export type JobResult = ExportJobResult | ImportJobResult | SmsJobResult;

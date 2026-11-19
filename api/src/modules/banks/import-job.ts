/**
 * Question import runs in the API process.
 * The admin Import button waits on this HTTP response. A queued worker job
 * leaves that button on "Importing…" and the spreadsheet in uploads/temporary/jobs.
 */
export function bankQuestionImportEnqueueOptions(
  bankId: string,
  idempotencyKey: string | undefined,
): { forceInline: true; jobId?: string } {
  return {
    forceInline: true,
    jobId: idempotencyKey ? `bank-import:${bankId}:${idempotencyKey}` : undefined,
  };
}

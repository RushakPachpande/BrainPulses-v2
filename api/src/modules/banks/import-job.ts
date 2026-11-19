/**
 * Question import is a background job. The admin Import button polls
 * GET /api/jobs/:id and applies the real import counts when the job finishes.
 * A repeated idempotency key reuses the same job id.
 */
export function bankQuestionImportEnqueueOptions(
  bankId: string,
  idempotencyKey: string | undefined,
): { jobId?: string } {
  return {
    jobId: idempotencyKey ? `bank-import:${bankId}:${idempotencyKey}` : undefined,
  };
}

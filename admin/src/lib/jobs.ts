import { apiDownloadBlob, apiGetData, ApiError } from '@/lib/api-client';

export type JobStatusPayload = {
  jobId: string;
  name: string | null;
  status: string;
  progress: number | object | string | boolean;
  result: { kind: string; data?: unknown; fileName?: string; ready?: boolean } | null;
  error: string | null;
};

export type QueuedAck = { jobId: string; status: string };

export function isQueuedAck(value: unknown): value is QueuedAck {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.jobId === 'string' && typeof record.status === 'string' && !('rows' in record);
}

/** Poll GET /api/jobs/:id until completed or failed. Each request uses the 30s client timeout. */
export async function pollJobUntilDone(
  jobId: string,
  opts?: { intervalMs?: number; maxAttempts?: number },
): Promise<JobStatusPayload> {
  const intervalMs = opts?.intervalMs ?? 750;
  const maxAttempts = opts?.maxAttempts ?? 120;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const status = await apiGetData<JobStatusPayload>(`/api/jobs/${encodeURIComponent(jobId)}`);
    if (status.status === 'completed') return status;
    if (status.status === 'failed') {
      throw new ApiError(500, 'OPERATION_FAILED', status.error ?? 'Background job failed.');
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new ApiError(
    408,
    'TIMEOUT',
    'The operation is still processing. Check back shortly or try again.',
  );
}

/** Enqueue an export (202 JSON), poll, then download the finished file. */
export async function downloadQueuedExport(
  exportPath: string,
  fallbackFilename: string,
): Promise<void> {
  const ack = await apiGetData<QueuedAck>(exportPath);
  if (!ack?.jobId) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Export did not return a job id.');
  }
  if (ack.status !== 'completed') {
    await pollJobUntilDone(ack.jobId);
  }
  await apiDownloadBlob(`/api/jobs/${encodeURIComponent(ack.jobId)}/download`, fallbackFilename);
}

/** Resolve either an immediate import payload or a queued job result. */
export async function resolveImportResult<T>(payload: T | QueuedAck): Promise<T> {
  if (!isQueuedAck(payload)) return payload;
  const done = await pollJobUntilDone(payload.jobId);
  if (!done.result || done.result.kind !== 'import') {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Import finished without a result payload.');
  }
  return done.result.data as T;
}

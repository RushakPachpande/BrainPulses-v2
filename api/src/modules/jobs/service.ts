import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { forbidden, notFound } from '../../lib/errors.js';
import { getJobSnapshot } from '../../lib/queue/queues.js';
import type { ExportJobResult } from '../../lib/queue/types.js';

export async function getJobForActor(
  jobId: string,
  actor: { userId: string; organizationId: string },
) {
  const snap = await getJobSnapshot(jobId);
  if (snap.status === 'unknown' && snap.error === 'Job not found.') {
    throw notFound('Job not found.');
  }
  // SMS jobs have no org — only the owning user (or admin) can inspect non-org jobs.
  if (snap.organizationId && snap.organizationId !== actor.organizationId) {
    throw forbidden('You cannot access this job.');
  }
  if (!snap.organizationId && snap.userId && snap.userId !== actor.userId) {
    throw forbidden('You cannot access this job.');
  }
  return {
    jobId: snap.jobId,
    name: snap.name ?? null,
    status: snap.status,
    progress: snap.progress,
    result:
      snap.result && snap.result.kind !== 'export'
        ? snap.result
        : snap.result?.kind === 'export'
          ? {
              kind: 'export' as const,
              fileName: snap.result.fileName,
              contentType: snap.result.contentType,
              ready: true,
            }
          : null,
    error: snap.error,
  };
}

export async function openExportDownload(
  jobId: string,
  actor: { userId: string; organizationId: string },
): Promise<{ stream: NodeJS.ReadableStream; fileName: string; contentType: string }> {
  const snap = await getJobSnapshot(jobId);
  if (snap.status === 'unknown' && snap.error === 'Job not found.') {
    throw notFound('Job not found.');
  }
  if (snap.organizationId && snap.organizationId !== actor.organizationId) {
    throw forbidden('You cannot access this job.');
  }
  if (snap.status !== 'completed' || !snap.result || snap.result.kind !== 'export') {
    throw notFound('Export is not ready.');
  }
  const result = snap.result as ExportJobResult;
  try {
    await access(result.storagePath);
  } catch {
    throw notFound('Export file is no longer available.');
  }
  return {
    stream: createReadStream(result.storagePath),
    fileName: result.fileName,
    contentType: result.contentType,
  };
}

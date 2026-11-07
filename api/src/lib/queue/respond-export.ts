import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import type { Response } from 'express';
import type { EnqueuedJob } from './queues.js';

/**
 * When an export finished inline, stream the workbook in the same HTTP response.
 * Otherwise return 202 + job ack so the client can poll.
 */
export async function respondExportOrAck(res: Response, enqueued: EnqueuedJob): Promise<void> {
  if (enqueued.status === 'completed' && enqueued.result?.kind === 'export') {
    const result = enqueued.result;
    try {
      await access(result.storagePath);
    } catch {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Export file is no longer available.' },
      });
      return;
    }
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName.replace(/"/g, '')}"`,
    );
    createReadStream(result.storagePath).pipe(res);
    return;
  }

  res.status(202).json({
    data: {
      jobId: enqueued.jobId,
      status: enqueued.status === 'completed' ? 'completed' : 'queued',
    },
  });
}

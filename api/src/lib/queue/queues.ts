import { Queue, type JobsOptions } from 'bullmq';
import { env } from '../../config/env.js';
import { AppError } from '../errors.js';
import { isRedisReady } from '../redis.js';
import { bullmqConnection } from './connection.js';
import { processJobPayload } from './processors.js';
import {
  QUEUE_NAME,
  type JobName,
  type JobPayload,
  type JobResult,
  type JobStatus,
} from './types.js';

let queue: Queue<JobPayload, JobResult, JobName> | null = null;

/** In-memory results for QUEUE_INLINE / test mode so status + download still work. */
const inlineJobs = new Map<
  string,
  {
    name: JobName;
    status: JobStatus;
    result: JobResult | null;
    error: string | null;
    organizationId: string | null;
    userId: string | null;
  }
>();

export function getJobQueue(): Queue<JobPayload, JobResult, JobName> {
  if (!queue) {
    queue = new Queue<JobPayload, JobResult, JobName>(QUEUE_NAME, {
      connection: bullmqConnection(),
      defaultJobOptions: {
        attempts: env.QUEUE_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: env.QUEUE_BACKOFF_MS },
        removeOnComplete: { count: 200, age: 86_400 },
        removeOnFail: { count: 500, age: 7 * 86_400 },
      },
    });
  }
  return queue;
}

export async function closeJobQueue(): Promise<void> {
  if (!queue) return;
  await queue.close();
  queue = null;
}

function defaultJobOptions(jobId?: string): JobsOptions {
  return {
    jobId,
    attempts: env.QUEUE_JOB_ATTEMPTS,
    backoff: { type: 'exponential', delay: env.QUEUE_BACKOFF_MS },
  };
}

/** True when jobs should run in-process (tests / QUEUE_INLINE). */
export function useInlineQueue(): boolean {
  return env.QUEUE_INLINE || env.NODE_ENV === 'test';
}

async function assertCapacity(q: Queue<JobPayload, JobResult, JobName>) {
  const counts = await q.getJobCounts('waiting', 'delayed', 'active', 'paused');
  const depth =
    (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0) + (counts.paused ?? 0);
  if (depth >= env.QUEUE_MAX_WAITING) {
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'The job queue is at capacity. Try again shortly.',
    );
  }
}

export type EnqueuedJob = {
  jobId: string;
  status: 'queued' | 'completed';
  result?: JobResult;
};

/**
 * Enqueue a job (or run inline in test/inline mode).
 * SMS failures are swallowed by the caller; other jobs surface AppError.
 */
export async function enqueueJob(
  name: JobName,
  payload: JobPayload,
  opts?: { jobId?: string; priority?: number },
): Promise<EnqueuedJob> {
  if (useInlineQueue()) {
    const jobId = opts?.jobId ?? `inline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const organizationId =
      'organizationId' in payload && typeof payload.organizationId === 'string'
        ? payload.organizationId
        : null;
    const userId =
      'userId' in payload && typeof payload.userId === 'string'
        ? payload.userId
        : 'actor' in payload &&
            payload.actor &&
            'userId' in payload.actor &&
            typeof payload.actor.userId === 'string'
          ? payload.actor.userId
          : null;
    try {
      const result = await processJobPayload(payload, jobId);
      inlineJobs.set(jobId, {
        name,
        status: 'completed',
        result,
        error: null,
        organizationId,
        userId,
      });
      return { jobId, status: 'completed', result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Job failed.';
      inlineJobs.set(jobId, {
        name,
        status: 'failed',
        result: null,
        error: message,
        organizationId,
        userId,
      });
      throw err;
    }
  }

  if (!isRedisReady()) {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Background jobs require Redis.');
  }

  const q = getJobQueue();
  await assertCapacity(q);

  try {
    const job = await q.add(name, payload, {
      ...defaultJobOptions(opts?.jobId),
      priority: opts?.priority,
    });
    if (!job.id) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create background job.');
    }
    return { jobId: job.id, status: 'queued' };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const message = err instanceof Error ? err.message : 'Failed to enqueue job.';
    if (/Duplicat|already exists/i.test(message) && opts?.jobId) {
      return { jobId: opts.jobId, status: 'queued' };
    }
    throw new AppError(503, 'SERVICE_UNAVAILABLE', message);
  }
}

export function mapBullStatus(raw: string | undefined): JobStatus {
  switch (raw) {
    case 'waiting':
    case 'wait':
      return 'waiting';
    case 'active':
      return 'active';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'delayed':
      return 'delayed';
    default:
      return raw ? 'queued' : 'unknown';
  }
}

export async function getJobSnapshot(jobId: string): Promise<{
  jobId: string;
  name: string | undefined;
  status: JobStatus;
  progress: number | object | string | boolean;
  result: JobResult | null;
  error: string | null;
  organizationId: string | null;
  userId: string | null;
}> {
  if (useInlineQueue()) {
    const saved = inlineJobs.get(jobId);
    if (!saved) {
      return {
        jobId,
        name: undefined,
        status: 'unknown',
        progress: 0,
        result: null,
        error: 'Job not found.',
        organizationId: null,
        userId: null,
      };
    }
    return {
      jobId,
      name: saved.name,
      status: saved.status,
      progress: saved.status === 'completed' ? 100 : 0,
      result: saved.result,
      error: saved.error,
      organizationId: saved.organizationId,
      userId: saved.userId,
    };
  }

  const q = getJobQueue();
  const job = await q.getJob(jobId);
  if (!job) {
    return {
      jobId,
      name: undefined,
      status: 'unknown',
      progress: 0,
      result: null,
      error: 'Job not found.',
      organizationId: null,
      userId: null,
    };
  }

  const state = mapBullStatus(await job.getState());
  const data = job.data;
  const organizationId =
    'organizationId' in data && typeof data.organizationId === 'string'
      ? data.organizationId
      : null;
  const userId =
    'userId' in data && typeof data.userId === 'string'
      ? data.userId
      : 'actor' in data &&
          data.actor &&
          'userId' in data.actor &&
          typeof data.actor.userId === 'string'
        ? data.actor.userId
        : null;

  return {
    jobId,
    name: job.name,
    status: state,
    progress: job.progress,
    result: state === 'completed' ? ((job.returnvalue as JobResult | null) ?? null) : null,
    error: state === 'failed' ? (job.failedReason ?? 'Job failed.') : null,
    organizationId,
    userId,
  };
}

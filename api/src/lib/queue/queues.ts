import { Queue, type JobsOptions } from 'bullmq';
import { env } from '../../config/env.js';
import { AppError } from '../errors.js';
import { isRedisReady } from '../redis.js';
import { bullmqConnection } from './connection.js';
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

export const INLINE_JOB_CAP = 200;

/** Keep the newest inline results and drop the oldest once the cap is passed. */
export function rememberBounded<K, V>(map: Map<K, V>, key: K, value: V, cap: number): void {
  map.set(key, value);
  while (map.size > cap) {
    const oldest = map.keys().next().value;
    if (oldest === undefined || oldest === key) break;
    map.delete(oldest);
  }
}

/** OTP sends once. A retry would deliver the same code again after Twilio already accepted it. */
export function attemptsForJob(name: JobName, configured = env.QUEUE_JOB_ATTEMPTS): number {
  return name === 'sms.otp' ? 1 : configured;
}

/** Reject new work when the queue is already at its bound. Does not drop the queued jobs. */
export function assertQueueCapacity(depth: number, maxWaiting = env.QUEUE_MAX_WAITING): void {
  if (depth >= maxWaiting) {
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'The job queue is at capacity. Try again shortly.',
    );
  }
}

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

function defaultJobOptions(
  name: JobName,
  opts?: { jobId?: string; priority?: number },
): JobsOptions {
  return {
    jobId: opts?.jobId,
    attempts: attemptsForJob(name),
    backoff: { type: 'exponential', delay: env.QUEUE_BACKOFF_MS },
    priority: opts?.priority,
  };
}

/** True when jobs should run in-process (tests / QUEUE_INLINE). */
export function useInlineQueue(): boolean {
  return env.QUEUE_INLINE || env.NODE_ENV === 'test';
}

async function assertCapacity(q: Queue<JobPayload, JobResult, JobName>) {
  const counts = await q.getJobCounts('waiting', 'delayed', 'active');
  const depth = (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0);
  assertQueueCapacity(depth);
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
async function runInlineJob(
  name: JobName,
  payload: JobPayload,
  jobId: string,
): Promise<EnqueuedJob> {
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
    const { processJobPayload } = await import('./processors.js');
    const result = await processJobPayload(payload, jobId);
    rememberBounded(
      inlineJobs,
      jobId,
      {
        name,
        status: 'completed',
        result,
        error: null,
        organizationId,
        userId,
      },
      INLINE_JOB_CAP,
    );
    return { jobId, status: 'completed', result };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Job failed.';
    rememberBounded(
      inlineJobs,
      jobId,
      {
        name,
        status: 'failed',
        result: null,
        error: message,
        organizationId,
        userId,
      },
      INLINE_JOB_CAP,
    );
    throw err;
  }
}

export async function enqueueJob(
  name: JobName,
  payload: JobPayload,
  opts?: { jobId?: string; priority?: number; forceInline?: boolean },
): Promise<EnqueuedJob> {
  const jobId = opts?.jobId ?? `inline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // Report downloads complete in-process so admin does not depend on a separate worker.
  if (useInlineQueue() || opts?.forceInline) {
    return runInlineJob(name, payload, jobId);
  }

  if (!isRedisReady()) {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Background jobs require Redis.');
  }

  const q = getJobQueue();
  await assertCapacity(q);

  try {
    const job = await q.add(name, payload, defaultJobOptions(name, opts));
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
  // forceInline jobs are stored here even when Redis/BullMQ is otherwise enabled.
  const saved = inlineJobs.get(jobId);
  if (saved) {
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

  if (useInlineQueue()) {
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

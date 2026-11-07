import 'temporal-polyfill/full/global';
import { Worker, type Job } from 'bullmq';
import { env } from './config/env.js';
import { disconnectPrisma } from './lib/prisma.js';
import { closeJobQueue } from './lib/queue/queues.js';
import { bullmqConnection } from './lib/queue/connection.js';
import { processJobPayload } from './lib/queue/processors.js';
import { QUEUE_NAME, type JobName, type JobPayload, type JobResult } from './lib/queue/types.js';
import { closeRedis, initRedis, isRedisReady } from './lib/redis.js';

async function handleJob(job: Job<JobPayload, JobResult, JobName>): Promise<JobResult> {
  console.log(`[worker] start ${job.name} id=${job.id}`);
  const result = await processJobPayload(job.data, job.id ?? 'unknown');
  console.log(`[worker] done ${job.name} id=${job.id}`);
  return result;
}

async function main() {
  await initRedis();
  if (!isRedisReady()) {
    throw new Error('Redis must be ready before starting the worker.');
  }

  const worker = new Worker<JobPayload, JobResult, JobName>(QUEUE_NAME, handleJob, {
    connection: bullmqConnection(),
    concurrency: env.QUEUE_CONCURRENCY,
    lockDuration: env.QUEUE_JOB_TIMEOUT_MS,
  });

  worker.on('failed', (job, err) => {
    console.warn(`[worker] failed id=${job?.id} ${err.message}`);
  });

  console.log(
    `[worker] listening queue=${QUEUE_NAME} concurrency=${env.QUEUE_CONCURRENCY}`,
  );

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, draining`);
    await worker.close();
    await closeJobQueue();
    await closeRedis();
    await disconnectPrisma();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[worker] failed to start', err);
  process.exit(1);
});

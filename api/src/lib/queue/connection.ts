import { env } from '../../config/env.js';

/** BullMQ requires maxRetriesPerRequest: null on the Redis connection. */
export function bullmqConnection() {
  return {
    url: env.REDIS_URL,
    maxRetriesPerRequest: null as null,
  };
}

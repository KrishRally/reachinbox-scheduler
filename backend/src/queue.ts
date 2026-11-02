import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { config } from './config';

export const QUEUE_NAME = 'emails';
export const HOUR_MS = 3_600_000;

export const redis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export const emailQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export const jobOpts = (id: string, scheduledAt: Date) => ({
  name: 'send',
  data: { id },
  opts: { jobId: id, delay: Math.max(0, scheduledAt.getTime() - Date.now()) },
});

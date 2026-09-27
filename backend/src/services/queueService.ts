import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { BullMQJobData } from '../types';

export const EMAIL_QUEUE_NAME = 'email-scheduler';

export const emailQueue = new Queue<BullMQJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});

export async function scheduleEmail(
  data: BullMQJobData,
  scheduledAt: Date
): Promise<string> {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());

  const job = await emailQueue.add(
    'send-email',
    data,
    {
      delay,
      jobId: data.idempotencyKey, // Idempotency: same key = same job, no duplicates
    }
  );

  return job.id!;
}

export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
    emailQueue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}

import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { redisConnection } from './config/redis';
import { EMAIL_QUEUE_NAME } from './services/queueService';
import { sendEmail } from './services/emailService';
import { checkAndIncrementSenderLimit, checkGlobalLimit } from './services/rateLimitService';
import { updateEmailStatus, indexEmail } from './services/elasticService';
import { pool } from './db';
import { BullMQJobData } from './types';

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5');
const MIN_DELAY_MS = parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000');

console.log(`🚀 Starting email worker (concurrency: ${CONCURRENCY}, min delay: ${MIN_DELAY_MS}ms)`);

const worker = new Worker<BullMQJobData>(
  EMAIL_QUEUE_NAME,
  async (job: Job<BullMQJobData>) => {
    const { emailJobId, userId, senderEmail, recipientEmail, subject, body, idempotencyKey } = job.data;

    console.log(`📧 Processing job ${job.id} → ${recipientEmail}`);

    // Check idempotency — skip if already sent
    const existing = await pool.query(
      "SELECT status FROM email_jobs WHERE idempotency_key = $1",
      [idempotencyKey]
    );
    if (existing.rows[0]?.status === 'sent') {
      console.log(`⏭️  Skipping already-sent email: ${idempotencyKey}`);
      return { skipped: true };
    }

    // Check global rate limit
    const globalLimit = await checkGlobalLimit();
    if (!globalLimit.allowed) {
      console.log(`🚦 Global rate limit hit, delaying ${globalLimit.delayMs}ms`);
      await pool.query(
        "UPDATE email_jobs SET status = 'delayed' WHERE id = $1",
        [emailJobId]
      );
      // Re-add to queue with delay
      throw Object.assign(new Error('Global rate limit exceeded'), { delay: globalLimit.delayMs });
    }

    // Check per-sender rate limit
    const senderLimit = await checkAndIncrementSenderLimit(senderEmail, userId);
    if (!senderLimit.allowed) {
      console.log(`🚦 Sender rate limit hit for ${senderEmail}, delaying ${senderLimit.delayMs}ms`);
      await pool.query(
        "UPDATE email_jobs SET status = 'delayed' WHERE id = $1",
        [emailJobId]
      );
      throw Object.assign(new Error('Sender rate limit exceeded'), { delay: senderLimit.delayMs });
    }

    // Minimum delay between emails (throttle)
    await sleep(MIN_DELAY_MS);

    // Send the email
    const result = await sendEmail({
      from: senderEmail,
      to: recipientEmail,
      subject,
      html: `<div style="font-family:sans-serif">${body.replace(/\n/g, '<br>')}</div>`,
    });

    // Update DB status
    const sentAt = new Date();
    await pool.query(
      "UPDATE email_jobs SET status = 'sent', sent_at = $1 WHERE id = $2",
      [sentAt, emailJobId]
    );

    // Update batch counts
    await pool.query(
      `UPDATE email_batches 
       SET sent_count = sent_count + 1,
           status = CASE WHEN sent_count + 1 >= total_count THEN 'completed' ELSE status END
       WHERE id = (SELECT batch_id FROM email_jobs WHERE id = $1)`,
      [emailJobId]
    );

    // Update Elasticsearch
    await updateEmailStatus(emailJobId, 'sent', sentAt);

    console.log(`✅ Email sent to ${recipientEmail} (messageId: ${result.messageId})`);
    if (result.previewUrl) {
      console.log(`   Preview: ${result.previewUrl}`);
    }

    return { messageId: result.messageId, previewUrl: result.previewUrl };
  },
  {
    connection: redisConnection,
    concurrency: CONCURRENCY,
    limiter: {
      max: 10,
      duration: 1000, // Max 10 jobs/sec at worker level
    },
  }
);

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', async (job, err) => {
  if (!job) return;
  console.error(`❌ Job ${job.id} failed:`, err.message);

  const delay = (err as { delay?: number }).delay;

  if (delay) {
    // Rate-limited: re-queue with delay instead of marking as failed
    const { emailJobId, ...rest } = job.data;
    const { emailQueue } = await import('./services/queueService');
    await emailQueue.add('send-email', job.data, {
      delay,
      jobId: `retry-${job.data.idempotencyKey}-${Date.now()}`,
    });
    console.log(`⏰ Re-queued job for ${delay}ms later`);
  } else {
    // Real failure
    await pool.query(
      "UPDATE email_jobs SET status = 'failed', error_message = $1 WHERE id = $2",
      [err.message, job.data.emailJobId]
    );
    await updateEmailStatus(job.data.emailJobId, 'failed');
  }
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Worker shutting down...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Worker shutting down...');
  await worker.close();
  process.exit(0);
});

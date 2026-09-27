import { Router, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { scheduleEmail } from '../services/queueService';
import { indexEmail } from '../services/elasticService';
import { searchEmails } from '../services/elasticService';
import { pool } from '../db';
import { ScheduleEmailRequest } from '../types';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Schedule emails from CSV or recipients array
router.post('/schedule', authMiddleware, upload.single('csv'), async (req: AuthRequest, res: Response) => {
  try {
    let recipients: string[] = [];

    // Parse CSV if uploaded
    if (req.file) {
      const content = req.file.buffer.toString('utf-8');
      let parsed: string[][] | Record<string, string>[];
      try {
        parsed = parse(content, { skip_empty_lines: true, trim: true });
      } catch {
        parsed = content.split('\n').filter(Boolean).map(line => [line.trim()]);
      }

      for (const row of parsed as string[][]) {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const line = Array.isArray(row) ? row.join(' ') : String(row);
        const found = line.match(emailRegex);
        if (found) recipients.push(...found);
      }
      recipients = [...new Set(recipients)]; // deduplicate
    }

    // Also accept recipients from body
    const body: ScheduleEmailRequest = req.body;

if (body.recipients) {
  let bodyRecipients: string[] = [];

  if (typeof body.recipients === 'string') {
    try {
      bodyRecipients = JSON.parse(body.recipients);
    } catch {
      bodyRecipients = body.recipients
        .split(/[\n,;]/)
        .map((email) => email.trim())
        .filter(Boolean);
    }
  } else if (Array.isArray(body.recipients)) {
    bodyRecipients = body.recipients;
  }

  const validRecipients = bodyRecipients.filter((email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );

  recipients = [...new Set([...recipients, ...validRecipients])];
}

    if (!recipients.length) {
      res.status(400).json({ error: 'No valid email addresses found' });
      return;
    }

    const { subject, body: emailBody, senderEmail, startTime, delayBetweenEmailsMs = 2000, hourlyLimit = 50 } = body;

    if (!subject || !emailBody || !senderEmail || !startTime) {
      res.status(400).json({ error: 'subject, body, senderEmail, and startTime are required' });
      return;
    }

    const startDate = new Date(startTime);
    if (isNaN(startDate.getTime()) || startDate < new Date()) {
      res.status(400).json({ error: 'startTime must be a valid future date' });
      return;
    }

    // Create batch record
    const batchResult = await pool.query(
      `INSERT INTO email_batches (user_id, subject, body, sender_email, recipients, start_time, delay_between_emails_ms, hourly_limit, total_count, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending') RETURNING *`,
      [req.userId, subject, emailBody, senderEmail, JSON.stringify(recipients), startDate, delayBetweenEmailsMs, hourlyLimit, recipients.length]
    );
    const batch = batchResult.rows[0];

    // Schedule each email as a BullMQ delayed job
    const scheduledJobs = [];
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const scheduledAt = new Date(startDate.getTime() + i * delayBetweenEmailsMs);
      const idempotencyKey = `${req.userId}-${batch.id}-${recipient}-${scheduledAt.getTime()}`;

      // Insert email job record
      const jobResult = await pool.query(
        `INSERT INTO email_jobs (id, user_id, batch_id, sender_email, recipient_email, subject, body, scheduled_at, status, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9) RETURNING *`,
        [uuidv4(), req.userId, batch.id, senderEmail, recipient, subject, emailBody, scheduledAt, idempotencyKey]
      );
      const emailJob = jobResult.rows[0];

      // Schedule BullMQ job
      const bullJobId = await scheduleEmail(
        {
          emailJobId: emailJob.id,
          userId: req.userId!,
          senderEmail,
          recipientEmail: recipient,
          subject,
          body: emailBody,
          idempotencyKey,
          batchId: batch.id,
        },
        scheduledAt
      );

      // Update with BullMQ job ID
      await pool.query('UPDATE email_jobs SET bullmq_job_id = $1 WHERE id = $2', [bullJobId, emailJob.id]);

      // Index in Elasticsearch
      await indexEmail({ ...emailJob, bullmq_job_id: bullJobId });

      scheduledJobs.push({ id: emailJob.id, recipient, scheduledAt });
    }

    // Update batch as processing
    await pool.query("UPDATE email_batches SET status = 'processing', scheduled_count = $1 WHERE id = $2", [
      recipients.length, batch.id
    ]);

    res.status(201).json({
      message: `Successfully scheduled ${recipients.length} emails`,
      batchId: batch.id,
      totalScheduled: recipients.length,
      startTime: startDate,
      jobs: scheduledJobs.slice(0, 5), // Return first 5 as preview
    });
  } catch (err) {
    console.error('Schedule error:', err);
    res.status(500).json({ error: 'Failed to schedule emails' });
  }
});

// Get scheduled emails
router.get('/scheduled', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '20', search } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    if (search) {
      const results = await searchEmails(req.userId!, search as string, 'scheduled');
      res.json({ data: results, total: results.length, page: 1 });
      return;
    }

    const result = await pool.query(
      `SELECT * FROM email_jobs 
       WHERE user_id = $1 AND status IN ('scheduled', 'delayed')
       ORDER BY scheduled_at ASC
       LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );

    const count = await pool.query(
      "SELECT COUNT(*) FROM email_jobs WHERE user_id = $1 AND status IN ('scheduled', 'delayed')",
      [req.userId]
    );

    res.json({ data: result.rows, total: parseInt(count.rows[0].count), page: parseInt(page as string) });
  } catch (err) {
    console.error('Get scheduled error:', err);
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

// Get sent emails
router.get('/sent', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '20', search } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    if (search) {
      const results = await searchEmails(req.userId!, search as string, 'sent');
      res.json({ data: results, total: results.length, page: 1 });
      return;
    }

    const result = await pool.query(
      `SELECT * FROM email_jobs 
       WHERE user_id = $1 AND status IN ('sent', 'failed')
       ORDER BY sent_at DESC NULLS LAST, created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );

    const count = await pool.query(
      "SELECT COUNT(*) FROM email_jobs WHERE user_id = $1 AND status IN ('sent', 'failed')",
      [req.userId]
    );

    res.json({ data: result.rows, total: parseInt(count.rows[0].count), page: parseInt(page as string) });
  } catch (err) {
    console.error('Get sent error:', err);
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

// Get batches
router.get('/batches', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    'SELECT * FROM email_batches WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [req.userId]
  );
  res.json(result.rows);
});

// Search emails
router.get('/search', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { q, status } = req.query;
  if (!q) {
    res.status(400).json({ error: 'Query parameter q is required' });
    return;
  }
  const results = await searchEmails(req.userId!, q as string, status as string | undefined);
  res.json({ data: results, total: results.length });
});

// Stats
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    `SELECT 
      COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
      COUNT(*) FILTER (WHERE status = 'sent') as sent,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) FILTER (WHERE status = 'delayed') as delayed
     FROM email_jobs WHERE user_id = $1`,
    [req.userId]
  );
  res.json(result.rows[0]);
});

export default router;

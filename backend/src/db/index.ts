import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => console.log('✅ PostgreSQL connected'));
pool.on('error', (err) => console.error('❌ PostgreSQL error:', err));

export async function initDB(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        google_id VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        avatar TEXT,
        slack_token TEXT,
        slack_webhook TEXT,
        slack_channel VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS email_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        sender_email VARCHAR(255) NOT NULL,
        recipients JSONB NOT NULL DEFAULT '[]',
        start_time TIMESTAMPTZ NOT NULL,
        delay_between_emails_ms INTEGER NOT NULL DEFAULT 2000,
        hourly_limit INTEGER NOT NULL DEFAULT 50,
        total_count INTEGER NOT NULL DEFAULT 0,
        scheduled_count INTEGER NOT NULL DEFAULT 0,
        sent_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS email_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        batch_id UUID REFERENCES email_batches(id) ON DELETE SET NULL,
        sender_email VARCHAR(255) NOT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        scheduled_at TIMESTAMPTZ NOT NULL,
        sent_at TIMESTAMPTZ,
        status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
        bullmq_job_id VARCHAR(255),
        idempotency_key VARCHAR(255) UNIQUE NOT NULL,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_email_jobs_user_id ON email_jobs(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_jobs_status ON email_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_email_jobs_scheduled_at ON email_jobs(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_email_jobs_sender ON email_jobs(sender_email);
      CREATE INDEX IF NOT EXISTS idx_email_jobs_idempotency ON email_jobs(idempotency_key);
    `);
    console.log('✅ Database schema initialized');
  } finally {
    client.release();
  }
}

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  avatar: string;
  slack_token?: string;
  slack_webhook?: string;
  slack_channel?: string;
  created_at: Date;
}

export interface EmailJob {
  id: string;
  user_id: string;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body: string;
  scheduled_at: Date;
  sent_at?: Date;
  status: 'scheduled' | 'sent' | 'failed' | 'delayed';
  bullmq_job_id?: string;
  idempotency_key: string;
  error_message?: string;
  created_at: Date;
}

export interface EmailBatch {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  sender_email: string;
  recipients: string[];
  start_time: Date;
  delay_between_emails_ms: number;
  hourly_limit: number;
  total_count: number;
  scheduled_count: number;
  sent_count: number;
  failed_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: Date;
}

export interface BullMQJobData {
  emailJobId: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  idempotencyKey: string;
  batchId?: string;
}

export interface ScheduleEmailRequest {
  subject: string;
  body: string;
  senderEmail: string;
  recipients: string[];
  startTime: string;
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
}

export interface SearchResult {
  hits: EmailJob[];
  total: number;
}

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string;
      avatar: string;
    }
  }
}

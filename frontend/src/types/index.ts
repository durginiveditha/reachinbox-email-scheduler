export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  slack_connected: boolean;
}

export interface EmailJob {
  id: string;
  user_id: string;
  batch_id?: string;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body: string;
  scheduled_at: string;
  sent_at?: string;
  status: 'scheduled' | 'sent' | 'failed' | 'delayed';
  error_message?: string;
  created_at: string;
}

export interface EmailBatch {
  id: string;
  subject: string;
  body: string;
  sender_email: string;
  total_count: number;
  sent_count: number;
  failed_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

export interface EmailStats {
  scheduled: string;
  sent: string;
  failed: string;
  delayed: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
}

export interface ScheduleEmailPayload {
  subject: string;
  body: string;
  senderEmail: string;
  recipients?: string[];
  startTime: string;
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
}

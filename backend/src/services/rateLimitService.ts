import { redis } from '../config/redis';
import { notifySlackRateLimit } from './slackService';
import { pool } from '../db';

const MAX_EMAILS_PER_HOUR = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200');
const MAX_PER_SENDER = parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50');

function getHourWindow(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
}

function getNextHourMs(): number {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
  return nextHour.getTime() - now.getTime();
}

export async function checkAndIncrementSenderLimit(
  senderEmail: string,
  userId: string
): Promise<{ allowed: boolean; delayMs: number; currentCount: number; limit: number }> {
  const window = getHourWindow();
  const key = `rate:sender:${senderEmail}:${window}`;

  // Atomic increment + get using Redis pipeline
  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.ttl(key);
  const results = await pipeline.exec();

  const count = (results?.[0]?.[1] as number) ?? 0;
  const ttl = (results?.[1]?.[1] as number) ?? -1;

  // Set TTL if this is a fresh key (ttl == -1)
  if (ttl === -1) {
    await redis.expire(key, 3600);
  }

  if (count > MAX_PER_SENDER) {
    // Notify Slack if connected
    const userResult = await pool.query(
      'SELECT slack_token, slack_channel FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows[0]?.slack_token) {
      await notifySlackRateLimit(
        userResult.rows[0].slack_token,
        userResult.rows[0].slack_channel,
        senderEmail,
        count,
        MAX_PER_SENDER
      ).catch(console.error);
    }

    // Decrement since we over-counted
    await redis.decr(key);

    return {
      allowed: false,
      delayMs: getNextHourMs(),
      currentCount: count - 1,
      limit: MAX_PER_SENDER,
    };
  }

  return {
    allowed: true,
    delayMs: 0,
    currentCount: count,
    limit: MAX_PER_SENDER,
  };
}

export async function checkGlobalLimit(): Promise<{ allowed: boolean; delayMs: number }> {
  const window = getHourWindow();
  const key = `rate:global:${window}`;

  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.ttl(key);
  const results = await pipeline.exec();

  const count = (results?.[0]?.[1] as number) ?? 0;
  const ttl = (results?.[1]?.[1] as number) ?? -1;

  if (ttl === -1) {
    await redis.expire(key, 3600);
  }

  if (count > MAX_EMAILS_PER_HOUR) {
    await redis.decr(key);
    return { allowed: false, delayMs: getNextHourMs() };
  }

  return { allowed: true, delayMs: 0 };
}

export async function getSenderStats(senderEmail: string): Promise<{ count: number; limit: number; window: string }> {
  const window = getHourWindow();
  const key = `rate:sender:${senderEmail}:${window}`;
  const count = parseInt((await redis.get(key)) || '0');
  return { count, limit: MAX_PER_SENDER, window };
}

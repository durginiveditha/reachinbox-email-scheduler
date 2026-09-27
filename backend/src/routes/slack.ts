import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { exchangeSlackCode } from '../services/slackService';
import { getSenderStats } from '../services/rateLimitService';
import { pool } from '../db';

const router = Router();

// Redirect to Slack OAuth
router.get('/connect-url', authMiddleware, (req: AuthRequest, res: Response) => {
  const scopes = 'chat:write,incoming-webhook';
  const state = req.userId;

  const url =
    `https://slack.com/oauth/v2/authorize` +
    `?client_id=${process.env.SLACK_CLIENT_ID}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(process.env.SLACK_REDIRECT_URI || '')}` +
    `&state=${encodeURIComponent(state || '')}`;

  res.json({ url });
});

// Slack OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state: userId, error } = req.query;

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard?slack_error=${error}`);
  }

  try {
    const { token, channel, webhookUrl } = await exchangeSlackCode(code as string);
    await pool.query(
      'UPDATE users SET slack_token = $1, slack_channel = $2, slack_webhook = $3 WHERE id = $4',
      [token, channel, webhookUrl || null, userId]
    );
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?slack_connected=true`);
  } catch (err) {
    console.error('Slack callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?slack_error=exchange_failed`);
  }
});

// Disconnect Slack
router.delete('/disconnect', authMiddleware, async (req: AuthRequest, res: Response) => {
  await pool.query('UPDATE users SET slack_token = NULL, slack_channel = NULL, slack_webhook = NULL WHERE id = $1', [
    req.userId,
  ]);
  res.json({ message: 'Slack disconnected' });
});

// Get sender rate limit stats
router.get('/rate-stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { senderEmail } = req.query;
  if (!senderEmail) {
    res.status(400).json({ error: 'senderEmail is required' });
    return;
  }
  const stats = await getSenderStats(senderEmail as string);
  res.json(stats);
});

export default router;

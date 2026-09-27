import axios from 'axios';

export async function notifySlackRateLimit(
  token: string,
  channel: string,
  senderEmail: string,
  currentCount: number,
  limit: number
): Promise<void> {
  if (!token || !channel) return;

  try {
    await axios.post(
      'https://slack.com/api/chat.postMessage',
      {
        channel,
        text: `⚠️ *Rate Limit Hit*\nSender \`${senderEmail}\` has reached the hourly limit of *${limit} emails*.\nCurrent count: ${currentCount}. Emails will be delayed to the next hour.`,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    console.error('Failed to send Slack notification:', err);
  }
}

export async function exchangeSlackCode(code: string): Promise<{
  token: string;
  channel: string;
  webhookUrl?: string;
}> {
  const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
    params: {
      client_id: process.env.SLACK_CLIENT_ID,
      client_secret: process.env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: process.env.SLACK_REDIRECT_URI,
    },
  });

  const data = response.data;
  if (!data.ok) {
    throw new Error(`Slack OAuth failed: ${data.error}`);
  }

  return {
    token: data.access_token,
    channel: data.incoming_webhook?.channel_id || data.authed_user?.id,
    webhookUrl: data.incoming_webhook?.url,
  };
}

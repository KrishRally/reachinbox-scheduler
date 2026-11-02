import { pool } from './db';

// No-op (never throws) when the user has not connected Slack.
export async function notifyRateLimit(userId: number | null, sender: string, limit: number, resumeAt: Date) {
  if (!userId) return;
  try {
    const { rows } = await pool.query('select webhook_url from slack_connections where user_id=$1', [userId]);
    if (!rows[0]) return;
    const res = await fetch(rows[0].webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `:warning: Hourly limit reached for sender *${sender}* (${limit}/hour). Remaining emails are rescheduled to ${resumeAt.toISOString()}.`,
      }),
    });
    if (!res.ok) console.warn('[slack] webhook responded', res.status);
  } catch (e) {
    console.warn('[slack] notify failed:', (e as Error).message);
  }
}

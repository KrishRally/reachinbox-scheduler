import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config';
import { pool } from '../db';
import { requireAuth } from '../auth';
import { scheduleEmails } from '../scheduler';
import { searchEmails } from '../es';

export const apiRouter = Router();

const scheduleSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  emails: z.array(z.string().email()).min(1).max(10000),
  startTime: z.string().datetime(),
  delaySeconds: z.number().min(0),
  hourlyLimit: z.number().int().min(1),
});

// Slack OAuth callback is outside the cookie check; `state` is a signed JWT carrying the user id.
apiRouter.get('/slack/callback', async (req, res) => {
  const { code, state } = req.query as Record<string, string>;
  try {
    const { uid } = jwt.verify(state, config.jwtSecret) as { uid: number };
    const r = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: config.slackClientId, client_secret: config.slackClientSecret,
        redirect_uri: `${config.backendUrl}/api/slack/callback`,
      }),
    });
    const d: any = await r.json();
    if (!d.ok || !d.incoming_webhook?.url) throw new Error(d.error || 'no webhook');
    await pool.query(
      `insert into slack_connections(user_id,webhook_url,channel,team) values ($1,$2,$3,$4)
       on conflict (user_id) do update set webhook_url=$2, channel=$3, team=$4`,
      [uid, d.incoming_webhook.url, d.incoming_webhook.channel, d.team?.name]);
    res.redirect(`${config.frontendUrl}/dashboard?slack=connected`);
  } catch (e) {
    console.warn('[slack] oauth failed:', (e as Error).message);
    res.redirect(`${config.frontendUrl}/dashboard?slack=error`);
  }
});

apiRouter.use(requireAuth);

apiRouter.post('/schedule', async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  res.json(await scheduleEmails(req.userId!, parsed.data));
});

apiRouter.get('/emails', async (req, res) => {
  const sent = req.query.status === 'sent';
  const { rows } = await pool.query(
    `select id, recipient as email, subject, scheduled_at as "scheduledAt", sent_at as "sentAt",
            status, preview_url as "previewUrl", error
     from email_jobs where user_id=$1 and status = any($2)
     order by ${sent ? 'coalesce(sent_at, created_at) desc' : 'scheduled_at asc'} limit 500`,
    [req.userId, sent ? ['sent', 'failed'] : ['scheduled', 'sending']]);
  res.json(rows);
});

apiRouter.get('/emails/search', async (req, res) => {
  res.json(await searchEmails(req.userId!, String(req.query.q ?? '')));
});

apiRouter.get('/slack/status', async (req, res) => {
  const { rows } = await pool.query('select channel, team from slack_connections where user_id=$1', [req.userId]);
  res.json({ connected: !!rows[0], ...(rows[0] ?? {}) });
});

apiRouter.get('/slack/connect', (req, res) => {
  const state = jwt.sign({ uid: req.userId }, config.jwtSecret, { expiresIn: '10m' });
  const q = new URLSearchParams({
    client_id: config.slackClientId, scope: 'incoming-webhook', state,
    redirect_uri: `${config.backendUrl}/api/slack/callback`,
  });
  res.redirect(`https://slack.com/oauth/v2/authorize?${q}`);
});

apiRouter.delete('/slack', async (req, res) => {
  await pool.query('delete from slack_connections where user_id=$1', [req.userId]);
  res.json({ ok: true });
});

import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';
import { pool } from '../db';
import { requireAuth, signToken } from '../auth';

const client = () =>
  new OAuth2Client(config.googleClientId, config.googleClientSecret, `${config.backendUrl}/auth/google/callback`);

export const authRouter = Router();

authRouter.get('/google', (_req, res) => {
  res.redirect(client().generateAuthUrl({ scope: ['openid', 'email', 'profile'], prompt: 'select_account' }));
});

authRouter.get('/google/callback', async (req, res) => {
  const c = client();
  const { tokens } = await c.getToken(String(req.query.code));
  const ticket = await c.verifyIdToken({ idToken: tokens.id_token!, audience: config.googleClientId });
  const p = ticket.getPayload()!;
  const { rows } = await pool.query(
    `insert into users(google_id,email,name,avatar) values ($1,$2,$3,$4)
     on conflict (google_id) do update set email=$2, name=$3, avatar=$4 returning id`,
    [p.sub, p.email, p.name, p.picture]);
  res.cookie('token', signToken(rows[0].id), { httpOnly: true, sameSite: 'lax', maxAge: 7 * 864e5 });
  res.redirect(`${config.frontendUrl}/dashboard`);
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('select id,email,name,avatar from users where id=$1', [req.userId]);
  rows[0] ? res.json(rows[0]) : res.status(401).json({ error: 'Unauthorized' });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

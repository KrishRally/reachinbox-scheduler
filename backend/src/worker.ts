import nodemailer, { Transporter } from 'nodemailer';
import { DelayedError, Job, Worker } from 'bullmq';
import { config } from './config';
import { pool, migrate } from './db';
import { HOUR_MS, QUEUE_NAME, redis } from './queue';
import { updateEmail } from './es';
import { notifyRateLimit } from './slack';

const transports = new Map<number, Transporter>();
const transportFor = (r: any) => {
  if (!transports.has(r.sender_id)) {
    transports.set(r.sender_id, nodemailer.createTransport({
      host: r.host, port: r.port, auth: { user: r.smtp_user, pass: r.smtp_pass },
    }));
  }
  return transports.get(r.sender_id)!;
};

async function processor(job: Job, token?: string) {
  const { id } = job.data as { id: string };
  const { rows } = await pool.query(
    `select j.*, s.email as sender_email, s.smtp_user, s.smtp_pass, s.host, s.port
     from email_jobs j join senders s on s.id = j.sender_id where j.id = $1`, [id]);
  const row = rows[0];
  if (!row || row.status === 'sent' || row.status === 'failed') return; // idempotent no-op

  // Hourly rate limit: Redis counter per (sender, hour window), atomic across workers/instances.
  const windowStart = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
  const key = `rl:${row.sender_id}:${windowStart}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 2 * 3600);
  if (count > row.hourly_limit) {
    // Not dropped: push to next hour window, keeping original order via seq offset.
    const resumeAt = windowStart + HOUR_MS + (row.seq % 10000) * 10;
    if (await redis.set(`${key}:notified`, '1', 'EX', 7200, 'NX')) {
      void notifyRateLimit(row.user_id, row.sender_email, row.hourly_limit, new Date(windowStart + HOUR_MS));
    }
    await job.moveToDelayed(resumeAt, token);
    throw new DelayedError();
  }

  // Atomic claim: only one worker may send a given email (also reclaims crashed claims after 2 min).
  const claim = await pool.query(
    `update email_jobs set status='sending', claimed_at=now()
     where id=$1 and (status='scheduled' or (status='sending' and claimed_at < now() - interval '2 minutes'))
     returning id`, [id]);
  if (!claim.rowCount) return;

  try {
    const info = await transportFor(row).sendMail({
      from: row.sender_email, to: row.recipient, subject: row.subject, text: row.body,
    });
    const preview = nodemailer.getTestMessageUrl(info) || null;
    await pool.query(
      `update email_jobs set status='sent', sent_at=now(), preview_url=$2, error=null where id=$1`, [id, preview]);
    void updateEmail(id, { status: 'sent', sentAt: new Date().toISOString() });
  } catch (e) {
    const final = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    await pool.query(`update email_jobs set status=$2, error=$3 where id=$1`,
      [id, final ? 'failed' : 'scheduled', (e as Error).message]);
    if (final) void updateEmail(id, { status: 'failed' });
    throw e;
  }
}

export function startWorker() {
  const worker = new Worker(QUEUE_NAME, processor, {
    connection: redis,
    concurrency: config.workerConcurrency,
    // Global min delay between sends (shared across all worker instances via Redis).
    limiter: { max: 1, duration: config.minDelayMs },
  });
  worker.on('failed', (job, err) => console.warn(`[worker] ${job?.id} failed: ${err.message}`));
  console.log(`[worker] concurrency=${config.workerConcurrency} minDelay=${config.minDelayMs}ms`);
  return worker;
}

if (require.main === module) {
  migrate().then(startWorker);
}

import { randomUUID } from 'crypto';
import { pool } from './db';
import { emailQueue, jobOpts } from './queue';
import { ensureSenders } from './senders';
import { indexEmails } from './es';

export interface ScheduleInput {
  subject: string;
  body: string;
  emails: string[];
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
}

export async function scheduleEmails(userId: number, input: ScheduleInput) {
  const senders = await ensureSenders();
  const start = new Date(input.startTime).getTime();
  const rows = input.emails.map((recipient, i) => ({
    id: randomUUID(),
    recipient,
    seq: i,
    senderId: senders[i % senders.length].id,
    scheduledAt: new Date(start + i * input.delaySeconds * 1000),
  }));

  // 1) Persist first (source of truth), 2) enqueue delayed jobs with jobId = row id (idempotent).
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const r of rows) {
      await client.query(
        `insert into email_jobs(id,user_id,sender_id,recipient,subject,body,scheduled_at,hourly_limit,seq)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [r.id, userId, r.senderId, r.recipient, input.subject, input.body, r.scheduledAt, input.hourlyLimit, r.seq],
      );
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  await emailQueue.addBulk(rows.map((r) => jobOpts(r.id, r.scheduledAt)));
  await indexEmails(
    rows.map((r) => ({
      id: r.id, userId, recipient: r.recipient, subject: input.subject, body: input.body,
      status: 'scheduled', scheduledAt: r.scheduledAt.toISOString(),
    })),
  );
  return { count: rows.length };
}

// On boot: re-enqueue DB rows that have no queue job (e.g. Redis was wiped) and free stale claims.
export async function reconcile() {
  await pool.query(
    `update email_jobs set status='scheduled' where status='sending' and claimed_at < now() - interval '2 minutes'`,
  );
  const { rows } = await pool.query(`select id, scheduled_at from email_jobs where status='scheduled'`);
  let restored = 0;
  for (let i = 0; i < rows.length; i += 100) {
    await Promise.all(
      rows.slice(i, i + 100).map(async (r) => {
        if (!(await emailQueue.getJob(r.id))) {
          const j = jobOpts(r.id, r.scheduled_at);
          await emailQueue.add(j.name, j.data, j.opts);
          restored++;
        }
      }),
    );
  }
  if (restored) console.log(`[reconcile] re-enqueued ${restored} missing jobs`);
}

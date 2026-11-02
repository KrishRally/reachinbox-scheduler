import nodemailer from 'nodemailer';
import { pool } from './db';
import { config } from './config';

export interface Sender {
  id: number;
  email: string;
}

// Creates Ethereal SMTP accounts once; they are persisted so restarts reuse them.
export async function ensureSenders(): Promise<Sender[]> {
  const { rows } = await pool.query('select id, email from senders order by id');
  for (let i = rows.length; i < config.senderCount; i++) {
    const a = await nodemailer.createTestAccount();
    await pool.query(
      'insert into senders(email, smtp_user, smtp_pass, host, port) values ($1,$2,$3,$4,$5)',
      [a.user, a.user, a.pass, a.smtp.host, a.smtp.port],
    );
  }
  return (await pool.query('select id, email from senders order by id')).rows;
}

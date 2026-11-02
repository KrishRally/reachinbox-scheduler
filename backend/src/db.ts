import { Pool } from 'pg';
import { config } from './config';

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function migrate() {
  await pool.query(`
    create table if not exists users (
      id serial primary key,
      google_id text unique not null,
      email text not null,
      name text,
      avatar text,
      created_at timestamptz default now()
    );
    create table if not exists senders (
      id serial primary key,
      email text unique not null,
      smtp_user text not null,
      smtp_pass text not null,
      host text not null,
      port int not null
    );
    create table if not exists slack_connections (
      user_id int primary key references users(id) on delete cascade,
      webhook_url text not null,
      channel text,
      team text,
      created_at timestamptz default now()
    );
    create table if not exists email_jobs (
      id uuid primary key,
      user_id int references users(id),
      sender_id int references senders(id),
      recipient text not null,
      subject text not null,
      body text not null,
      scheduled_at timestamptz not null,
      hourly_limit int not null,
      seq int not null default 0,
      status text not null default 'scheduled',
      claimed_at timestamptz,
      sent_at timestamptz,
      preview_url text,
      error text,
      created_at timestamptz default now()
    );
    create index if not exists idx_email_jobs_user_status on email_jobs(user_id, status);
  `);
}

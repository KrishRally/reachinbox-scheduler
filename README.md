# Email Job Scheduler (ReachInbox assignment)

TypeScript · Express · BullMQ + Redis · Postgres · Ethereal SMTP · Elasticsearch · React + Tailwind

## Run it

```bash
docker compose up -d                 # Redis, Postgres, Elasticsearch

cd backend && cp .env.example .env   # fill in Google + Slack credentials
npm install && npm run dev           # API + worker on :4000

cd ../frontend && cp .env.example .env
npm install && npm run dev           # UI on :5173
```

- **Ethereal:** nothing to sign up for. On first boot the backend calls `nodemailer.createTestAccount()` `SENDER_COUNT` times and stores the SMTP credentials in the `senders` table. Every sent email has a preview link in the *Sent* tab.
- **Google OAuth:** Google Cloud Console → OAuth client (Web). Redirect URI: `http://localhost:4000/auth/google/callback`.
- **Slack OAuth:** api.slack.com/apps → create app → OAuth & Permissions → scope `incoming-webhook`, redirect URL `http://localhost:4000/api/slack/callback` (use an https tunnel such as ngrok and set `BACKEND_URL` if Slack rejects http).
- **Bull Board:** `http://localhost:4000/admin/queues` (login required).
- **Separate worker:** set `RUN_WORKER=false` on the API and run `npm run worker` as many times as you like.

## Deploy

The root `Dockerfile` builds the React frontend and serves it from the Express backend on the same HTTPS origin. `railway.json` configures this service for Railway.

1. Create Railway services for this app, PostgreSQL, Redis, and Elasticsearch (single-node, with security configured to match the `ELASTICSEARCH_URL` connection URL).
2. Set the app service variables: `DATABASE_URL`, `REDIS_URL`, `ELASTICSEARCH_URL`, `BACKEND_URL`, `FRONTEND_URL`, and a long random `JWT_SECRET`. Set `BACKEND_URL` and `FRONTEND_URL` to the app's public HTTPS URL.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. In Google Cloud Console, add `${BACKEND_URL}/auth/google/callback` as an authorized redirect URI.
4. For Slack integration, set `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`, then add `${BACKEND_URL}/api/slack/callback` as the Slack redirect URL.
5. Deploy the app service and open its generated public domain. The frontend and API share that domain, so login cookies work without cross-origin configuration.

Keep production credentials in the host's environment variable settings; never commit `.env` files or credentials to Git.

### Config (env)
| Var | Default | Meaning |
|---|---|---|
| `WORKER_CONCURRENCY` | 5 | parallel jobs per worker |
| `MIN_DELAY_MS` | 2000 | min gap between any two sends (global) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | 50 | default cap; the compose form sets the per-campaign value |
| `SENDER_COUNT` | 3 | Ethereal senders, used round-robin |

## How it works

**Scheduling.** `POST /api/schedule` writes one `email_jobs` row per recipient (Postgres = source of truth), then adds a BullMQ **delayed job** per row (`jobId` = row id). Recipient *i* is scheduled at `start + i × delay`. No cron anywhere.

**Persistence / restart.** Delayed jobs live in Redis (AOF on in docker-compose), so they survive restarts and fire at the right time. On boot, `reconcile()` re-enqueues any `scheduled` DB row missing from the queue (covers a wiped Redis) and releases stale `sending` claims.

**Idempotency.** `jobId` = row id (no duplicate enqueue), and the worker does an atomic `UPDATE … WHERE status='scheduled' RETURNING` claim before sending. Sent/failed rows are no-ops. A claim older than 2 minutes (crashed worker) can be re-claimed.

**Concurrency.** `WORKER_CONCURRENCY` jobs in parallel; safe because the DB claim and Redis counters are atomic.

**Delay between sends.** BullMQ `limiter: { max: 1, duration: MIN_DELAY_MS }` (Redis-backed, global across all worker instances). Default: 2 seconds.

**Hourly limit.** Redis `INCR rl:{sender}:{hourWindow}` (TTL 2h), atomic across workers/instances. If the count exceeds the limit, the job is **not dropped**: it is moved to the next hour window with `moveToDelayed` (+ `seq × 10ms` offset to keep original order). The limit comes from the compose form per campaign, with the env value as default.

**Slack alert.** On the first limit hit per sender per hour (Redis `SET NX` dedupe), the worker POSTs to the user's stored Slack incoming webhook. No Slack connection → silently skipped. Connecting later works immediately (webhook looked up at send time); disconnect deletes it.

**1000+ emails at once.** All are delayed jobs in Redis. The worker drains them at ≤ 1 send per `MIN_DELAY_MS`; per sender, anything beyond the hourly cap rolls into the next window(s) in order.

**Search.** Emails are indexed in Elasticsearch on schedule and updated on send/fail. `GET /api/emails/search?q=` (fuzzy over recipient/subject/body). Indexing is best-effort so an ES outage never blocks sending.

## Features
- Backend: scheduler, persistence, idempotency, concurrency, min delay, per-sender hourly limit, Slack OAuth + live alert, Elasticsearch search, Bull Board
- Frontend: Google login, header (name/email/avatar/logout), Scheduled + Sent tabs, Compose modal (subject, body, CSV upload with detected count, start time, delay, hourly limit), loading + empty + error states, toasts, Slack connect/disconnect

## Assumptions / trade-offs
- Figma was not available to me, so the UI follows the spec's layout, not pixel-matched.
- The hourly counter increments when a job is attempted in a window; a failed SMTP send still consumes a slot (conservative).
- If a worker crashes after SMTP accepted but before the DB update, the email can be re-sent after the 2-minute reclaim (at-least-once edge case).
- Rate-limited jobs wait until the next clock-hour boundary, not a rolling 60 minutes.
- Slack webhook URL is stored in plain text in Postgres.

import 'dotenv/config';

const num = (k: string, d: number) => Number(process.env[k] ?? d);

export const config = {
  port: num('PORT', 4000),
  backendUrl: process.env.BACKEND_URL ?? 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/scheduler',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  esUrl: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  slackClientId: process.env.SLACK_CLIENT_ID ?? '',
  slackClientSecret: process.env.SLACK_CLIENT_SECRET ?? '',
  workerConcurrency: num('WORKER_CONCURRENCY', 5),
  minDelayMs: num('MIN_DELAY_MS', 2000),
  maxEmailsPerHourPerSender: num('MAX_EMAILS_PER_HOUR_PER_SENDER', 50),
  senderCount: num('SENDER_COUNT', 3),
};

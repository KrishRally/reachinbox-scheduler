import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config';
import { migrate } from './db';
import { emailQueue } from './queue';
import { initEs } from './es';
import { ensureSenders } from './senders';
import { reconcile } from './scheduler';
import { requireAuth } from './auth';
import { authRouter } from './routes/auth';
import { apiRouter } from './routes/api';
import { startWorker } from './worker';
import path from 'node:path';

async function main() {
  await migrate();
  await ensureSenders();
  await initEs();
  await reconcile();

  const app = express();
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());

  const board = new ExpressAdapter();
  board.setBasePath('/admin/queues');
  createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter: board });
  app.use('/admin/queues', requireAuth, board.getRouter());

  app.use('/auth', authRouter);
  app.use('/api', apiRouter);
  if (process.env.NODE_ENV === 'production') {
    const frontendDist = path.resolve(__dirname, '../../public');
    app.use(express.static(frontendDist));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
  }
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

  app.listen(config.port, () => console.log(`API on :${config.port}  |  Bull Board: /admin/queues`));

  // Worker runs in-process by default; set RUN_WORKER=false and use `npm run worker` to scale it out.
  if (process.env.RUN_WORKER !== 'false') startWorker();
}

main().catch((e) => { console.error(e); process.exit(1); });

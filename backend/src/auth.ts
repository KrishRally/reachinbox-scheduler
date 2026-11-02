import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config';

declare global {
  namespace Express {
    interface Request { userId?: number }
  }
}

export const signToken = (uid: number) => jwt.sign({ uid }, config.jwtSecret, { expiresIn: '7d' });

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const p = jwt.verify(req.cookies?.token, config.jwtSecret) as { uid: number };
    req.userId = p.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

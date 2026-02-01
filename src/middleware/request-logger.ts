import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      accountId: (req as any).account?.id,
      agentId: (req as any).agent?.id,
    }, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
}

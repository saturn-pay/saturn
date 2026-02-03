import * as Sentry from '@sentry/node';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from './config/env.js';
import { testConnection } from './db/client.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { router } from './routes/index.js';
import { initAdapters } from './services/proxy/adapter-registry.js';
import { initCapabilities } from './services/proxy/capability-registry.js';
import { loadApprovedServices } from './services/registry.service.js';
import { runRateUpdate, startRateUpdater } from './jobs/rate-updater.js';
import { startInvoiceWatcher, stopInvoiceWatcher } from './jobs/invoice-watcher.js';
import { startInvoiceExpiryJob } from './jobs/invoice-expiry.js';
import { getPool } from './db/client.js';

// ---------------------------------------------------------------------------
// Sentry
// ---------------------------------------------------------------------------

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.2 : 1.0,
  });
  logger.info('Sentry initialized');
}

const app = express();

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

const defaultLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => (req.headers.authorization as string) || ipKeyGenerator(req.ip ?? 'unknown'),
  standardHeaders: true,
  legacyHeaders: false,
});

const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => (req.headers.authorization as string) || ipKeyGenerator(req.ip ?? 'unknown'),
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN || false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);
app.use(defaultLimiter);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/v1/capabilities', proxyLimiter);
app.use('/v1/proxy', proxyLimiter);
app.use('/v1', router);

app.use(errorHandler);

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

import type { Server } from 'http';

let server: Server | null = null;

async function start(): Promise<void> {
  try {
    await testConnection();
    logger.info('Database connected');

    initAdapters();
    logger.info('Service adapters initialized');

    initCapabilities();
    logger.info('Capability registry initialized');

    await loadApprovedServices();
    logger.info('Community services loaded');

    try {
      await runRateUpdate();
      logger.info('Initial rate update completed');
    } catch (err) {
      logger.warn({ err }, 'Initial rate update failed, using default rate');
    }

    startRateUpdater();
    logger.info('Rate updater started');

    const { verifyLndConnection } = await import('./lib/lnd-client.js');
    try {
      await verifyLndConnection();
      startInvoiceWatcher();
      logger.info('Invoice watcher started');
      startInvoiceExpiryJob();
      logger.info('Invoice expiry job started');
    } catch (err) {
      logger.warn({ err }, 'LND connection failed — Lightning features disabled until node is reachable');
    }

    server = app.listen(env.PORT, () => {
      logger.info(`Saturn listening on port ${env.PORT}`);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.fatal({ err, message, stack }, 'Failed to start server');
    console.error('FATAL: Failed to start server:', message);
    if (stack) console.error(stack);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received');

  // 1. Stop accepting new connections
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => resolve());
    });
    logger.info('HTTP server closed');
  }

  // 2. Stop LND subscription
  stopInvoiceWatcher();

  // 3. Close database pool
  await getPool().end();
  logger.info('Database pool closed');

  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

start();

export { app };

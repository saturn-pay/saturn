import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
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
import { startInvoiceWatcher } from './jobs/invoice-watcher.js';

const app = express();

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

const defaultLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => (req.headers.authorization as string) || req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
});

const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => (req.headers.authorization as string) || req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(helmet());
app.use(cors());
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

    try {
      startInvoiceWatcher();
      logger.info('Invoice watcher started');
    } catch (err) {
      logger.warn({ err }, 'Invoice watcher failed to start (LND may not be available)');
    }

    app.listen(env.PORT, () => {
      logger.info(`Saturn listening on port ${env.PORT}`);
    });
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

start();

export { app };

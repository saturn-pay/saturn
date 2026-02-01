import { Router } from 'express';
import { accountsRouter } from './accounts.router.js';
import { agentsRouter } from './agents.router.js';
import { policiesRouter } from './policies.router.js';
import { walletsRouter, agentWalletsRouter } from './wallets.router.js';
import { servicesRouter } from './services.router.js';
import { proxyRouter } from './proxy.router.js';
import { adminRouter } from './admin.router.js';

export const router = Router();

router.use('/accounts', accountsRouter);
router.use('/agents', agentsRouter);
router.use('/agents/:agentId/policy', policiesRouter);
router.use('/agents/:agentId/wallet', walletsRouter);
router.use('/wallet', agentWalletsRouter);
router.use('/services', servicesRouter);
router.use('/proxy', proxyRouter);
router.use('/admin', adminRouter);

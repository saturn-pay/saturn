import { Router } from 'express';
import { accountsRouter } from './accounts.router.js';
import { agentsRouter } from './agents.router.js';
import { policiesRouter } from './policies.router.js';
import { walletsRouter, agentWalletsRouter } from './wallets.router.js';
import { servicesRouter, capabilitiesCatalogRouter } from './services.router.js';
import { proxyRouter, capabilityRouter } from './proxy.router.js';
import { adminRouter } from './admin.router.js';
import { registryRouter } from './registry.router.js';
import { signupRouter } from './signup.router.js';

export const router = Router();

// Unauthenticated
router.use('/signup', signupRouter);

// Authenticated
router.use('/accounts', accountsRouter);
router.use('/agents', agentsRouter);
router.use('/agents/:agentId/policy', policiesRouter);
router.use('/agents/:agentId/wallet', walletsRouter);
router.use('/wallet', agentWalletsRouter);
router.use('/services', servicesRouter);
router.use('/capabilities', capabilitiesCatalogRouter);
router.use('/capabilities', capabilityRouter);
router.use('/proxy', proxyRouter);
router.use('/registry', registryRouter);
router.use('/admin', adminRouter);

import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { accounts, agents, wallets, policies } from '../db/schema/index.js';
import { generateId } from '../lib/id.js';
import { ID_PREFIXES, API_KEY_PREFIXES, DEFAULT_POLICY } from '../config/constants.js';
import { ValidationError } from '../lib/errors.js';

const BCRYPT_SALT_ROUNDS = 10;

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 signups per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many signup attempts, please try again later' },
});

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signupRouter = Router();

// POST /signup — open registration, creates account + primary agent
signupRouter.post('/', signupLimiter, async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid request body', parsed.error.flatten());
  }

  const { name, email, password } = parsed.data;

  // Check email uniqueness
  const [existing] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.email, email));

  if (existing) {
    throw new ValidationError('An account with this email already exists');
  }

  // Hash the password
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const rawApiKey = API_KEY_PREFIXES.agent + crypto.randomBytes(32).toString('hex');
  const apiKeyHash = await bcrypt.hash(rawApiKey, BCRYPT_SALT_ROUNDS);
  const apiKeyPrefix = crypto.createHash('sha256').update(rawApiKey).digest('hex').slice(0, 16);

  const accountId = generateId(ID_PREFIXES.account);
  const agentId = generateId(ID_PREFIXES.agent);
  const walletId = generateId(ID_PREFIXES.wallet);
  const policyId = generateId(ID_PREFIXES.policy);
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(accounts).values({
      id: accountId,
      name,
      email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(agents).values({
      id: agentId,
      accountId,
      name: 'Default Agent',
      apiKeyHash,
      apiKeyPrefix,
      email,
      role: 'primary',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(wallets).values({
      id: walletId,
      accountId,
      balanceSats: 0,
      heldSats: 0,
      lifetimeIn: 0,
      lifetimeOut: 0,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(policies).values({
      id: policyId,
      agentId,
      maxPerCallSats: DEFAULT_POLICY.maxPerCallSats,
      maxPerDaySats: DEFAULT_POLICY.maxPerDaySats,
      allowedServices: DEFAULT_POLICY.allowedServices,
      deniedServices: DEFAULT_POLICY.deniedServices,
      allowedCapabilities: DEFAULT_POLICY.allowedCapabilities,
      deniedCapabilities: DEFAULT_POLICY.deniedCapabilities,
      killSwitch: DEFAULT_POLICY.killSwitch,
      maxBalanceSats: DEFAULT_POLICY.maxBalanceSats,
      createdAt: now,
      updatedAt: now,
    });
  });

  res.status(201).json({
    agentId,
    apiKey: rawApiKey,
    accountId,
  });
});

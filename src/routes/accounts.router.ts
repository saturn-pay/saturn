import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../db/client.js';
import { accounts } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { generateId } from '../lib/id.js';
import { ID_PREFIXES, API_KEY_PREFIXES } from '../config/constants.js';
import { requireAccount } from '../middleware/auth.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

const BCRYPT_SALT_ROUNDS = 10;

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address'),
});

const updateAccountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email('Invalid email address').optional(),
}).refine((data) => data.name !== undefined || data.email !== undefined, {
  message: 'At least one of name or email must be provided',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateApiKey(): string {
  return API_KEY_PREFIXES.account + crypto.randomBytes(32).toString('hex');
}

function sanitizeAccount(account: typeof accounts.$inferSelect) {
  const { apiKeyHash, ...rest } = account;
  return rest;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const accountsRouter = Router();

// POST /accounts — create a new account
accountsRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid request body', parsed.error.flatten());
  }

  const { name, email } = parsed.data;

  const rawApiKey = generateApiKey();
  const apiKeyHash = await bcrypt.hash(rawApiKey, BCRYPT_SALT_ROUNDS);
  const id = generateId(ID_PREFIXES.account);
  const now = new Date();

  const [account] = await db
    .insert(accounts)
    .values({
      id,
      name,
      email,
      apiKeyHash,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  res.status(201).json({
    ...sanitizeAccount(account),
    apiKey: rawApiKey,
  });
});

// GET /accounts/me — get current account
accountsRouter.get('/me', requireAccount, async (req: Request, res: Response) => {
  const account = req.account!;

  // Re-fetch to get the freshest data
  const [fresh] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, account.id));

  if (!fresh) {
    throw new NotFoundError('Account', account.id);
  }

  res.json(sanitizeAccount(fresh));
});

// PATCH /accounts/me — update name and/or email
accountsRouter.patch('/me', requireAccount, async (req: Request, res: Response) => {
  const parsed = updateAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid request body', parsed.error.flatten());
  }

  const account = req.account!;
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (parsed.data.name !== undefined) {
    updates.name = parsed.data.name;
  }
  if (parsed.data.email !== undefined) {
    updates.email = parsed.data.email;
  }

  const [updated] = await db
    .update(accounts)
    .set(updates)
    .where(eq(accounts.id, account.id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Account', account.id);
  }

  res.json(sanitizeAccount(updated));
});

// POST /accounts/me/rotate-key — rotate API key
accountsRouter.post('/me/rotate-key', requireAccount, async (req: Request, res: Response) => {
  const account = req.account!;

  const rawApiKey = generateApiKey();
  const apiKeyHash = await bcrypt.hash(rawApiKey, BCRYPT_SALT_ROUNDS);

  const [updated] = await db
    .update(accounts)
    .set({ apiKeyHash, updatedAt: new Date() })
    .where(eq(accounts.id, account.id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Account', account.id);
  }

  res.json({
    ...sanitizeAccount(updated),
    apiKey: rawApiKey,
  });
});

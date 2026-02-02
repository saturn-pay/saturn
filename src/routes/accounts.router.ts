import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { accounts } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { requirePrimary } from '../middleware/auth.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const updateAccountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email('Invalid email address').optional(),
}).refine((data) => data.name !== undefined || data.email !== undefined, {
  message: 'At least one of name or email must be provided',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeAccount(account: typeof accounts.$inferSelect) {
  return account;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const accountsRouter = Router();

// All routes require primary agent auth
accountsRouter.use(requirePrimary);

// GET /accounts/me — get current account
accountsRouter.get('/me', async (req: Request, res: Response) => {
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
accountsRouter.patch('/me', async (req: Request, res: Response) => {
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

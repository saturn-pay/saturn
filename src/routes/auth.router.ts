import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { accounts, agents } from '../db/schema/index.js';
import { ValidationError, AuthError } from '../lib/errors.js';
import { env } from '../config/env.js';

const JWT_EXPIRES_IN = '7d';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const authRouter = Router();

// POST /auth/login — authenticate with email + password, returns JWT session token
authRouter.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid request body', parsed.error.flatten());
  }

  const { email, password } = parsed.data;

  // Find account by email
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, email));

  if (!account || !account.passwordHash) {
    throw new AuthError('Invalid email or password');
  }

  // Verify password
  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) {
    throw new AuthError('Invalid email or password');
  }

  // Get the primary agent for this account
  const [primaryAgent] = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.accountId, account.id),
        eq(agents.role, 'primary'),
        eq(agents.status, 'active'),
      ),
    );

  if (!primaryAgent) {
    throw new AuthError('No active primary agent found for this account');
  }

  // Generate JWT session token
  const token = jwt.sign(
    {
      accountId: account.id,
      agentId: primaryAgent.id,
      email: account.email,
    },
    env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  res.json({
    token,
    accountId: account.id,
    agentId: primaryAgent.id,
    name: account.name,
    email: account.email,
  });
});

// GET /auth/me — get current user from JWT token
authRouter.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as {
      accountId: string;
      agentId: string;
      email: string;
    };

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, payload.accountId));

    if (!account) {
      throw new AuthError('Account not found');
    }

    res.json({
      accountId: account.id,
      name: account.name,
      email: account.email,
      agentId: payload.agentId,
    });
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      throw new AuthError('Invalid or expired token');
    }
    throw err;
  }
});

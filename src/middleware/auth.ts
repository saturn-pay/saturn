import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import * as schema from '../db/schema/index.js';
import { AuthError, PolicyDeniedError } from '../lib/errors.js';
import { API_KEY_PREFIXES } from '../config/constants.js';
import { env } from '../config/env.js';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice(7);
}

/**
 * Tries to authenticate with API key (sk_agt_*).
 * Returns the matched agent or null if not an API key or invalid.
 */
async function tryApiKeyAuth(token: string): Promise<typeof schema.agents.$inferSelect | null> {
  if (!token.startsWith(API_KEY_PREFIXES.agent)) {
    return null;
  }

  // Fast lookup by SHA-256 prefix, then verify with bcrypt
  const prefix = crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
  const candidates = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.apiKeyPrefix, prefix));

  for (const agent of candidates) {
    const match = await bcrypt.compare(token, agent.apiKeyHash);
    if (match) {
      return agent;
    }
  }

  return null;
}

/**
 * Tries to authenticate with JWT token (for dashboard sessions).
 * Returns the primary agent for the account or null if invalid.
 */
async function tryJwtAuth(token: string): Promise<typeof schema.agents.$inferSelect | null> {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as {
      accountId: string;
      agentId: string;
    };

    // Get the primary agent for this account
    const [agent] = await db
      .select()
      .from(schema.agents)
      .where(
        and(
          eq(schema.agents.id, payload.agentId),
          eq(schema.agents.accountId, payload.accountId),
        ),
      );

    return agent || null;
  } catch {
    return null;
  }
}

/**
 * Authenticates via API key (sk_agt_*) or JWT session token.
 * Loads agent + parent account + wallet + policy onto the request.
 * Rejects if agent is suspended or killed.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AuthError();
    }

    // Try API key first, then JWT
    let matchedAgent = await tryApiKeyAuth(token);
    if (!matchedAgent) {
      matchedAgent = await tryJwtAuth(token);
    }

    if (!matchedAgent) {
      throw new AuthError();
    }

    if (matchedAgent.status === 'suspended' || matchedAgent.status === 'killed') {
      throw new AuthError('Agent is ' + matchedAgent.status);
    }

    req.agent = matchedAgent;

    // Load parent account
    const [account] = await db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.id, matchedAgent.accountId));

    if (!account) {
      throw new AuthError();
    }

    req.account = account;

    // Load wallet and policy in parallel
    const [walletRows, policyRows] = await Promise.all([
      db
        .select()
        .from(schema.wallets)
        .where(eq(schema.wallets.accountId, matchedAgent.accountId)),
      db
        .select()
        .from(schema.policies)
        .where(eq(schema.policies.agentId, matchedAgent.id)),
    ]);

    if (walletRows.length > 0) {
      req.wallet = walletRows[0];
    }

    if (policyRows.length > 0) {
      req.policy = policyRows[0];
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Requires primary agent authentication.
 * Calls requireAuth, then checks agent.role === 'primary'.
 * Returns 403 if not a primary agent.
 */
export async function requirePrimary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req, res, (err?: unknown) => {
    if (err) {
      return next(err);
    }

    if (req.agent?.role !== 'primary') {
      return next(new PolicyDeniedError('Primary agent key required'));
    }

    next();
  });
}

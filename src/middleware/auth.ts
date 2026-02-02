import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import * as schema from '../db/schema/index.js';
import { AuthError, PolicyDeniedError } from '../lib/errors.js';
import { API_KEY_PREFIXES } from '../config/constants.js';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice(7);
}

/**
 * Authenticates any `sk_agt_` key.
 * Uses a SHA-256 prefix for fast DB lookup, then bcrypt-verifies the single match.
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

    if (!token.startsWith(API_KEY_PREFIXES.agent)) {
      throw new AuthError();
    }

    // Fast lookup by SHA-256 prefix, then verify with bcrypt
    const prefix = crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
    const candidates = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.apiKeyPrefix, prefix));

    let matchedAgent = null;
    for (const agent of candidates) {
      const match = await bcrypt.compare(token, agent.apiKeyHash);
      if (match) {
        matchedAgent = agent;
        break;
      }
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
        .where(eq(schema.wallets.agentId, matchedAgent.id)),
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

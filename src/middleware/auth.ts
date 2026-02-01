import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import * as schema from '../db/schema/index.js';
import { AuthError } from '../lib/errors.js';
import { API_KEY_PREFIXES } from '../config/constants.js';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice(7);
}

function detectKeyType(token: string): 'account' | 'agent' | null {
  if (token.startsWith(API_KEY_PREFIXES.account)) {
    return 'account';
  }
  if (token.startsWith(API_KEY_PREFIXES.agent)) {
    return 'agent';
  }
  return null;
}

async function authenticateAccountKey(token: string, req: Request): Promise<boolean> {
  const rows = await db.select().from(schema.accounts).execute();

  for (const account of rows) {
    const match = await bcrypt.compare(token, account.apiKeyHash);
    if (match) {
      req.account = account;
      return true;
    }
  }

  return false;
}

async function authenticateAgentKey(token: string, req: Request): Promise<boolean> {
  const rows = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.status, 'active'))
    .execute();

  for (const agent of rows) {
    const match = await bcrypt.compare(token, agent.apiKeyHash);
    if (match) {
      req.agent = agent;

      // Load the parent account
      const [account] = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, agent.accountId));

      if (!account) {
        return false;
      }

      req.account = account;
      return true;
    }
  }

  return false;
}

/**
 * General authentication middleware.
 * Accepts both account keys (sk_acct_) and agent keys (sk_agt_).
 * Attaches req.account and optionally req.agent on success.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AuthError();
    }

    const keyType = detectKeyType(token);
    if (!keyType) {
      throw new AuthError();
    }

    let authenticated = false;

    if (keyType === 'account') {
      authenticated = await authenticateAccountKey(token, req);
    } else {
      authenticated = await authenticateAgentKey(token, req);
    }

    if (!authenticated) {
      throw new AuthError();
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Requires account-level authentication specifically.
 * Agent keys are rejected even if valid.
 */
export async function requireAccount(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AuthError();
    }

    const keyType = detectKeyType(token);
    if (keyType !== 'account') {
      throw new AuthError('Account-level API key required');
    }

    const authenticated = await authenticateAccountKey(token, req);
    if (!authenticated) {
      throw new AuthError();
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Requires agent-level authentication.
 * Also loads the agent's wallet and policy onto the request.
 */
export async function requireAgent(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AuthError();
    }

    const keyType = detectKeyType(token);
    if (keyType !== 'agent') {
      throw new AuthError('Agent-level API key required');
    }

    const authenticated = await authenticateAgentKey(token, req);
    if (!authenticated) {
      throw new AuthError();
    }

    const agent = req.agent!;

    // Load wallet and policy in parallel
    const [walletRows, policyRows] = await Promise.all([
      db
        .select()
        .from(schema.wallets)
        .where(eq(schema.wallets.agentId, agent.id)),
      db
        .select()
        .from(schema.policies)
        .where(eq(schema.policies.agentId, agent.id)),
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

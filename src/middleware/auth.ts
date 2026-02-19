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

// ---------------------------------------------------------------------------
// Auth cache — avoids bcrypt.compare (~100ms) and DB queries on every request
// ---------------------------------------------------------------------------

interface AuthCacheEntry {
  agent: typeof schema.agents.$inferSelect;
  account: typeof schema.accounts.$inferSelect;
  wallet: typeof schema.wallets.$inferSelect | null;
  policy: typeof schema.policies.$inferSelect | null;
  cachedAt: number;
}

const AUTH_CACHE_TTL_MS = 10_000; // 10 seconds
const AUTH_CACHE_MAX_SIZE = 1000; // Max entries to prevent memory bloat

const authCache = new Map<string, AuthCacheEntry>();

function getCachedAuth(tokenHash: string): AuthCacheEntry | null {
  const entry = authCache.get(tokenHash);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > AUTH_CACHE_TTL_MS) {
    authCache.delete(tokenHash);
    return null;
  }
  return entry;
}

function setCachedAuth(tokenHash: string, entry: Omit<AuthCacheEntry, 'cachedAt'>): void {
  // Evict oldest entries if cache is full
  if (authCache.size >= AUTH_CACHE_MAX_SIZE) {
    const firstKey = authCache.keys().next().value;
    if (firstKey) authCache.delete(firstKey);
  }
  authCache.set(tokenHash, { ...entry, cachedAt: Date.now() });
}

export function invalidateAuthCache(agentId: string): void {
  // Invalidate all entries for this agent (rare operation)
  for (const [key, entry] of authCache.entries()) {
    if (entry.agent.id === agentId) {
      authCache.delete(key);
    }
  }
}

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
 * Results are cached for 10 seconds to avoid bcrypt overhead.
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

    // Hash token for cache lookup (fast SHA-256, not slow bcrypt)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Check cache first
    const cached = getCachedAuth(tokenHash);
    if (cached) {
      // Recheck status (could have changed)
      if (cached.agent.status === 'suspended' || cached.agent.status === 'killed') {
        throw new AuthError('Agent is ' + cached.agent.status);
      }
      req.agent = cached.agent;
      req.account = cached.account;
      req.wallet = cached.wallet ?? undefined;
      req.policy = cached.policy ?? undefined;
      return next();
    }

    // Cache miss — do full auth (includes slow bcrypt.compare)
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

    const wallet = walletRows[0] ?? null;
    const policy = policyRows[0] ?? null;

    if (wallet) req.wallet = wallet;
    if (policy) req.policy = policy;

    // Cache the result
    setCachedAuth(tokenHash, {
      agent: matchedAgent,
      account,
      wallet,
      policy,
    });

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

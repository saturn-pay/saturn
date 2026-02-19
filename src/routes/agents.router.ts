import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../db/client.js';
import { agents, wallets, policies } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { generateId } from '../lib/id.js';
import { ID_PREFIXES, API_KEY_PREFIXES, DEFAULT_POLICY } from '../config/constants.js';
import { requirePrimary, invalidateAuthCache } from '../middleware/auth.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

const BCRYPT_SALT_ROUNDS = 10;

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0];
  return value ?? '';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateApiKey(): string {
  return API_KEY_PREFIXES.agent + crypto.randomBytes(32).toString('hex');
}

function sanitizeAgent(agent: typeof agents.$inferSelect) {
  const { apiKeyHash, apiKeyPrefix, ...rest } = agent;
  return rest;
}

async function findAgentOrThrow(agentId: string, accountId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.accountId, accountId)));

  if (!agent) {
    throw new NotFoundError('Agent', agentId);
  }

  return agent;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const agentsRouter = Router();

// All routes require primary agent auth
agentsRouter.use(requirePrimary);

// POST /agents — create a new worker agent with wallet and default policy
agentsRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid request body', parsed.error.flatten());
  }

  const account = req.account!;
  const { name, metadata } = parsed.data;

  const rawApiKey = generateApiKey();
  const apiKeyHash = await bcrypt.hash(rawApiKey, BCRYPT_SALT_ROUNDS);
  const apiKeyPrefix = crypto.createHash('sha256').update(rawApiKey).digest('hex').slice(0, 16);

  const agentId = generateId(ID_PREFIXES.agent);
  const policyId = generateId(ID_PREFIXES.policy);
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const [agent] = await tx
      .insert(agents)
      .values({
        id: agentId,
        accountId: account.id,
        name,
        apiKeyHash,
        apiKeyPrefix,
        role: 'worker',
        status: 'active',
        metadata: metadata ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [policy] = await tx
      .insert(policies)
      .values({
        id: policyId,
        agentId: agentId,
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
      })
      .returning();

    return { agent, policy };
  });

  res.status(201).json({
    ...sanitizeAgent(result.agent),
    apiKey: rawApiKey,
    policy: result.policy,
  });
});

// GET /agents — list agents for the current account (with wallet balance)
agentsRouter.get('/', async (req: Request, res: Response) => {
  const account = req.account!;

  const [accountWallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.accountId, account.id));

  const rows = await db
    .select()
    .from(agents)
    .where(eq(agents.accountId, account.id));

  const result = rows.map((row) => ({
    ...sanitizeAgent(row),
    balanceSats: accountWallet?.balanceSats ?? 0,
  }));

  res.json(result);
});

// GET /agents/:agentId — single agent detail
agentsRouter.get('/:agentId', async (req: Request, res: Response) => {
  const account = req.account!;
  const agent = await findAgentOrThrow(paramString(req.params.agentId), account.id);

  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.accountId, account.id));

  res.json({
    ...sanitizeAgent(agent),
    balanceSats: wallet?.balanceSats ?? 0,
  });
});

// PATCH /agents/:agentId — update name, metadata, or status
agentsRouter.patch('/:agentId', async (req: Request, res: Response) => {
  const parsed = updateAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid request body', parsed.error.flatten());
  }

  const account = req.account!;
  const agentId = paramString(req.params.agentId);
  await findAgentOrThrow(agentId, account.id);

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (parsed.data.name !== undefined) {
    updates.name = parsed.data.name;
  }
  if (parsed.data.metadata !== undefined) {
    updates.metadata = parsed.data.metadata;
  }
  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
  }

  const [updated] = await db
    .update(agents)
    .set(updates)
    .where(and(eq(agents.id, agentId), eq(agents.accountId, account.id)))
    .returning();

  if (!updated) {
    throw new NotFoundError('Agent', agentId);
  }

  // Invalidate auth cache if status changed
  if (parsed.data.status !== undefined) {
    invalidateAuthCache(agentId);
  }

  res.json(sanitizeAgent(updated));
});

// POST /agents/:agentId/regenerate — regenerate API key (invalidates old one)
agentsRouter.post('/:agentId/regenerate', async (req: Request, res: Response) => {
  const account = req.account!;
  const agent = await findAgentOrThrow(paramString(req.params.agentId), account.id);

  if (agent.status === 'killed') {
    throw new ValidationError('Cannot regenerate key for a revoked agent');
  }

  const rawApiKey = generateApiKey();
  const apiKeyHash = await bcrypt.hash(rawApiKey, BCRYPT_SALT_ROUNDS);
  const apiKeyPrefix = crypto.createHash('sha256').update(rawApiKey).digest('hex').slice(0, 16);

  const [updated] = await db
    .update(agents)
    .set({ apiKeyHash, apiKeyPrefix, updatedAt: new Date() })
    .where(eq(agents.id, agent.id))
    .returning();

  // Invalidate auth cache (old API key no longer valid)
  invalidateAuthCache(agent.id);

  res.json({
    ...sanitizeAgent(updated),
    apiKey: rawApiKey,
  });
});

// DELETE /agents/:agentId — soft delete (status=killed, policy kill_switch=true)
agentsRouter.delete('/:agentId', async (req: Request, res: Response) => {
  const account = req.account!;
  const agent = await findAgentOrThrow(paramString(req.params.agentId), account.id);

  if (agent.role === 'primary') {
    throw new ValidationError('Cannot revoke primary agent');
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(agents)
      .set({ status: 'killed', updatedAt: now })
      .where(eq(agents.id, agent.id));

    await tx
      .update(policies)
      .set({ killSwitch: true, updatedAt: now })
      .where(eq(policies.agentId, agent.id));
  });

  // Invalidate auth cache (agent is now killed)
  invalidateAuthCache(agent.id);

  res.status(204).end();
});

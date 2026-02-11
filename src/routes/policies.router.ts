import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { agents, policies } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { requirePrimary } from '../middleware/auth.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { usdCentsToSats, satsToUsdCents, getCurrentRate } from '../services/pricing.service.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const policyPutSchema = z.object({
  maxPerCallSats: z.number().int().positive().nullable(),
  maxPerDaySats: z.number().int().positive().nullable(),
  allowedServices: z.array(z.string()).nullable(),
  deniedServices: z.array(z.string()).nullable(),
  killSwitch: z.boolean().default(false),
  maxBalanceSats: z.number().int().positive().nullable(),
});

const policyPatchSchema = z.object({
  // Accept both sats and USD cents (USD cents take precedence if both provided)
  maxPerCallSats: z.number().int().positive().nullable().optional(),
  maxPerDaySats: z.number().int().positive().nullable().optional(),
  maxPerCallUsdCents: z.number().int().positive().nullable().optional(),
  maxPerDayUsdCents: z.number().int().positive().nullable().optional(),
  allowedServices: z.array(z.string()).nullable().optional(),
  deniedServices: z.array(z.string()).nullable().optional(),
  allowedCapabilities: z.array(z.string()).nullable().optional(),
  deniedCapabilities: z.array(z.string()).nullable().optional(),
  killSwitch: z.boolean().optional(),
  maxBalanceSats: z.number().int().positive().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0];
  return value ?? '';
}

async function verifyAgentOwnership(agentId: string, accountId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.accountId, accountId)));

  if (!agent) {
    throw new NotFoundError('Agent', agentId);
  }

  return agent;
}

async function findPolicyOrThrow(agentId: string) {
  const [policy] = await db
    .select()
    .from(policies)
    .where(eq(policies.agentId, agentId));

  if (!policy) {
    throw new NotFoundError('Policy for agent', agentId);
  }

  return policy;
}

/**
 * Enrich a policy with computed USD cents values for the frontend
 */
function enrichWithUsdCents(policy: typeof policies.$inferSelect) {
  const { btcUsd } = getCurrentRate();

  return {
    ...policy,
    // Add computed USD cents values
    maxPerCallUsdCents: policy.maxPerCallSats
      ? satsToUsdCents(policy.maxPerCallSats, btcUsd)
      : null,
    maxPerDayUsdCents: policy.maxPerDaySats
      ? satsToUsdCents(policy.maxPerDaySats, btcUsd)
      : null,
    maxBalanceUsdCents: policy.maxBalanceSats
      ? satsToUsdCents(policy.maxBalanceSats, btcUsd)
      : null,
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const policiesRouter = Router({ mergeParams: true });

// All routes require primary agent auth
policiesRouter.use(requirePrimary);

// GET /agents/:agentId/policy — get current policy
policiesRouter.get('/', async (req: Request, res: Response) => {
  const account = req.account!;
  const agentId = paramString(req.params.agentId);
  await verifyAgentOwnership(agentId, account.id);

  const policy = await findPolicyOrThrow(agentId);

  res.json(enrichWithUsdCents(policy));
});

// PUT /agents/:agentId/policy — replace entire policy
policiesRouter.put('/', async (req: Request, res: Response) => {
  const parsed = policyPutSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid request body', parsed.error.flatten());
  }

  const account = req.account!;
  const agentId = paramString(req.params.agentId);
  await verifyAgentOwnership(agentId, account.id);
  await findPolicyOrThrow(agentId);

  const now = new Date();

  const [updated] = await db
    .update(policies)
    .set({
      maxPerCallSats: parsed.data.maxPerCallSats,
      maxPerDaySats: parsed.data.maxPerDaySats,
      allowedServices: parsed.data.allowedServices,
      deniedServices: parsed.data.deniedServices,
      killSwitch: parsed.data.killSwitch,
      maxBalanceSats: parsed.data.maxBalanceSats,
      updatedAt: now,
    })
    .where(eq(policies.agentId, agentId))
    .returning();

  res.json(enrichWithUsdCents(updated));
});

// PATCH /agents/:agentId/policy — partial update
policiesRouter.patch('/', async (req: Request, res: Response) => {
  const parsed = policyPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid request body', parsed.error.flatten());
  }

  const account = req.account!;
  const agentId = paramString(req.params.agentId);
  await verifyAgentOwnership(agentId, account.id);
  await findPolicyOrThrow(agentId);

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  const data = parsed.data;
  const { btcUsd } = getCurrentRate();

  // USD cents take precedence over sats if both provided
  if (data.maxPerCallUsdCents !== undefined) {
    updates.maxPerCallSats = data.maxPerCallUsdCents === null
      ? null
      : usdCentsToSats(data.maxPerCallUsdCents, btcUsd);
  } else if (data.maxPerCallSats !== undefined) {
    updates.maxPerCallSats = data.maxPerCallSats;
  }

  if (data.maxPerDayUsdCents !== undefined) {
    updates.maxPerDaySats = data.maxPerDayUsdCents === null
      ? null
      : usdCentsToSats(data.maxPerDayUsdCents, btcUsd);
  } else if (data.maxPerDaySats !== undefined) {
    updates.maxPerDaySats = data.maxPerDaySats;
  }

  if (data.allowedServices !== undefined) updates.allowedServices = data.allowedServices;
  if (data.deniedServices !== undefined) updates.deniedServices = data.deniedServices;
  if (data.allowedCapabilities !== undefined) updates.allowedCapabilities = data.allowedCapabilities;
  if (data.deniedCapabilities !== undefined) updates.deniedCapabilities = data.deniedCapabilities;
  if (data.killSwitch !== undefined) updates.killSwitch = data.killSwitch;
  if (data.maxBalanceSats !== undefined) updates.maxBalanceSats = data.maxBalanceSats;

  const [updated] = await db
    .update(policies)
    .set(updates)
    .where(eq(policies.agentId, agentId))
    .returning();

  res.json(enrichWithUsdCents(updated));
});

// POST /agents/:agentId/kill — shortcut: sets kill_switch=true
policiesRouter.post('/kill', async (req: Request, res: Response) => {
  const account = req.account!;
  const agentId = paramString(req.params.agentId);
  await verifyAgentOwnership(agentId, account.id);

  const [updated] = await db
    .update(policies)
    .set({ killSwitch: true, updatedAt: new Date() })
    .where(eq(policies.agentId, agentId))
    .returning();

  res.json(enrichWithUsdCents(updated));
});

// POST /agents/:agentId/unkill — shortcut: sets kill_switch=false
policiesRouter.post('/unkill', async (req: Request, res: Response) => {
  const account = req.account!;
  const agentId = paramString(req.params.agentId);
  await verifyAgentOwnership(agentId, account.id);

  const [updated] = await db
    .update(policies)
    .set({ killSwitch: false, updatedAt: new Date() })
    .where(eq(policies.agentId, agentId))
    .returning();

  res.json(enrichWithUsdCents(updated));
});

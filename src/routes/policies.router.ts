import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { agents, policies } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { requireAccount } from '../middleware/auth.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

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
  maxPerCallSats: z.number().int().positive().nullable().optional(),
  maxPerDaySats: z.number().int().positive().nullable().optional(),
  allowedServices: z.array(z.string()).nullable().optional(),
  deniedServices: z.array(z.string()).nullable().optional(),
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

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const policiesRouter = Router({ mergeParams: true });

// All routes require account-level auth
policiesRouter.use(requireAccount);

// GET /agents/:agentId/policy — get current policy
policiesRouter.get('/', async (req: Request, res: Response) => {
  const account = req.account!;
  const agentId = paramString(req.params.agentId);
  await verifyAgentOwnership(agentId, account.id);

  const policy = await findPolicyOrThrow(agentId);

  res.json(policy);
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

  res.json(updated);
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
  if (data.maxPerCallSats !== undefined) updates.maxPerCallSats = data.maxPerCallSats;
  if (data.maxPerDaySats !== undefined) updates.maxPerDaySats = data.maxPerDaySats;
  if (data.allowedServices !== undefined) updates.allowedServices = data.allowedServices;
  if (data.deniedServices !== undefined) updates.deniedServices = data.deniedServices;
  if (data.killSwitch !== undefined) updates.killSwitch = data.killSwitch;
  if (data.maxBalanceSats !== undefined) updates.maxBalanceSats = data.maxBalanceSats;

  const [updated] = await db
    .update(policies)
    .set(updates)
    .where(eq(policies.agentId, agentId))
    .returning();

  res.json(updated);
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

  res.json(updated);
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

  res.json(updated);
});

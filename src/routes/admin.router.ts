import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import {
  accounts,
  agents,
  wallets,
  transactions,
  auditLogs,
  rateSnapshots,
  serviceSubmissions,
} from '../db/schema/index.js';
import { eq, and, gte, lte, sql, desc, count, sum, avg } from 'drizzle-orm';
import { requirePrimary } from '../middleware/auth.js';
import { getCurrentRate } from '../services/pricing.service.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { approveSubmission, rejectSubmission } from '../services/registry.service.js';
import { generateId } from '../lib/id.js';
import { ID_PREFIXES } from '../config/constants.js';

function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0];
  return value ?? '';
}

export const adminRouter = Router();

adminRouter.use(requirePrimary);

// ---------------------------------------------------------------------------
// GET /stats
// ---------------------------------------------------------------------------

adminRouter.get('/stats', async (req: Request, res: Response) => {
  const accountId = req.account!.id;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // Convert sats to USD cents (fallback for old data without USD cents)
  const satsToUsdCents = (sats: number) => Math.round(sats * 0.04);

  // Total volume from wallets belonging to this account
  const [volumeRow] = await db
    .select({
      satsIn: sum(wallets.lifetimeIn),
      satsOut: sum(wallets.lifetimeOut),
      usdCentsIn: sum(wallets.lifetimeInUsdCents),
      usdCentsOut: sum(wallets.lifetimeOutUsdCents),
    })
    .from(wallets)
    .where(eq(wallets.accountId, accountId));

  // Today's spend from audit_logs
  const [todaySpendRow] = await db
    .select({
      sats: sum(auditLogs.chargedSats),
      usdCents: sum(auditLogs.chargedUsdCents),
    })
    .from(auditLogs)
    .innerJoin(agents, eq(auditLogs.agentId, agents.id))
    .where(
      and(
        eq(agents.accountId, accountId),
        gte(auditLogs.createdAt, todayStart)
      )
    );

  const todaySats = Number(todaySpendRow?.sats ?? 0);
  const todayUsdCentsRaw = Number(todaySpendRow?.usdCents ?? 0);
  const todaySpendUsdCents = todayUsdCentsRaw > 0 ? todayUsdCentsRaw : satsToUsdCents(todaySats);

  // Active agents count
  const [agentCountRow] = await db
    .select({ count: count() })
    .from(agents)
    .where(and(eq(agents.accountId, accountId), eq(agents.status, 'active')));

  // Total API calls count from audit_logs
  const [apiCallsRow] = await db
    .select({ count: count() })
    .from(auditLogs)
    .innerJoin(agents, eq(auditLogs.agentId, agents.id))
    .where(eq(agents.accountId, accountId));

  // Revenue estimate: sum of charged_sats from audit_logs for this account's agents
  const [revenueRow] = await db
    .select({ revenue: sum(auditLogs.chargedSats) })
    .from(auditLogs)
    .innerJoin(agents, eq(auditLogs.agentId, agents.id))
    .where(eq(agents.accountId, accountId));

  res.json({
    satsIn: Number(volumeRow?.satsIn ?? 0),
    satsOut: Number(volumeRow?.satsOut ?? 0),
    usdCentsIn: Number(volumeRow?.usdCentsIn ?? 0),
    usdCentsOut: Number(volumeRow?.usdCentsOut ?? 0),
    todaySpendUsdCents,
    activeAgents: agentCountRow?.count ?? 0,
    totalApiCalls: apiCallsRow?.count ?? 0,
    revenueEstimateSats: Number(revenueRow?.revenue ?? 0),
  });
});

// ---------------------------------------------------------------------------
// GET /agents
// ---------------------------------------------------------------------------

adminRouter.get('/agents', async (req: Request, res: Response) => {
  const accountId = req.account!.id;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [accountWallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.accountId, accountId));

  const agentRows = await db
    .select({
      id: agents.id,
      name: agents.name,
      status: agents.status,
      metadata: agents.metadata,
      createdAt: agents.createdAt,
      updatedAt: agents.updatedAt,
    })
    .from(agents)
    .where(eq(agents.accountId, accountId))
    .orderBy(desc(agents.createdAt));

  // Today's spend per agent
  const todaySpend = await db
    .select({
      agentId: auditLogs.agentId,
      spendSats: sum(auditLogs.chargedSats),
      spendUsdCents: sum(auditLogs.chargedUsdCents),
    })
    .from(auditLogs)
    .innerJoin(agents, eq(auditLogs.agentId, agents.id))
    .where(
      and(
        eq(agents.accountId, accountId),
        gte(auditLogs.createdAt, todayStart),
      ),
    )
    .groupBy(auditLogs.agentId);

  const todaySpendMap = new Map(
    todaySpend.map((r) => [r.agentId, {
      sats: Number(r.spendSats ?? 0),
      usdCents: Number(r.spendUsdCents ?? 0),
    }]),
  );

  // Lifetime spend per agent
  const lifetimeSpend = await db
    .select({
      agentId: auditLogs.agentId,
      spendSats: sum(auditLogs.chargedSats),
      spendUsdCents: sum(auditLogs.chargedUsdCents),
      callCount: count(),
    })
    .from(auditLogs)
    .innerJoin(agents, eq(auditLogs.agentId, agents.id))
    .where(eq(agents.accountId, accountId))
    .groupBy(auditLogs.agentId);

  const lifetimeSpendMap = new Map(
    lifetimeSpend.map((r) => [r.agentId, {
      sats: Number(r.spendSats ?? 0),
      usdCents: Number(r.spendUsdCents ?? 0),
      calls: Number(r.callCount ?? 0),
    }]),
  );

  // Convert sats to USD cents (fallback for old data without USD cents)
  // Using approximate rate: 1 sat ≈ $0.0004 at ~$40k BTC
  const satsToUsdCents = (sats: number) => Math.round(sats * 0.04);

  const result = agentRows.map((row) => {
    const today = todaySpendMap.get(row.id) ?? { sats: 0, usdCents: 0 };
    const lifetime = lifetimeSpendMap.get(row.id) ?? { sats: 0, usdCents: 0, calls: 0 };

    // Use USD cents if available, otherwise convert from sats
    const todayUsdCents = today.usdCents > 0 ? today.usdCents : satsToUsdCents(today.sats);
    const lifetimeUsdCents = lifetime.usdCents > 0 ? lifetime.usdCents : satsToUsdCents(lifetime.sats);

    return {
      ...row,
      role: 'worker' as const,
      // Account-level balance (shared)
      balanceSats: accountWallet?.balanceSats ?? 0,
      heldSats: accountWallet?.heldSats ?? 0,
      balanceUsdCents: accountWallet?.balanceUsdCents ?? 0,
      heldUsdCents: accountWallet?.heldUsdCents ?? 0,
      // Per-agent lifetime stats
      lifetimeIn: 0,
      lifetimeOut: lifetime.sats,
      lifetimeInUsdCents: 0,
      lifetimeOutUsdCents: lifetimeUsdCents,
      // Per-agent today stats
      todaySpendSats: today.sats,
      todaySpendUsdCents: todayUsdCents,
      // Per-agent call count
      totalCalls: lifetime.calls,
    };
  });

  res.json(result);
});

// ---------------------------------------------------------------------------
// GET /transactions
// ---------------------------------------------------------------------------

adminRouter.get('/transactions', async (req: Request, res: Response) => {
  const accountId = req.account!.id;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const agentId = req.query.agent_id as string | undefined;
  const type = req.query.type as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const conditions = [eq(wallets.accountId, accountId)];

  if (agentId) {
    conditions.push(eq(transactions.agentId, agentId));
  }
  if (type) {
    conditions.push(eq(transactions.type, type as any));
  }
  if (from) {
    conditions.push(gte(transactions.createdAt, new Date(from)));
  }
  if (to) {
    conditions.push(lte(transactions.createdAt, new Date(to)));
  }

  const rows = await db
    .select({
      id: transactions.id,
      walletId: transactions.walletId,
      agentId: transactions.agentId,
      type: transactions.type,
      amountSats: transactions.amountSats,
      balanceAfter: transactions.balanceAfter,
      referenceType: transactions.referenceType,
      referenceId: transactions.referenceId,
      description: transactions.description,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(wallets, eq(transactions.walletId, wallets.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: count() })
    .from(transactions)
    .innerJoin(wallets, eq(transactions.walletId, wallets.id))
    .where(and(...conditions));

  res.json({
    data: rows,
    total: totalRow?.count ?? 0,
    limit,
    offset,
  });
});

// ---------------------------------------------------------------------------
// GET /audit-logs
// ---------------------------------------------------------------------------

adminRouter.get('/audit-logs', async (req: Request, res: Response) => {
  const accountId = req.account!.id;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const agentId = req.query.agent_id as string | undefined;
  const serviceSlug = req.query.service_slug as string | undefined;
  const policyResult = req.query.policy_result as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const conditions = [eq(agents.accountId, accountId)];

  if (agentId) {
    conditions.push(eq(auditLogs.agentId, agentId));
  }
  if (serviceSlug) {
    conditions.push(eq(auditLogs.serviceSlug, serviceSlug));
  }
  if (policyResult) {
    conditions.push(eq(auditLogs.policyResult, policyResult as any));
  }
  if (from) {
    conditions.push(gte(auditLogs.createdAt, new Date(from)));
  }
  if (to) {
    conditions.push(lte(auditLogs.createdAt, new Date(to)));
  }

  const rows = await db
    .select({
      id: auditLogs.id,
      agentId: auditLogs.agentId,
      serviceSlug: auditLogs.serviceSlug,
      capability: auditLogs.capability,
      operation: auditLogs.operation,
      policyResult: auditLogs.policyResult,
      policyReason: auditLogs.policyReason,
      quotedSats: auditLogs.quotedSats,
      chargedSats: auditLogs.chargedSats,
      quotedUsdCents: auditLogs.quotedUsdCents,
      chargedUsdCents: auditLogs.chargedUsdCents,
      upstreamStatus: auditLogs.upstreamStatus,
      upstreamLatencyMs: auditLogs.upstreamLatencyMs,
      error: auditLogs.error,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .innerJoin(agents, eq(auditLogs.agentId, agents.id))
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: count() })
    .from(auditLogs)
    .innerJoin(agents, eq(auditLogs.agentId, agents.id))
    .where(and(...conditions));

  res.json({
    data: rows,
    total: totalRow?.count ?? 0,
    limit,
    offset,
  });
});

// ---------------------------------------------------------------------------
// GET /audit-logs/:id
// ---------------------------------------------------------------------------

adminRouter.get('/audit-logs/:id', async (req: Request, res: Response) => {
  const accountId = req.account!.id;
  const logId = paramString(req.params.id);

  const [row] = await db
    .select()
    .from(auditLogs)
    .innerJoin(agents, eq(auditLogs.agentId, agents.id))
    .where(and(eq(auditLogs.id, logId), eq(agents.accountId, accountId)));

  if (!row) {
    throw new NotFoundError('Audit log', logId);
  }

  res.json(row.audit_logs);
});

// ---------------------------------------------------------------------------
// GET /services/health
// ---------------------------------------------------------------------------

adminRouter.get('/services/health', async (req: Request, res: Response) => {
  const accountId = req.account!.id;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      serviceSlug: auditLogs.serviceSlug,
      callCount: count(),
      avgLatencyMs: avg(auditLogs.upstreamLatencyMs),
      errorCount: count(
        sql`CASE WHEN ${auditLogs.upstreamStatus} >= 400 OR ${auditLogs.error} IS NOT NULL THEN 1 END`,
      ),
    })
    .from(auditLogs)
    .innerJoin(agents, eq(auditLogs.agentId, agents.id))
    .where(
      and(
        eq(agents.accountId, accountId),
        gte(auditLogs.createdAt, since),
      ),
    )
    .groupBy(auditLogs.serviceSlug);

  const result = rows.map((r) => ({
    serviceSlug: r.serviceSlug,
    callCount: r.callCount,
    avgLatencyMs: r.avgLatencyMs ? Math.round(Number(r.avgLatencyMs)) : null,
    errorRate:
      r.callCount > 0
        ? Number(r.errorCount) / Number(r.callCount)
        : 0,
  }));

  res.json(result);
});

// ---------------------------------------------------------------------------
// GET /rates
// ---------------------------------------------------------------------------

adminRouter.get('/rates', async (_req: Request, res: Response) => {
  const current = getCurrentRate();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const history = await db
    .select()
    .from(rateSnapshots)
    .where(gte(rateSnapshots.fetchedAt, since))
    .orderBy(desc(rateSnapshots.fetchedAt));

  res.json({
    current,
    history,
  });
});

// ---------------------------------------------------------------------------
// GET /registry/submissions — list all submissions (optionally filter by status)
// ---------------------------------------------------------------------------

adminRouter.get('/registry/submissions', async (req: Request, res: Response) => {
  const accountId = req.account!.id;
  const status = req.query.status as string | undefined;

  const conditions = [eq(serviceSubmissions.accountId, accountId)];
  if (status) {
    conditions.push(eq(serviceSubmissions.status, status as any));
  }

  const rows = await db
    .select()
    .from(serviceSubmissions)
    .where(and(...conditions))
    .orderBy(desc(serviceSubmissions.createdAt));

  res.json(rows);
});

// ---------------------------------------------------------------------------
// GET /registry/submissions/:id — single submission detail
// ---------------------------------------------------------------------------

adminRouter.get('/registry/submissions/:id', async (req: Request, res: Response) => {
  const accountId = req.account!.id;
  const submissionId = paramString(req.params.id);

  const [submission] = await db
    .select()
    .from(serviceSubmissions)
    .where(and(eq(serviceSubmissions.id, submissionId), eq(serviceSubmissions.accountId, accountId)));

  if (!submission) {
    throw new NotFoundError('Submission', submissionId);
  }

  res.json(submission);
});

// ---------------------------------------------------------------------------
// PATCH /registry/submissions/:id — approve or reject
// ---------------------------------------------------------------------------

adminRouter.patch('/registry/submissions/:id', async (req: Request, res: Response) => {
  const accountId = req.account!.id;
  const submissionId = paramString(req.params.id);
  const { status, reviewerNotes } = req.body;

  if (!status || !['approved', 'rejected'].includes(status)) {
    throw new ValidationError('status must be "approved" or "rejected"');
  }

  // Verify ownership before approving/rejecting
  const [submission] = await db
    .select()
    .from(serviceSubmissions)
    .where(and(eq(serviceSubmissions.id, submissionId), eq(serviceSubmissions.accountId, accountId)));

  if (!submission) {
    throw new NotFoundError('Submission', submissionId);
  }

  if (status === 'approved') {
    await approveSubmission(submissionId, reviewerNotes);
  } else {
    await rejectSubmission(submissionId, reviewerNotes);
  }

  const [updated] = await db
    .select()
    .from(serviceSubmissions)
    .where(eq(serviceSubmissions.id, submissionId));

  res.json(updated);
});

// ---------------------------------------------------------------------------
// POST /wallet/credit — Admin: credit USD to wallet (for testing/demos)
// ---------------------------------------------------------------------------

const creditSchema = z.object({
  amountUsdCents: z.number().int().positive(),
  description: z.string().optional(),
});

adminRouter.post('/wallet/credit', async (req: Request, res: Response) => {
  const accountId = req.account!.id;

  const parsed = creditSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid request body', parsed.error.flatten());
  }

  const { amountUsdCents, description } = parsed.data;

  // Find the account's wallet
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.accountId, accountId));

  if (!wallet) {
    throw new NotFoundError('Wallet for account', accountId);
  }

  // Credit the wallet
  const [updatedWallet] = await db
    .update(wallets)
    .set({
      balanceUsdCents: sql`${wallets.balanceUsdCents} + ${amountUsdCents}`,
      lifetimeInUsdCents: sql`${wallets.lifetimeInUsdCents} + ${amountUsdCents}`,
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, wallet.id))
    .returning();

  // Record the transaction
  const [transaction] = await db
    .insert(transactions)
    .values({
      id: generateId(ID_PREFIXES.transaction),
      walletId: wallet.id,
      type: 'credit_stripe', // Using existing type
      currency: 'usd_cents',
      amountSats: 0,
      amountUsdCents,
      balanceAfter: 0,
      balanceAfterUsdCents: updatedWallet.balanceUsdCents,
      referenceType: null,
      referenceId: null,
      description: description || `Admin credit of $${(amountUsdCents / 100).toFixed(2)}`,
      createdAt: new Date(),
    })
    .returning();

  res.json({
    wallet: updatedWallet,
    transaction,
  });
});


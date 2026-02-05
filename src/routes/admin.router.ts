import { Router } from 'express';
import type { Request, Response } from 'express';
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

  // Total volume from wallets belonging to this account
  const [volumeRow] = await db
    .select({
      satsIn: sum(wallets.lifetimeIn),
      satsOut: sum(wallets.lifetimeOut),
    })
    .from(wallets)
    .where(eq(wallets.accountId, accountId));

  // Active agents count
  const [agentCountRow] = await db
    .select({ count: count() })
    .from(agents)
    .where(and(eq(agents.accountId, accountId), eq(agents.status, 'active')));

  // Total transactions count
  const [txCountRow] = await db
    .select({ count: count() })
    .from(transactions)
    .innerJoin(wallets, eq(transactions.walletId, wallets.id))
    .where(eq(wallets.accountId, accountId));

  // Revenue estimate: sum of charged_sats from audit_logs for this account's agents
  const [revenueRow] = await db
    .select({ revenue: sum(auditLogs.chargedSats) })
    .from(auditLogs)
    .innerJoin(agents, eq(auditLogs.agentId, agents.id))
    .where(eq(agents.accountId, accountId));

  res.json({
    satsIn: Number(volumeRow?.satsIn ?? 0),
    satsOut: Number(volumeRow?.satsOut ?? 0),
    activeAgents: agentCountRow?.count ?? 0,
    totalTransactions: txCountRow?.count ?? 0,
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
      spend: sum(auditLogs.chargedSats),
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

  const spendMap = new Map(
    todaySpend.map((r) => [r.agentId, Number(r.spend ?? 0)]),
  );

  const result = agentRows.map((row) => ({
    ...row,
    balanceSats: accountWallet?.balanceSats ?? 0,
    heldSats: accountWallet?.heldSats ?? 0,
    lifetimeIn: accountWallet?.lifetimeIn ?? 0,
    lifetimeOut: accountWallet?.lifetimeOut ?? 0,
    todaySpendSats: spendMap.get(row.id) ?? 0,
  }));

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
      operation: auditLogs.operation,
      policyResult: auditLogs.policyResult,
      policyReason: auditLogs.policyReason,
      quotedSats: auditLogs.quotedSats,
      chargedSats: auditLogs.chargedSats,
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


import { eq, sql, and, gte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLogs } from '../db/schema/index.js';
import { DAILY_SPEND_CACHE_TTL_MS } from '../config/constants.js';
import type { PolicyCheckRequest, PolicyCheckResult } from '../types/index.js';

// ---------------------------------------------------------------------------
// Daily spend cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  spend: number;
  cachedAt: Date;
}

const dailySpendCache = new Map<string, CacheEntry>();

export function invalidateDailySpendCache(agentId: string): void {
  dailySpendCache.delete(agentId);
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Query the total charged_sats for an agent since the start of today (UTC),
 * considering only audit log entries where the policy result was 'allowed'.
 * Results are cached in-memory with a 60-second TTL.
 */
export async function getDailySpend(agentId: string): Promise<number> {
  const cached = dailySpendCache.get(agentId);
  if (cached && Date.now() - cached.cachedAt.getTime() < DAILY_SPEND_CACHE_TTL_MS) {
    return cached.spend;
  }

  const now = new Date();
  const startOfDayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const [result] = await db
    .select({ total: sql<number>`COALESCE(SUM(${auditLogs.chargedSats}), 0)` })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.agentId, agentId),
        gte(auditLogs.createdAt, startOfDayUtc),
        eq(auditLogs.policyResult, 'allowed'),
      ),
    );

  const spend = Number(result?.total ?? 0);

  dailySpendCache.set(agentId, { spend, cachedAt: new Date() });

  return spend;
}

/**
 * Evaluate all policy rules against a proxy call request.
 * Checks are executed in order; the first failure short-circuits.
 */
export async function evaluate(request: PolicyCheckRequest): Promise<PolicyCheckResult> {
  const { agent, policy, serviceSlug, capability, quotedSats } = request;

  // 1. Agent must be active
  if (agent.status !== 'active') {
    return { allowed: false, reason: 'agent_not_active' };
  }

  // 2. Kill switch
  if (policy.killSwitch === true) {
    return { allowed: false, reason: 'kill_switch_active' };
  }

  // 3. Denied services
  if (policy.deniedServices && policy.deniedServices.includes(serviceSlug)) {
    return { allowed: false, reason: 'service_denied' };
  }

  // 4. Allowed services (if set, service must be in the list)
  if (policy.allowedServices && !policy.allowedServices.includes(serviceSlug)) {
    return { allowed: false, reason: 'service_not_allowed' };
  }

  // 5. Denied capabilities
  if (capability && policy.deniedCapabilities && policy.deniedCapabilities.includes(capability)) {
    return { allowed: false, reason: 'capability_denied' };
  }

  // 6. Allowed capabilities (if set, capability must be in the list)
  if (capability && policy.allowedCapabilities && !policy.allowedCapabilities.includes(capability)) {
    return { allowed: false, reason: 'capability_not_allowed' };
  }

  // 7. Per-call limit
  if (policy.maxPerCallSats !== null && quotedSats > policy.maxPerCallSats) {
    return { allowed: false, reason: 'per_call_limit_exceeded' };
  }

  // 8. Daily spend limit
  if (policy.maxPerDaySats !== null) {
    const dailySpend = await getDailySpend(agent.id);
    if (dailySpend + quotedSats > policy.maxPerDaySats) {
      return { allowed: false, reason: 'daily_limit_exceeded' };
    }
  }

  // 9. All checks passed
  return { allowed: true };
}

// Core orchestrator for proxy calls.
// Handles the full lifecycle: quote -> policy -> hold -> execute -> finalize -> settle/release.

import type { Agent, Wallet, Policy } from '../../types/index.js';
import { getAdapter } from './adapter-registry.js';
import * as policyService from '../policy.service.js';
import { invalidateDailySpendCache } from '../policy.service.js';
import * as walletService from '../wallet.service.js';
import * as auditService from '../audit.service.js';
import {
  NotFoundError,
  PolicyDeniedError,
  InsufficientBalanceError,
  UpstreamError,
} from '../../lib/errors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProxyCallParams {
  agent: Agent;
  wallet: Wallet;
  policy: Policy;
  serviceSlug: string;
  requestBody: unknown;
  capability?: string;
}

export interface ProxyCallResult {
  status: number;
  data: unknown;
  headers?: Record<string, string>;
  metadata: {
    auditId: string;
    quotedSats: number;
    chargedSats: number;
    balanceAfter: number;
  };
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeProxyCall(params: ProxyCallParams): Promise<ProxyCallResult> {
  const { agent, wallet, policy, serviceSlug, requestBody, capability } = params;

  // 1. Resolve adapter
  const adapter = getAdapter(serviceSlug);
  if (!adapter) {
    throw new NotFoundError('Service adapter', serviceSlug);
  }

  // 2. Quote
  const { operation, quotedSats } = await adapter.quote(requestBody);

  // 3. Policy check
  const policyResult = await policyService.evaluate({
    agent,
    policy,
    serviceSlug,
    capability,
    quotedSats,
  });

  if (!policyResult.allowed) {
    await auditService.logProxyCall({
      agentId: agent.id,
      serviceSlug,
      capability,
      operation,
      requestBody,
      policyResult: 'denied',
      policyReason: policyResult.reason,
      quotedSats,
    });

    throw new PolicyDeniedError(policyResult.reason ?? 'policy_denied');
  }

  // 4. Hold funds
  const holdResult = await walletService.hold(wallet.id, quotedSats);
  if (!holdResult.success) {
    throw new InsufficientBalanceError(quotedSats, wallet.balanceSats);
  }

  // 5. Execute upstream call
  const startMs = Date.now();
  let upstreamLatencyMs: number;

  try {
    const response = await adapter.execute(requestBody);
    upstreamLatencyMs = Date.now() - startMs;

    // 6. If upstream returned an error status, release hold instead of charging
    if (response.status >= 400) {
      await walletService.release(wallet.id, quotedSats);

      const auditId = await auditService.logProxyCall({
        agentId: agent.id,
        serviceSlug,
        capability,
        operation,
        requestBody,
        policyResult: 'allowed',
        quotedSats,
        chargedSats: 0,
        upstreamStatus: response.status,
        upstreamLatencyMs,
        error: `Upstream returned ${response.status}`,
      });

      return {
        status: response.status,
        data: response.data,
        headers: response.headers,
        metadata: {
          auditId,
          quotedSats,
          chargedSats: 0,
          balanceAfter: (await walletService.getBalance(agent.id)).balanceSats,
        },
      };
    }

    // 7. Success path: finalize, settle, audit
    const { finalSats } = await adapter.finalize(response, quotedSats);

    const { wallet: settledWallet } = await walletService.settle(
      wallet.id,
      quotedSats,
      finalSats,
    );

    // Invalidate daily spend cache so limit checks are accurate
    invalidateDailySpendCache(agent.id);

    const auditId = await auditService.logProxyCall({
      agentId: agent.id,
      serviceSlug,
      capability,
      operation,
      requestBody,
      policyResult: 'allowed',
      quotedSats,
      chargedSats: finalSats,
      upstreamStatus: response.status,
      upstreamLatencyMs,
    });

    return {
      status: response.status,
      data: response.data,
      headers: response.headers,
      metadata: {
        auditId,
        quotedSats,
        chargedSats: finalSats,
        balanceAfter: settledWallet.balanceSats,
      },
    };
  } catch (err) {
    upstreamLatencyMs = Date.now() - startMs;

    // 8. Failure path: release hold, audit, re-throw
    try {
      await walletService.release(wallet.id, quotedSats);
    } catch (releaseErr) {
      // Log but don't swallow the original error
      const releaseMsg = releaseErr instanceof Error ? releaseErr.message : String(releaseErr);
      await auditService.logProxyCall({
        agentId: agent.id,
        serviceSlug,
        capability,
        operation,
        requestBody,
        policyResult: 'allowed',
        quotedSats,
        upstreamLatencyMs,
        error: `Release failed: ${releaseMsg}`,
      });
    }

    const errorMessage = err instanceof Error ? err.message : String(err);

    await auditService.logProxyCall({
      agentId: agent.id,
      serviceSlug,
      capability,
      operation,
      requestBody,
      policyResult: 'allowed',
      quotedSats,
      upstreamLatencyMs,
      error: errorMessage,
    });

    throw new UpstreamError(serviceSlug, 502, errorMessage);
  }
}

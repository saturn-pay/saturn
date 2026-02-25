// Core orchestrator for proxy calls.
// Handles the full lifecycle: quote -> policy -> hold -> execute -> finalize -> settle/release.

import type { Account, Agent, Wallet, Policy } from '../../types/index.js';
import { getAdapter } from './adapter-registry.js';
import * as policyService from '../policy.service.js';
import { invalidateDailySpendCache } from '../policy.service.js';
import * as walletService from '../wallet.service.js';
import type { Currency } from '../wallet.service.js';
import * as auditService from '../audit.service.js';
import * as pricing from '../pricing.service.js';
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
  account: Account;
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
  const { account, agent, wallet, policy, serviceSlug, requestBody, capability } = params;

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
    // Calculate USD cents for denied calls too
    const { btcUsd } = pricing.getCurrentRate();
    const quotedUsdCents = pricing.satsToUsdCents(quotedSats, btcUsd);

    await auditService.logProxyCall({
      agentId: agent.id,
      serviceSlug,
      capability,
      operation,
      requestBody,
      policyResult: 'denied',
      policyReason: policyResult.reason,
      quotedSats,
      quotedUsdCents,
    });

    throw new PolicyDeniedError(policyResult.reason ?? 'policy_denied');
  }

  // 4. Hold funds (dual-currency: try default currency first, fall back to other)
  const { btcUsd } = pricing.getCurrentRate();
  const quotedUsdCents = pricing.satsToUsdCents(quotedSats, btcUsd);
  const defaultCurrency = account.defaultCurrency as Currency;

  const holdResult = await walletService.hold(wallet.id, defaultCurrency, quotedUsdCents, quotedSats);
  if (!holdResult.success) {
    // Report in the user's preferred currency
    const availableBalance = defaultCurrency === 'usd_cents'
      ? wallet.balanceUsdCents
      : wallet.balanceSats;
    const requiredAmount = defaultCurrency === 'usd_cents' ? quotedUsdCents : quotedSats;
    throw new InsufficientBalanceError(requiredAmount, availableBalance);
  }

  // Track which currency was actually held (may differ from default if fallback occurred)
  const heldCurrency = holdResult.currency;
  const heldAmount = heldCurrency === 'usd_cents' ? quotedUsdCents : quotedSats;

  // 5. Execute upstream call
  const startMs = Date.now();
  let upstreamLatencyMs: number;

  try {
    const response = await adapter.execute(requestBody);
    upstreamLatencyMs = Date.now() - startMs;

    // 6. If upstream returned an error status, release hold instead of charging
    if (response.status >= 400) {
      await walletService.release(wallet.id, heldCurrency, heldAmount, agent.id);

      const auditId = await auditService.logProxyCall({
        agentId: agent.id,
        serviceSlug,
        capability,
        operation,
        requestBody,
        policyResult: 'allowed',
        quotedSats,
        chargedSats: 0,
        quotedUsdCents,
        chargedUsdCents: 0,
        upstreamStatus: response.status,
        upstreamLatencyMs,
        error: `Upstream returned ${response.status}`,
      });

      const refreshedWallet = await walletService.getBalance(agent.accountId);
      return {
        status: response.status,
        data: response.data,
        headers: response.headers,
        metadata: {
          auditId,
          quotedSats,
          chargedSats: 0,
          balanceAfter: refreshedWallet.balanceSats,
        },
      };
    }

    // 7. Success path: finalize, settle, audit
    const { finalSats } = await adapter.finalize(response, quotedSats);

    // Convert final amount to the currency that was held
    const finalUsdCents = pricing.satsToUsdCents(finalSats, btcUsd);
    const finalAmount = heldCurrency === 'usd_cents'
      ? finalUsdCents
      : finalSats;

    const { wallet: settledWallet } = await walletService.settle(
      wallet.id,
      heldCurrency,
      heldAmount,
      finalAmount,
      agent.id,
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
      quotedUsdCents,
      chargedUsdCents: finalUsdCents,
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
      await walletService.release(wallet.id, heldCurrency, heldAmount, agent.id);
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
        quotedUsdCents,
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
      quotedUsdCents,
      upstreamLatencyMs,
      error: errorMessage,
    });

    throw new UpstreamError(serviceSlug, 502, errorMessage);
  }
}

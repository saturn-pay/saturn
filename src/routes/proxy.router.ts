import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { executeProxyCall } from '../services/proxy/proxy-executor.js';
import { ValidationError, NotFoundError } from '../lib/errors.js';
import { resolveProviderSlug, isCapability } from '../services/proxy/capability-registry.js';
import { normalize } from '../services/proxy/normalizers/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0];
  return value ?? '';
}

// Headers that must never be forwarded from upstream responses
const BLOCKED_UPSTREAM_HEADERS = new Set([
  'set-cookie', 'authorization', 'x-api-key', 'cookie',
  'transfer-encoding', 'connection', 'keep-alive',
  'content-length', 'content-encoding', // These must be set by Express based on our response body
]);

function setFilteredHeaders(res: Response, headers: Record<string, string>): void {
  for (const [key, value] of Object.entries(headers)) {
    if (!BLOCKED_UPSTREAM_HEADERS.has(key.toLowerCase())) {
      res.set(key, value);
    }
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const proxyRouter = Router();

// ---------------------------------------------------------------------------
// Capability Router — POST /capabilities/:capability
// ---------------------------------------------------------------------------

export const capabilityRouter = Router();

capabilityRouter.post('/:capability', requireAuth, async (req: Request, res: Response) => {
  const capability = paramString(req.params.capability);
  const account = req.account!;
  const agent = req.agent!;
  const wallet = req.wallet;
  const policy = req.policy;

  if (!wallet) {
    throw new ValidationError('Agent has no wallet configured');
  }

  if (!policy) {
    throw new ValidationError('Agent has no policy configured');
  }

  if (!isCapability(capability)) {
    throw new NotFoundError('Capability', capability);
  }

  const serviceSlug = resolveProviderSlug(capability);
  if (!serviceSlug) {
    throw new NotFoundError('Provider for capability', capability);
  }

  const result = await executeProxyCall({
    account,
    agent,
    wallet,
    policy,
    serviceSlug,
    requestBody: req.body,
    capability,
  });

  // Set Saturn metadata headers
  res.set('X-Saturn-Audit-Id', result.metadata.auditId);
  res.set('X-Saturn-Quoted-Sats', String(result.metadata.quotedSats));
  res.set('X-Saturn-Charged-Sats', String(result.metadata.chargedSats));
  res.set('X-Saturn-Quoted-Usd-Cents', String(result.metadata.quotedUsdCents));
  res.set('X-Saturn-Charged-Usd-Cents', String(result.metadata.chargedUsdCents));
  res.set('X-Saturn-Balance-After', String(result.metadata.balanceAfter));
  res.set('X-Saturn-Capability', capability);
  res.set('X-Saturn-Provider', serviceSlug);

  // Forward safe upstream headers
  if (result.headers) {
    setFilteredHeaders(res, result.headers);
  }

  // Normalize response for capability endpoints
  const normalized = normalize(capability, serviceSlug, result.data);

  res.status(result.status).json(normalized);
});

// ---------------------------------------------------------------------------
// Legacy Proxy Router — POST /proxy/:serviceSlug (backward compat)
// ---------------------------------------------------------------------------

// POST /proxy/:serviceSlug — execute a proxied API call on behalf of an agent
proxyRouter.post('/:serviceSlug', requireAuth, async (req: Request, res: Response) => {
  const serviceSlug = paramString(req.params.serviceSlug);
  const account = req.account!;
  const agent = req.agent!;
  const wallet = req.wallet;
  const policy = req.policy;

  if (!wallet) {
    throw new ValidationError('Agent has no wallet configured');
  }

  if (!policy) {
    throw new ValidationError('Agent has no policy configured');
  }

  const result = await executeProxyCall({
    account,
    agent,
    wallet,
    policy,
    serviceSlug,
    requestBody: req.body,
  });

  // Set Saturn metadata headers
  res.set('X-Saturn-Audit-Id', result.metadata.auditId);
  res.set('X-Saturn-Quoted-Sats', String(result.metadata.quotedSats));
  res.set('X-Saturn-Charged-Sats', String(result.metadata.chargedSats));
  res.set('X-Saturn-Quoted-Usd-Cents', String(result.metadata.quotedUsdCents));
  res.set('X-Saturn-Charged-Usd-Cents', String(result.metadata.chargedUsdCents));
  res.set('X-Saturn-Balance-After', String(result.metadata.balanceAfter));

  // Forward safe upstream headers
  if (result.headers) {
    setFilteredHeaders(res, result.headers);
  }

  res.status(result.status).json(result.data);
});

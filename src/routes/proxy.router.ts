import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAgent } from '../middleware/auth.js';
import { executeProxyCall } from '../services/proxy/proxy-executor.js';
import { ValidationError } from '../lib/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0];
  return value ?? '';
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const proxyRouter = Router();

// POST /proxy/:serviceSlug — execute a proxied API call on behalf of an agent
proxyRouter.post('/:serviceSlug', requireAgent, async (req: Request, res: Response) => {
  const serviceSlug = paramString(req.params.serviceSlug);
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
  res.set('X-Saturn-Balance-After', String(result.metadata.balanceAfter));

  // Forward any upstream headers
  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) {
      res.set(key, value);
    }
  }

  res.status(result.status).json(result.data);
});

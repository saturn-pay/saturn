import { db } from '../db/client.js';
import { auditLogs } from '../db/schema/index.js';
import { generateId } from '../lib/id.js';
import { ID_PREFIXES } from '../config/constants.js';
import { invalidateDailySpendCache } from './policy.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditLogParams {
  agentId: string;
  serviceSlug: string;
  capability?: string;
  operation?: string;
  requestBody?: unknown;
  policyResult: 'allowed' | 'denied';
  policyReason?: string;
  quotedSats?: number;
  chargedSats?: number;
  upstreamStatus?: number;
  upstreamLatencyMs?: number;
  responseMeta?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SENSITIVE_KEYS = new Set([
  'authorization',
  'x-api-key',
  'api_key',
  'apikey',
  'api-key',
  'token',
  'secret',
  'password',
  'credential',
  'credentials',
  'access_token',
  'refresh_token',
]);

/**
 * Recursively strip sensitive keys from an object.
 * Returns a deep-cloned copy with auth headers and API keys redacted.
 */
function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        cleaned[key] = '[REDACTED]';
      } else {
        cleaned[key] = sanitize(value);
      }
    }
    return cleaned;
  }

  return obj;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Insert an audit log entry for a proxy call and return the generated ID.
 */
export async function logProxyCall(params: AuditLogParams): Promise<string> {
  const id = generateId(ID_PREFIXES.auditLog);

  const sanitizedBody = params.requestBody !== undefined
    ? sanitize(params.requestBody)
    : undefined;

  await db.insert(auditLogs).values({
    id,
    agentId: params.agentId,
    serviceSlug: params.serviceSlug,
    capability: params.capability ?? null,
    operation: params.operation ?? null,
    requestBody: sanitizedBody ?? null,
    policyResult: params.policyResult,
    policyReason: params.policyReason ?? null,
    quotedSats: params.quotedSats ?? null,
    chargedSats: params.chargedSats ?? null,
    upstreamStatus: params.upstreamStatus ?? null,
    upstreamLatencyMs: params.upstreamLatencyMs ?? null,
    responseMeta: params.responseMeta ?? null,
    error: params.error ?? null,
  });

  invalidateDailySpendCache(params.agentId);

  return id;
}

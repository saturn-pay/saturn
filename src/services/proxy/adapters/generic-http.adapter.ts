// GenericHttpAdapter — a reusable adapter for any service approved through the registry.
// No custom code per service. Auth, quoting, and execution are driven by config.

import { BaseAdapter, QuoteResult, ExecuteResult, FinalizeResult } from '../base-adapter.js';
import { getPrice } from '../../pricing.service.js';

const UPSTREAM_TIMEOUT_MS = 30_000;

export interface GenericHttpConfig {
  slug: string;
  baseUrl: string;
  authType: 'bearer' | 'api_key_header' | 'basic' | 'query_param';
  authCredentialEnv: string;
  defaultOperation: string;
}

interface GenericRequestBody {
  path?: string;
  method?: string;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

// Only env vars matching this pattern can be referenced by community services
const ALLOWED_ENV_PATTERN = /^[A-Z][A-Z0-9_]*_API_KEY$|^[A-Z][A-Z0-9_]*_API_TOKEN$/;

export class GenericHttpAdapter extends BaseAdapter {
  slug: string;

  constructor(private readonly config: GenericHttpConfig) {
    super();
    this.slug = config.slug;

    // Prevent arbitrary env var exfiltration via authCredentialEnv
    if (!ALLOWED_ENV_PATTERN.test(config.authCredentialEnv)) {
      throw new Error(
        `Invalid authCredentialEnv "${config.authCredentialEnv}" — must match pattern *_API_KEY or *_API_TOKEN`,
      );
    }
  }

  async quote(_body: unknown): Promise<QuoteResult> {
    const operation = this.config.defaultOperation;
    const pricing = await getPrice(this.config.slug, operation);
    return { operation, quotedSats: pricing.priceSats };
  }

  private static readonly ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  private static readonly BLOCKED_HEADERS = new Set([
    'host', 'authorization', 'x-api-key', 'cookie', 'transfer-encoding',
  ]);

  async execute(body: unknown): Promise<ExecuteResult> {
    const apiKey = process.env[this.config.authCredentialEnv];
    if (!apiKey) {
      throw new Error(`${this.config.authCredentialEnv} is not set`);
    }

    const { path = '', method = 'POST', headers: extraHeaders, ...payload } = (body ?? {}) as GenericRequestBody;

    // Validate method
    const upperMethod = method.toUpperCase();
    if (!GenericHttpAdapter.ALLOWED_METHODS.has(upperMethod)) {
      throw new Error(`HTTP method not allowed: ${method}`);
    }

    // Validate path — prevent path traversal and protocol-relative URLs
    if (/\.\.|:\/\/|^\/\//.test(path)) {
      throw new Error('Invalid path');
    }

    // Build URL and verify it stays on the configured host
    const url = `${this.config.baseUrl.replace(/\/+$/, '')}${path ? `/${path.replace(/^\/+/, '')}` : ''}`;
    const parsedBase = new URL(this.config.baseUrl);
    const parsedFinal = new URL(url);
    if (parsedFinal.hostname !== parsedBase.hostname) {
      throw new Error('Path must not redirect to a different host');
    }

    // Filter user-supplied headers — block auth and sensitive headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (extraHeaders) {
      for (const [key, value] of Object.entries(extraHeaders)) {
        if (!GenericHttpAdapter.BLOCKED_HEADERS.has(key.toLowerCase())) {
          headers[key] = value;
        }
      }
    }

    switch (this.config.authType) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'api_key_header':
        headers['X-Api-Key'] = apiKey;
        break;
      case 'basic':
        headers['Authorization'] = `Basic ${Buffer.from(apiKey).toString('base64')}`;
        break;
      case 'query_param': {
        const separator = url.includes('?') ? '&' : '?';
        const finalUrl = `${url}${separator}api_key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(finalUrl, {
          method: upperMethod,
          headers,
          body: upperMethod !== 'GET' ? JSON.stringify(payload) : undefined,
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });
        const data = await res.json();
        return { status: res.status, data };
      }
    }

    const res = await fetch(url, {
      method: upperMethod,
      headers,
      body: upperMethod !== 'GET' ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const data = await res.json();
    return { status: res.status, data };
  }

  async finalize(_response: ExecuteResult, quotedSats: number): Promise<FinalizeResult> {
    // Flat pricing for community services — quoted equals final
    return { finalSats: quotedSats };
  }
}

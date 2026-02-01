// GenericHttpAdapter — a reusable adapter for any service approved through the registry.
// No custom code per service. Auth, quoting, and execution are driven by config.

import { BaseAdapter, QuoteResult, ExecuteResult, FinalizeResult } from '../base-adapter.js';
import { getPrice } from '../../pricing.service.js';

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

export class GenericHttpAdapter extends BaseAdapter {
  slug: string;

  constructor(private readonly config: GenericHttpConfig) {
    super();
    this.slug = config.slug;
  }

  async quote(_body: unknown): Promise<QuoteResult> {
    const operation = this.config.defaultOperation;
    const pricing = await getPrice(this.config.slug, operation);
    return { operation, quotedSats: pricing.priceSats };
  }

  async execute(body: unknown): Promise<ExecuteResult> {
    const apiKey = process.env[this.config.authCredentialEnv];
    if (!apiKey) {
      throw new Error(`${this.config.authCredentialEnv} is not set`);
    }

    const { path = '', method = 'POST', headers: extraHeaders, ...payload } = (body ?? {}) as GenericRequestBody;

    const url = `${this.config.baseUrl.replace(/\/+$/, '')}${path ? `/${path.replace(/^\/+/, '')}` : ''}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

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
          method: method.toUpperCase(),
          headers,
          body: method.toUpperCase() !== 'GET' ? JSON.stringify(payload) : undefined,
        });
        const data = await res.json();
        return { status: res.status, data };
      }
    }

    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body: method.toUpperCase() !== 'GET' ? JSON.stringify(payload) : undefined,
    });

    const data = await res.json();
    return { status: res.status, data };
  }

  async finalize(_response: ExecuteResult, quotedSats: number): Promise<FinalizeResult> {
    // Flat pricing for community services — quoted equals final
    return { finalSats: quotedSats };
  }
}

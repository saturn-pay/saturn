import { fromResponse } from './errors.js';
import type { ProxyCallMetadata } from './types.js';

export interface ClientConfig {
  apiKey: string;
  baseUrl: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface ProxyResponse<T> {
  data: T;
  metadata: ProxyCallMetadata;
}

export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: ClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
  }

  async get<T>(path: string, query?: Record<string, unknown>, opts?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, query, opts);
  }

  async post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, undefined, opts);
  }

  async put<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, body, undefined, opts);
  }

  async patch<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, body, undefined, opts);
  }

  async delete(path: string, opts?: RequestOptions): Promise<void> {
    await this.rawRequest('DELETE', path, undefined, undefined, opts);
  }

  async proxyPost<T>(path: string, body: unknown, opts?: RequestOptions): Promise<ProxyResponse<T>> {
    const res = await this.rawRequest('POST', path, body, undefined, opts);

    const metadata: ProxyCallMetadata = {
      auditId: res.headers.get('x-saturn-audit-id') ?? '',
      quotedSats: Number(res.headers.get('x-saturn-quoted-sats') ?? 0),
      chargedSats: Number(res.headers.get('x-saturn-charged-sats') ?? 0),
      quotedUsdCents: Number(res.headers.get('x-saturn-quoted-usd-cents') ?? 0),
      chargedUsdCents: Number(res.headers.get('x-saturn-charged-usd-cents') ?? 0),
      balanceAfter: Number(res.headers.get('x-saturn-balance-after') ?? 0),
    };

    if (!res.ok) {
      let errorBody: unknown;
      try { errorBody = await res.json(); } catch { errorBody = {}; }
      throw fromResponse(res.status, errorBody as Record<string, unknown>);
    }

    const data = (await res.json()) as T;
    return { data, metadata };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, unknown>,
    opts?: RequestOptions,
  ): Promise<T> {
    const res = await this.rawRequest(method, path, body, query, opts);

    if (res.status === 204) {
      return undefined as T;
    }

    let responseBody: unknown;
    try { responseBody = await res.json(); } catch { responseBody = {}; }

    if (!res.ok) {
      throw fromResponse(res.status, responseBody as Record<string, unknown>);
    }

    return responseBody as T;
  }

  private async rawRequest(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, unknown>,
    opts?: RequestOptions,
  ): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: opts?.signal,
    });
  }
}

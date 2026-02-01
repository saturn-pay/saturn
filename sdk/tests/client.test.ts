import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpClient } from '../src/client.js';
import {
  SaturnAuthError,
  SaturnNotFoundError,
  SaturnValidationError,
  SaturnPolicyDeniedError,
  SaturnInsufficientBalanceError,
  SaturnRateLimitError,
  SaturnError,
} from '../src/errors.js';

function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: new Headers(headers ?? {}),
  });
}

describe('HttpClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends Authorization header with apiKey', async () => {
    const fetchSpy = mockFetch(200, { id: '1' });
    vi.stubGlobal('fetch', fetchSpy);

    const client = new HttpClient({ apiKey: 'sk_acct_abc', baseUrl: 'https://api.test.com' });
    await client.get('/v1/accounts/me');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/accounts/me');
    expect(init.headers['Authorization']).toBe('Bearer sk_acct_abc');
    expect(init.method).toBe('GET');
  });

  it('sets Content-Type for POST with body', async () => {
    const fetchSpy = mockFetch(201, { id: '1' });
    vi.stubGlobal('fetch', fetchSpy);

    const client = new HttpClient({ apiKey: 'sk_acct_abc', baseUrl: 'https://api.test.com' });
    await client.post('/v1/agents', { name: 'bot' });

    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ name: 'bot' }));
  });

  it('appends query params to URL', async () => {
    const fetchSpy = mockFetch(200, { data: [] });
    vi.stubGlobal('fetch', fetchSpy);

    const client = new HttpClient({ apiKey: 'sk_acct_abc', baseUrl: 'https://api.test.com' });
    await client.get('/v1/admin/transactions', { limit: 10, offset: 0, type: undefined });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=0');
    expect(url).not.toContain('type');
  });

  it('returns undefined for 204 No Content', async () => {
    const fetchSpy = mockFetch(204, null);
    vi.stubGlobal('fetch', fetchSpy);

    const client = new HttpClient({ apiKey: 'sk_acct_abc', baseUrl: 'https://api.test.com' });
    const result = await client.delete('/v1/agents/agt_1');
    expect(result).toBeUndefined();
  });

  it('throws SaturnAuthError on 401', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
    }));

    const client = new HttpClient({ apiKey: 'bad', baseUrl: 'https://api.test.com' });
    await expect(client.get('/v1/accounts/me')).rejects.toThrow(SaturnAuthError);
  });

  it('throws SaturnValidationError on 400', async () => {
    vi.stubGlobal('fetch', mockFetch(400, {
      error: { code: 'VALIDATION_ERROR', message: 'name is required' },
    }));

    const client = new HttpClient({ apiKey: 'sk_acct_abc', baseUrl: 'https://api.test.com' });
    await expect(client.post('/v1/agents', {})).rejects.toThrow(SaturnValidationError);
  });

  it('throws SaturnNotFoundError on 404', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {
      error: { code: 'NOT_FOUND', message: 'Agent not found' },
    }));

    const client = new HttpClient({ apiKey: 'sk_acct_abc', baseUrl: 'https://api.test.com' });
    await expect(client.get('/v1/agents/agt_nope')).rejects.toThrow(SaturnNotFoundError);
  });

  it('throws SaturnPolicyDeniedError on 403', async () => {
    vi.stubGlobal('fetch', mockFetch(403, {
      error: { code: 'POLICY_DENIED', message: 'Kill switch active' },
    }));

    const client = new HttpClient({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    await expect(client.post('/v1/proxy/openai', {})).rejects.toThrow(SaturnPolicyDeniedError);
  });

  it('throws SaturnInsufficientBalanceError on 402', async () => {
    vi.stubGlobal('fetch', mockFetch(402, {
      error: { code: 'INSUFFICIENT_BALANCE', message: 'Need 100 sats, have 50' },
    }));

    const client = new HttpClient({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    await expect(client.post('/v1/proxy/openai', {})).rejects.toThrow(SaturnInsufficientBalanceError);
  });

  it('throws SaturnRateLimitError on 429', async () => {
    vi.stubGlobal('fetch', mockFetch(429, {
      error: { code: 'RATE_LIMIT', message: 'Too many requests' },
    }));

    const client = new HttpClient({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    await expect(client.get('/v1/services')).rejects.toThrow(SaturnRateLimitError);
  });

  it('throws generic SaturnError for unknown codes', async () => {
    vi.stubGlobal('fetch', mockFetch(500, {
      error: { code: 'INTERNAL_ERROR', message: 'Something broke' },
    }));

    const client = new HttpClient({ apiKey: 'sk_acct_abc', baseUrl: 'https://api.test.com' });
    await expect(client.get('/v1/admin/stats')).rejects.toThrow(SaturnError);
  });

  describe('proxyPost', () => {
    it('extracts X-Saturn headers into metadata', async () => {
      const fetchSpy = mockFetch(200, { choices: [] }, {
        'x-saturn-audit-id': 'aud_123',
        'x-saturn-quoted-sats': '100',
        'x-saturn-charged-sats': '95',
        'x-saturn-balance-after': '9905',
      });
      vi.stubGlobal('fetch', fetchSpy);

      const client = new HttpClient({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
      const result = await client.proxyPost('/v1/proxy/openai', { model: 'gpt-4o' });

      expect(result.metadata).toEqual({
        auditId: 'aud_123',
        quotedSats: 100,
        chargedSats: 95,
        balanceAfter: 9905,
      });
      expect(result.data).toEqual({ choices: [] });
    });

    it('throws error with metadata headers on failure', async () => {
      const fetchSpy = mockFetch(403, {
        error: { code: 'POLICY_DENIED', message: 'Kill switch' },
      }, {
        'x-saturn-audit-id': 'aud_456',
        'x-saturn-quoted-sats': '100',
        'x-saturn-charged-sats': '0',
        'x-saturn-balance-after': '10000',
      });
      vi.stubGlobal('fetch', fetchSpy);

      const client = new HttpClient({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
      await expect(client.proxyPost('/v1/proxy/openai', {})).rejects.toThrow(SaturnPolicyDeniedError);
    });
  });
});

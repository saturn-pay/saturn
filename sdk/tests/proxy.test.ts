import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Saturn } from '../src/index.js';
import { SaturnPolicyDeniedError } from '../src/errors.js';

function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: new Headers(headers ?? {}),
  });
}

describe('ProxyResource', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('call() sends POST /v1/proxy/:slug and extracts metadata', async () => {
    const upstream = { id: 'chatcmpl-1', choices: [{ message: { content: 'hi' } }] };
    const fetchSpy = mockFetch(200, upstream, {
      'x-saturn-audit-id': 'aud_abc',
      'x-saturn-quoted-sats': '50',
      'x-saturn-charged-sats': '45',
      'x-saturn-balance-after': '9955',
    });
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.proxy.call('openai', { model: 'gpt-4o', messages: [] });

    expect(result.data).toEqual(upstream);
    expect(result.metadata).toEqual({
      auditId: 'aud_abc',
      quotedSats: 50,
      chargedSats: 45,
      balanceAfter: 9955,
    });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/proxy/openai');
    expect(init.method).toBe('POST');
  });

  it('openai() is a convenience wrapper for call("openai", ...)', async () => {
    const upstream = { id: 'chatcmpl-1', choices: [] };
    const fetchSpy = mockFetch(200, upstream, {
      'x-saturn-audit-id': 'aud_1',
      'x-saturn-quoted-sats': '10',
      'x-saturn-charged-sats': '10',
      'x-saturn-balance-after': '990',
    });
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.proxy.openai({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] });

    expect(result.data.id).toBe('chatcmpl-1');
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/proxy/openai');
  });

  it('anthropic() routes to /v1/proxy/anthropic', async () => {
    const upstream = { id: 'msg_1', content: [{ type: 'text', text: 'hello' }] };
    const fetchSpy = mockFetch(200, upstream, {
      'x-saturn-audit-id': 'aud_2',
      'x-saturn-quoted-sats': '20',
      'x-saturn-charged-sats': '18',
      'x-saturn-balance-after': '982',
    });
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.proxy.anthropic({ model: 'claude-3', max_tokens: 100, messages: [] });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/proxy/anthropic');
    expect(result.data).toEqual(upstream);
  });

  it('throws SaturnPolicyDeniedError on policy failure', async () => {
    const fetchSpy = mockFetch(403, {
      error: { code: 'POLICY_DENIED', message: 'Kill switch active' },
    }, {
      'x-saturn-audit-id': 'aud_denied',
      'x-saturn-quoted-sats': '50',
      'x-saturn-charged-sats': '0',
      'x-saturn-balance-after': '10000',
    });
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    await expect(saturn.proxy.call('openai', {})).rejects.toThrow(SaturnPolicyDeniedError);
  });

  it('serper() routes to /v1/proxy/serper', async () => {
    const fetchSpy = mockFetch(200, { organic: [] }, {
      'x-saturn-audit-id': 'aud_3',
      'x-saturn-quoted-sats': '5',
      'x-saturn-charged-sats': '5',
      'x-saturn-balance-after': '995',
    });
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.proxy.serper({ q: 'bitcoin price' });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/proxy/serper');
    expect(result.data).toEqual({ organic: [] });
  });
});

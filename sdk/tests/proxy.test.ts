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

const defaultHeaders = {
  'x-saturn-audit-id': 'aud_abc',
  'x-saturn-quoted-sats': '50',
  'x-saturn-charged-sats': '45',
  'x-saturn-balance-after': '9955',
};

describe('ProxyResource — Capability Methods', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reason() sends POST /v1/capabilities/reason', async () => {
    const upstream = { id: 'chatcmpl-1', choices: [{ message: { content: 'hi' } }] };
    const fetchSpy = mockFetch(200, upstream, defaultHeaders);
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.proxy.reason({
      messages: [{ role: 'user', content: 'hello' }],
    });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/capabilities/reason');
    expect(result.data).toEqual(upstream);
    expect(result.metadata.chargedSats).toBe(45);
  });

  it('search() sends POST /v1/capabilities/search', async () => {
    const upstream = { organic: [{ title: 'BTC', link: 'https://...' }] };
    const fetchSpy = mockFetch(200, upstream, defaultHeaders);
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.proxy.search({ query: 'bitcoin price' });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/capabilities/search');
    expect(result.data).toEqual(upstream);
  });

  it('read() sends POST /v1/capabilities/read', async () => {
    const upstream = { content: '# Hello World' };
    const fetchSpy = mockFetch(200, upstream, defaultHeaders);
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.proxy.read({ url: 'https://example.com' });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/capabilities/read');
    expect(result.data).toEqual(upstream);
  });

  it('execute() sends POST /v1/capabilities/execute', async () => {
    const upstream = { output: '4' };
    const fetchSpy = mockFetch(200, upstream, defaultHeaders);
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.proxy.execute({ code: 'print(2+2)', language: 'python' });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/capabilities/execute');
    expect(result.data).toEqual(upstream);
  });

  it('email() sends POST /v1/capabilities/email', async () => {
    const upstream = { id: 'msg_1' };
    const fetchSpy = mockFetch(200, upstream, defaultHeaders);
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.proxy.email({ to: 'test@example.com', subject: 'Hi', body: 'Hello' });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/capabilities/email');
    expect(result.data).toEqual(upstream);
  });

  it('sms() sends POST /v1/capabilities/sms', async () => {
    const upstream = { sid: 'SM123' };
    const fetchSpy = mockFetch(200, upstream, defaultHeaders);
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.proxy.sms({ to: '+1234567890', body: 'Hello' });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/capabilities/sms');
    expect(result.data).toEqual(upstream);
  });

  it('imagine() sends POST /v1/capabilities/imagine', async () => {
    const upstream = { url: 'https://images.replicate.com/...' };
    const fetchSpy = mockFetch(200, upstream, defaultHeaders);
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.proxy.imagine({ prompt: 'a cat in space' });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/capabilities/imagine');
    expect(result.data).toEqual(upstream);
  });

  it('speak() sends POST /v1/capabilities/speak', async () => {
    const upstream = { audio_url: 'https://...' };
    const fetchSpy = mockFetch(200, upstream, defaultHeaders);
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.proxy.speak({ text: 'Hello world' });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/capabilities/speak');
    expect(result.data).toEqual(upstream);
  });

  it('transcribe() sends POST /v1/capabilities/transcribe', async () => {
    const upstream = { transcript: 'Hello world' };
    const fetchSpy = mockFetch(200, upstream, defaultHeaders);
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.proxy.transcribe({ audio: 'base64...' });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/capabilities/transcribe');
    expect(result.data).toEqual(upstream);
  });

  it('scrape() sends POST /v1/capabilities/scrape', async () => {
    const upstream = { html: '<html>...</html>' };
    const fetchSpy = mockFetch(200, upstream, defaultHeaders);
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.proxy.scrape({ url: 'https://example.com' });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/capabilities/scrape');
    expect(result.data).toEqual(upstream);
  });
});

describe('ProxyResource — Legacy Methods (Backward Compat)', () => {
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

describe('CapabilitiesResource', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('list() sends GET /v1/capabilities', async () => {
    const caps = [
      { capability: 'reason', description: 'Think and plan', providers: [], defaultProvider: 'openai', pricing: [] },
    ];
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(caps),
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.capabilities.list();

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/capabilities');
    expect(result).toEqual(caps);
  });

  it('get() sends GET /v1/capabilities/:capability', async () => {
    const cap = {
      capability: 'search',
      description: 'Web search',
      defaultProvider: 'serper',
      providers: [{ slug: 'serper', name: 'Serper', priority: 1, active: true, pricing: [] }],
    };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(cap),
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_agt_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.capabilities.get('search');

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/capabilities/search');
    expect(result).toEqual(cap);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Saturn } from '../src/index.js';

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: new Headers(),
  });
}

describe('AccountsResource', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('create() sends POST /v1/accounts', async () => {
    const account = { id: 'acc_1', name: 'Test', email: 'a@b.com', apiKey: 'sk_acct_new', createdAt: '', updatedAt: '' };
    const fetchSpy = mockFetch(201, account);
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_acct_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.accounts.create({ name: 'Test', email: 'a@b.com' });

    expect(result.apiKey).toBe('sk_acct_new');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/accounts');
    expect(init.method).toBe('POST');
  });

  it('me() sends GET /v1/accounts/me', async () => {
    const account = { id: 'acc_1', name: 'Test', email: 'a@b.com', createdAt: '', updatedAt: '' };
    const fetchSpy = mockFetch(200, account);
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_acct_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.accounts.me();

    expect(result.id).toBe('acc_1');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/accounts/me');
    expect(init.method).toBe('GET');
  });

  it('update() sends PATCH /v1/accounts/me', async () => {
    const account = { id: 'acc_1', name: 'Updated', email: 'a@b.com', createdAt: '', updatedAt: '' };
    const fetchSpy = mockFetch(200, account);
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_acct_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.accounts.update({ name: 'Updated' });

    expect(result.name).toBe('Updated');
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ name: 'Updated' });
  });

  it('rotateKey() sends POST /v1/accounts/me/rotate-key', async () => {
    const response = { id: 'acc_1', name: 'Test', email: 'a@b.com', apiKey: 'sk_acct_rotated', createdAt: '', updatedAt: '' };
    const fetchSpy = mockFetch(200, response);
    vi.stubGlobal('fetch', fetchSpy);

    const saturn = new Saturn({ apiKey: 'sk_acct_abc', baseUrl: 'https://api.test.com' });
    const result = await saturn.accounts.rotateKey();

    expect(result.apiKey).toBe('sk_acct_rotated');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/accounts/me/rotate-key');
    expect(init.method).toBe('POST');
  });
});

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/services/pricing.service.js', () => ({
  getPrice: vi.fn().mockResolvedValue({ priceSats: 10 }),
}));

import { GenericHttpAdapter } from '../../src/services/proxy/adapters/generic-http.adapter.js';

// ---------------------------------------------------------------------------
// GenericHttpAdapter — env var allowlist
// ---------------------------------------------------------------------------

describe('GenericHttpAdapter', () => {
  it('accepts valid env var names ending in _API_KEY', () => {
    expect(
      () =>
        new GenericHttpAdapter({
          slug: 'test',
          baseUrl: 'https://api.example.com',
          authType: 'bearer',
          authCredentialEnv: 'MY_SERVICE_API_KEY',
          defaultOperation: 'default',
        }),
    ).not.toThrow();
  });

  it('accepts valid env var names ending in _API_TOKEN', () => {
    expect(
      () =>
        new GenericHttpAdapter({
          slug: 'test',
          baseUrl: 'https://api.example.com',
          authType: 'bearer',
          authCredentialEnv: 'REPLICATE_API_TOKEN',
          defaultOperation: 'default',
        }),
    ).not.toThrow();
  });

  it('rejects env var names that could exfiltrate secrets', () => {
    expect(
      () =>
        new GenericHttpAdapter({
          slug: 'test',
          baseUrl: 'https://api.example.com',
          authType: 'bearer',
          authCredentialEnv: 'DATABASE_URL',
          defaultOperation: 'default',
        }),
    ).toThrow(/Invalid authCredentialEnv/);
  });

  it('rejects env var names like LND_MACAROON', () => {
    expect(
      () =>
        new GenericHttpAdapter({
          slug: 'test',
          baseUrl: 'https://api.example.com',
          authType: 'bearer',
          authCredentialEnv: 'LND_MACAROON',
          defaultOperation: 'default',
        }),
    ).toThrow(/Invalid authCredentialEnv/);
  });

  it('rejects empty env var names', () => {
    expect(
      () =>
        new GenericHttpAdapter({
          slug: 'test',
          baseUrl: 'https://api.example.com',
          authType: 'bearer',
          authCredentialEnv: '',
          defaultOperation: 'default',
        }),
    ).toThrow(/Invalid authCredentialEnv/);
  });
});

// ---------------------------------------------------------------------------
// GenericHttpAdapter.execute — input validation
// ---------------------------------------------------------------------------

describe('GenericHttpAdapter.execute', () => {
  const adapter = new GenericHttpAdapter({
    slug: 'test',
    baseUrl: 'https://api.example.com',
    authType: 'bearer',
    authCredentialEnv: 'TEST_API_KEY',
    defaultOperation: 'default',
  });

  it('rejects path traversal attempts', async () => {
    process.env.TEST_API_KEY = 'test-key';
    await expect(
      adapter.execute({ path: '../../etc/passwd' }),
    ).rejects.toThrow('Invalid path');
  });

  it('rejects protocol-relative URLs in path', async () => {
    process.env.TEST_API_KEY = 'test-key';
    await expect(
      adapter.execute({ path: '//evil.com/steal' }),
    ).rejects.toThrow('Invalid path');
  });

  it('rejects disallowed HTTP methods', async () => {
    process.env.TEST_API_KEY = 'test-key';
    await expect(
      adapter.execute({ method: 'TRACE' }),
    ).rejects.toThrow('HTTP method not allowed');
  });

  it('rejects when env var is not set', async () => {
    delete process.env.TEST_API_KEY;
    await expect(adapter.execute({})).rejects.toThrow('TEST_API_KEY is not set');
  });
});

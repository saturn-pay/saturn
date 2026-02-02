import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockHold = vi.fn();
const mockSettle = vi.fn();
const mockRelease = vi.fn();
const mockGetBalance = vi.fn();

vi.mock('../../src/services/wallet.service.js', () => ({
  hold: (...args: unknown[]) => mockHold(...args),
  settle: (...args: unknown[]) => mockSettle(...args),
  release: (...args: unknown[]) => mockRelease(...args),
  getBalance: (...args: unknown[]) => mockGetBalance(...args),
}));

const mockEvaluate = vi.fn();
const mockInvalidateCache = vi.fn();

vi.mock('../../src/services/policy.service.js', () => ({
  evaluate: (...args: unknown[]) => mockEvaluate(...args),
  invalidateDailySpendCache: (...args: unknown[]) => mockInvalidateCache(...args),
}));

const mockLogProxyCall = vi.fn();

vi.mock('../../src/services/audit.service.js', () => ({
  logProxyCall: (...args: unknown[]) => mockLogProxyCall(...args),
}));

const mockGetAdapter = vi.fn();

vi.mock('../../src/services/proxy/adapter-registry.js', () => ({
  getAdapter: (...args: unknown[]) => mockGetAdapter(...args),
}));

vi.mock('../../src/lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { executeProxyCall } from '../../src/services/proxy/proxy-executor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    agent: {
      id: 'agt_01',
      accountId: 'acc_01',
      name: 'Test',
      apiKeyHash: 'h',
      apiKeyPrefix: 'p',
      status: 'active' as const,
      email: null,
      role: 'primary' as const,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    wallet: {
      id: 'wal_01',
      agentId: 'agt_01',
      balanceSats: 5000,
      heldSats: 0,
      lifetimeIn: 10000,
      lifetimeOut: 5000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    policy: {
      id: 'pol_01',
      agentId: 'agt_01',
      maxPerCallSats: 1000,
      maxPerDaySats: 10000,
      allowedServices: null,
      deniedServices: null,
      allowedCapabilities: null,
      deniedCapabilities: null,
      killSwitch: false,
      maxBalanceSats: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    serviceSlug: 'openai',
    requestBody: { prompt: 'hello' },
    ...overrides,
  };
}

const fakeAdapter = {
  slug: 'openai',
  quote: vi.fn().mockResolvedValue({ operation: 'chat', quotedSats: 100 }),
  execute: vi.fn().mockResolvedValue({ status: 200, data: { text: 'hi' } }),
  finalize: vi.fn().mockResolvedValue({ finalSats: 80 }),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('executeProxyCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAdapter.mockReturnValue(fakeAdapter);
    mockEvaluate.mockResolvedValue({ allowed: true });
    mockHold.mockResolvedValue({ success: true, wallet: { balanceSats: 4900 } });
    mockSettle.mockResolvedValue({
      wallet: { balanceSats: 4920 },
      transaction: { id: 'txn_01' },
    });
    mockLogProxyCall.mockResolvedValue('aud_01');
  });

  it('settles and charges on successful upstream call', async () => {
    const result = await executeProxyCall(makeParams());

    expect(result.status).toBe(200);
    expect(result.metadata.chargedSats).toBe(80);
    expect(result.metadata.quotedSats).toBe(100);
    expect(mockHold).toHaveBeenCalledWith('wal_01', 100);
    expect(mockSettle).toHaveBeenCalledWith('wal_01', 100, 80);
    expect(mockInvalidateCache).toHaveBeenCalledWith('agt_01');
  });

  it('releases hold and charges 0 on upstream 4xx', async () => {
    fakeAdapter.execute.mockResolvedValueOnce({
      status: 429,
      data: { error: 'rate limited' },
    });
    mockGetBalance.mockResolvedValue({ balanceSats: 5000 });

    const result = await executeProxyCall(makeParams());

    expect(result.status).toBe(429);
    expect(result.metadata.chargedSats).toBe(0);
    expect(mockRelease).toHaveBeenCalledWith('wal_01', 100);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it('releases hold and charges 0 on upstream 5xx', async () => {
    fakeAdapter.execute.mockResolvedValueOnce({
      status: 502,
      data: { error: 'bad gateway' },
    });
    mockGetBalance.mockResolvedValue({ balanceSats: 5000 });

    const result = await executeProxyCall(makeParams());

    expect(result.status).toBe(502);
    expect(result.metadata.chargedSats).toBe(0);
    expect(mockRelease).toHaveBeenCalledWith('wal_01', 100);
  });

  it('releases hold when upstream throws', async () => {
    fakeAdapter.execute.mockRejectedValueOnce(new Error('connection reset'));

    await expect(executeProxyCall(makeParams())).rejects.toThrow('connection reset');

    expect(mockRelease).toHaveBeenCalledWith('wal_01', 100);
  });

  it('still throws original error when release fails', async () => {
    fakeAdapter.execute.mockRejectedValueOnce(new Error('upstream failed'));
    mockRelease.mockRejectedValueOnce(new Error('release failed'));

    await expect(executeProxyCall(makeParams())).rejects.toThrow('upstream failed');

    // Release failure logged to audit
    expect(mockLogProxyCall).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Release failed') }),
    );
  });
});

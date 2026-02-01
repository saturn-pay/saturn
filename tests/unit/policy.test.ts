import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PolicyCheckRequest } from '../../src/types/index.js';

// Mock the db module to avoid actual DB connections
vi.mock('../../src/db/client.js', () => {
  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ total: 0 }]),
      }),
    }),
  };
  return { db: mockDb };
});

// Mock the logger to avoid pino initialization
vi.mock('../../src/lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock constants
vi.mock('../../src/config/constants.js', () => ({
  DAILY_SPEND_CACHE_TTL_MS: 0, // always bypass cache in tests
}));

import { evaluate } from '../../src/services/policy.service.js';
import { db } from '../../src/db/client.js';

function makeAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agent_01',
    accountId: 'acct_01',
    name: 'Test Agent',
    apiKeyHash: 'hash',
    status: 'active' as const,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makePolicy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pol_01',
    agentId: 'agent_01',
    maxPerCallSats: 1000,
    maxPerDaySats: 10_000,
    allowedServices: null,
    deniedServices: null,
    killSwitch: false,
    maxBalanceSats: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function setMockDailySpend(total: number) {
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ total }]),
    }),
  });
}

describe('policy.evaluate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockDailySpend(0);
  });

  it('denies when agent is not active', async () => {
    const result = await evaluate({
      agent: makeAgent({ status: 'suspended' }),
      policy: makePolicy(),
      serviceSlug: 'openai',
      quotedSats: 10,
    });
    expect(result).toEqual({ allowed: false, reason: 'agent_not_active' });
  });

  it('denies when kill switch is active', async () => {
    const result = await evaluate({
      agent: makeAgent(),
      policy: makePolicy({ killSwitch: true }),
      serviceSlug: 'openai',
      quotedSats: 10,
    });
    expect(result).toEqual({ allowed: false, reason: 'kill_switch_active' });
  });

  it('denies when service is in denied_services', async () => {
    const result = await evaluate({
      agent: makeAgent(),
      policy: makePolicy({ deniedServices: ['openai', 'anthropic'] }),
      serviceSlug: 'openai',
      quotedSats: 10,
    });
    expect(result).toEqual({ allowed: false, reason: 'service_denied' });
  });

  it('denies when allowed_services is set and service is not in it', async () => {
    const result = await evaluate({
      agent: makeAgent(),
      policy: makePolicy({ allowedServices: ['serper', 'firecrawl'] }),
      serviceSlug: 'openai',
      quotedSats: 10,
    });
    expect(result).toEqual({ allowed: false, reason: 'service_not_allowed' });
  });

  it('denies when quotedSats exceeds maxPerCallSats', async () => {
    const result = await evaluate({
      agent: makeAgent(),
      policy: makePolicy({ maxPerCallSats: 100 }),
      serviceSlug: 'openai',
      quotedSats: 200,
    });
    expect(result).toEqual({ allowed: false, reason: 'per_call_limit_exceeded' });
  });

  it('denies when daily spend + quotedSats exceeds maxPerDaySats', async () => {
    setMockDailySpend(9500);
    const result = await evaluate({
      agent: makeAgent(),
      policy: makePolicy({ maxPerDaySats: 10_000 }),
      serviceSlug: 'openai',
      quotedSats: 600,
    });
    expect(result).toEqual({ allowed: false, reason: 'daily_limit_exceeded' });
  });

  it('allows when all checks pass', async () => {
    const result = await evaluate({
      agent: makeAgent(),
      policy: makePolicy(),
      serviceSlug: 'openai',
      quotedSats: 10,
    });
    expect(result).toEqual({ allowed: true });
  });

  it('allows any amount per call when maxPerCallSats is null', async () => {
    const result = await evaluate({
      agent: makeAgent(),
      policy: makePolicy({ maxPerCallSats: null, maxPerDaySats: null }),
      serviceSlug: 'openai',
      quotedSats: 999_999,
    });
    expect(result).toEqual({ allowed: true });
  });

  it('allows all services when allowedServices is null', async () => {
    const result = await evaluate({
      agent: makeAgent(),
      policy: makePolicy({ allowedServices: null }),
      serviceSlug: 'anything-goes',
      quotedSats: 10,
    });
    expect(result).toEqual({ allowed: true });
  });
});

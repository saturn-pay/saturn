import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../src/lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/config/constants.js', () => ({
  DAILY_SPEND_CACHE_TTL_MS: 0,
}));

import { evaluate } from '../../src/services/policy.service.js';

function makeAgent() {
  return {
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
  };
}

function makePolicy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pol_01',
    agentId: 'agt_01',
    maxPerCallSats: null,
    maxPerDaySats: null,
    allowedServices: null,
    deniedServices: null,
    allowedCapabilities: null,
    deniedCapabilities: null,
    killSwitch: false,
    maxBalanceSats: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('policy.evaluate — capability checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies when capability is in deniedCapabilities', async () => {
    const result = await evaluate({
      agent: makeAgent(),
      policy: makePolicy({ deniedCapabilities: ['code_execution', 'web_search'] }),
      serviceSlug: 'e2b',
      capability: 'code_execution',
      quotedSats: 10,
    });
    expect(result).toEqual({ allowed: false, reason: 'capability_denied' });
  });

  it('denies when allowedCapabilities is set and capability is not in it', async () => {
    const result = await evaluate({
      agent: makeAgent(),
      policy: makePolicy({ allowedCapabilities: ['reasoning', 'web_search'] }),
      serviceSlug: 'e2b',
      capability: 'code_execution',
      quotedSats: 10,
    });
    expect(result).toEqual({ allowed: false, reason: 'capability_not_allowed' });
  });

  it('allows when capability is in allowedCapabilities', async () => {
    const result = await evaluate({
      agent: makeAgent(),
      policy: makePolicy({ allowedCapabilities: ['reasoning', 'code_execution'] }),
      serviceSlug: 'e2b',
      capability: 'code_execution',
      quotedSats: 10,
    });
    expect(result).toEqual({ allowed: true });
  });

  it('skips capability checks when no capability is provided (legacy proxy route)', async () => {
    const result = await evaluate({
      agent: makeAgent(),
      policy: makePolicy({
        allowedCapabilities: ['reasoning'],
        deniedCapabilities: ['code_execution'],
      }),
      serviceSlug: 'openai',
      quotedSats: 10,
    });
    // No capability provided = checks skipped
    expect(result).toEqual({ allowed: true });
  });

  it('allows when deniedCapabilities is set but capability is not in it', async () => {
    const result = await evaluate({
      agent: makeAgent(),
      policy: makePolicy({ deniedCapabilities: ['code_execution'] }),
      serviceSlug: 'openai',
      capability: 'reasoning',
      quotedSats: 10,
    });
    expect(result).toEqual({ allowed: true });
  });
});

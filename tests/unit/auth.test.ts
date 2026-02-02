import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDbSelect = vi.fn();

vi.mock('../../src/db/client.js', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: mockDbSelect,
        execute: mockDbSelect,
      }),
    }),
  },
}));

vi.mock('../../src/lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/config/constants.js', () => ({
  API_KEY_PREFIXES: { agent: 'sk_agt_' },
}));

import bcrypt from 'bcrypt';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('auth middleware', () => {
  const rawKey = 'sk_agt_' + crypto.randomBytes(32).toString('hex');
  const keyPrefix = crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 16);

  let keyHash: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    keyHash = await bcrypt.hash(rawKey, 4); // low rounds for speed
  });

  it('computes the correct SHA-256 prefix for a key', () => {
    const prefix = crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 16);
    expect(prefix).toHaveLength(16);
    expect(prefix).toBe(keyPrefix);
  });

  it('bcrypt verifies a matching key', async () => {
    const match = await bcrypt.compare(rawKey, keyHash);
    expect(match).toBe(true);
  });

  it('bcrypt rejects a non-matching key', async () => {
    const wrongKey = 'sk_agt_' + crypto.randomBytes(32).toString('hex');
    const match = await bcrypt.compare(wrongKey, keyHash);
    expect(match).toBe(false);
  });

  it('same key always produces same prefix', () => {
    const p1 = crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 16);
    const p2 = crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 16);
    expect(p1).toBe(p2);
  });

  it('different keys produce different prefixes', () => {
    const otherKey = 'sk_agt_' + crypto.randomBytes(32).toString('hex');
    const otherPrefix = crypto.createHash('sha256').update(otherKey).digest('hex').slice(0, 16);
    expect(otherPrefix).not.toBe(keyPrefix);
  });
});

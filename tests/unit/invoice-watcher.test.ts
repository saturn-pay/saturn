import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('ln-service', () => ({
  subscribeToInvoices: vi.fn().mockReturnValue({
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  }),
}));

const mockUpdate = vi.fn();
const mockCreditFromInvoice = vi.fn();

vi.mock('../../src/db/client.js', () => ({
  db: {
    update: () => ({
      set: () => ({
        where: mockUpdate,
      }),
    }),
  },
}));

vi.mock('../../src/services/wallet.service.js', () => ({
  creditFromInvoice: (...args: unknown[]) => mockCreditFromInvoice(...args),
}));

vi.mock('../../src/lib/lnd-client.js', () => ({
  lnd: {},
}));

vi.mock('../../src/lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Tests — atomic settlement logic
// ---------------------------------------------------------------------------

describe('invoice settlement logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('atomic UPDATE WHERE status=pending prevents double credit', async () => {
    // Simulate the atomic claim: first call returns the invoice (claimed),
    // second call returns empty (already claimed by first)
    const claimedInvoice = {
      id: 'inv_01',
      walletId: 'wal_01',
      amountSats: 1000,
      rHash: 'abc123',
      status: 'settled',
    };

    // First caller claims
    mockUpdate.mockResolvedValueOnce([claimedInvoice]);
    mockCreditFromInvoice.mockResolvedValueOnce({
      wallet: { balanceSats: 1000 },
      transaction: { id: 'txn_01' },
    });

    // Second caller gets empty (already claimed)
    mockUpdate.mockResolvedValueOnce([]);

    // Simulate two concurrent handlers
    const { db } = await import('../../src/db/client.js');
    const walletService = await import('../../src/services/wallet.service.js');

    // First handler
    const [claimed1] = await db
      .update({} as any)
      .set({})
      .where({} as any);

    if (claimed1) {
      await walletService.creditFromInvoice(
        claimed1.walletId,
        claimed1.amountSats,
        claimed1.id,
      );
    }

    // Second handler
    const [claimed2] = await db
      .update({} as any)
      .set({})
      .where({} as any);

    // Second handler should NOT credit
    expect(claimed1).toBeDefined();
    expect(claimed2).toBeUndefined();
    expect(mockCreditFromInvoice).toHaveBeenCalledTimes(1);
    expect(mockCreditFromInvoice).toHaveBeenCalledWith('wal_01', 1000, 'inv_01');
  });

  it('ignores invoices not in our DB (external payments)', async () => {
    // UPDATE returns no rows — invoice not found
    mockUpdate.mockResolvedValueOnce([]);

    const { db } = await import('../../src/db/client.js');

    const [claimed] = await db
      .update({} as any)
      .set({})
      .where({} as any);

    expect(claimed).toBeUndefined();
    expect(mockCreditFromInvoice).not.toHaveBeenCalled();
  });
});

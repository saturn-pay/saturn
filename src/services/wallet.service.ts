import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import * as schema from '../db/schema/index.js';
import { generateId } from '../lib/id.js';
import { ID_PREFIXES } from '../config/constants.js';
import { NotFoundError } from '../lib/errors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Wallet = typeof schema.wallets.$inferSelect;
type Transaction = typeof schema.transactions.$inferSelect;

export type Currency = 'sats' | 'usd_cents';

export interface HoldResult {
  success: boolean;
  wallet: Wallet | null;
  currency: Currency;
}

// ---------------------------------------------------------------------------
// Balance queries
// ---------------------------------------------------------------------------

/**
 * Get the wallet belonging to the given account.
 */
export async function getBalance(accountId: string): Promise<Wallet> {
  const [wallet] = await db
    .select()
    .from(schema.wallets)
    .where(eq(schema.wallets.accountId, accountId));

  if (!wallet) {
    throw new NotFoundError('Wallet for account', accountId);
  }

  return wallet;
}

// ---------------------------------------------------------------------------
// Lightning (sats) operations
// ---------------------------------------------------------------------------

/**
 * Credit a wallet from a settled Lightning invoice (sats).
 */
export async function creditFromInvoice(
  walletId: string,
  amountSats: number,
  invoiceId: string,
): Promise<{ wallet: Wallet; transaction: Transaction }> {
  return await db.transaction(async (tx) => {
    const [wallet] = await tx
      .update(schema.wallets)
      .set({
        balanceSats: sql`${schema.wallets.balanceSats} + ${amountSats}`,
        lifetimeIn: sql`${schema.wallets.lifetimeIn} + ${amountSats}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.wallets.id, walletId))
      .returning();

    if (!wallet) {
      throw new NotFoundError('Wallet', walletId);
    }

    const [transaction] = await tx
      .insert(schema.transactions)
      .values({
        id: generateId(ID_PREFIXES.transaction),
        walletId,
        type: 'credit_lightning',
        currency: 'sats',
        amountSats,
        balanceAfter: wallet.balanceSats,
        referenceType: 'invoice',
        referenceId: invoiceId,
        description: `Lightning deposit of ${amountSats} sats`,
        createdAt: new Date(),
      })
      .returning();

    return { wallet, transaction };
  });
}

/**
 * Atomically hold sats for an upcoming proxy call.
 */
export async function holdSats(
  walletId: string,
  amountSats: number,
): Promise<HoldResult> {
  const result = await db.execute<typeof schema.wallets.$inferSelect>(
    sql`UPDATE wallets
        SET balance_sats = balance_sats - ${amountSats},
            held_sats = held_sats + ${amountSats},
            updated_at = NOW()
        WHERE id = ${walletId}
          AND balance_sats >= ${amountSats}
        RETURNING *`,
  );

  const rows = result.rows ?? [];
  if (rows.length === 0) {
    return { success: false, wallet: null, currency: 'sats' };
  }

  return { success: true, wallet: rows[0] as unknown as Wallet, currency: 'sats' };
}

/**
 * Settle a held sats amount after a successful proxy call.
 */
export async function settleSats(
  walletId: string,
  heldAmount: number,
  finalAmount: number,
  agentId?: string | null,
): Promise<{ wallet: Wallet; transaction: Transaction }> {
  const refund = heldAmount - finalAmount;

  return await db.transaction(async (tx) => {
    const [wallet] = await tx
      .update(schema.wallets)
      .set({
        heldSats: sql`${schema.wallets.heldSats} - ${heldAmount}`,
        balanceSats: sql`${schema.wallets.balanceSats} + ${refund}`,
        lifetimeOut: sql`${schema.wallets.lifetimeOut} + ${finalAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.wallets.id, walletId))
      .returning();

    if (!wallet) {
      throw new NotFoundError('Wallet', walletId);
    }

    const [transaction] = await tx
      .insert(schema.transactions)
      .values({
        id: generateId(ID_PREFIXES.transaction),
        walletId,
        agentId: agentId ?? null,
        type: 'debit_proxy_call',
        currency: 'sats',
        amountSats: finalAmount,
        balanceAfter: wallet.balanceSats,
        referenceType: 'proxy_call',
        referenceId: null,
        description: `Proxy call: ${finalAmount} sats (held ${heldAmount}, refunded ${refund})`,
        createdAt: new Date(),
      })
      .returning();

    return { wallet, transaction };
  });
}

/**
 * Release a sats hold — moves sats from held back to balance.
 */
export async function releaseSats(
  walletId: string,
  heldAmount: number,
  agentId?: string | null,
): Promise<Wallet> {
  return await db.transaction(async (tx) => {
    const [wallet] = await tx
      .update(schema.wallets)
      .set({
        heldSats: sql`${schema.wallets.heldSats} - ${heldAmount}`,
        balanceSats: sql`${schema.wallets.balanceSats} + ${heldAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.wallets.id, walletId))
      .returning();

    if (!wallet) {
      throw new NotFoundError('Wallet', walletId);
    }

    await tx
      .insert(schema.transactions)
      .values({
        id: generateId(ID_PREFIXES.transaction),
        walletId,
        agentId: agentId ?? null,
        type: 'refund',
        currency: 'sats',
        amountSats: heldAmount,
        balanceAfter: wallet.balanceSats,
        referenceType: 'hold_release',
        referenceId: null,
        description: `Hold released: ${heldAmount} sats returned`,
        createdAt: new Date(),
      });

    return wallet;
  });
}

// ---------------------------------------------------------------------------
// Stripe (USD) operations
// ---------------------------------------------------------------------------

/**
 * Credit a wallet from a completed Stripe checkout session (USD).
 * Credits USD balance, not sats — no currency conversion.
 */
export async function creditFromCheckout(
  walletId: string,
  amountUsdCents: number,
  checkoutSessionId: string,
): Promise<{ wallet: Wallet; transaction: Transaction }> {
  return await db.transaction(async (tx) => {
    const [wallet] = await tx
      .update(schema.wallets)
      .set({
        balanceUsdCents: sql`${schema.wallets.balanceUsdCents} + ${amountUsdCents}`,
        lifetimeInUsdCents: sql`${schema.wallets.lifetimeInUsdCents} + ${amountUsdCents}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.wallets.id, walletId))
      .returning();

    if (!wallet) {
      throw new NotFoundError('Wallet', walletId);
    }

    const [transaction] = await tx
      .insert(schema.transactions)
      .values({
        id: generateId(ID_PREFIXES.transaction),
        walletId,
        type: 'credit_stripe',
        currency: 'usd_cents',
        amountSats: 0, // No sats for USD transactions
        amountUsdCents,
        balanceAfter: 0, // Sats balance unchanged
        balanceAfterUsdCents: wallet.balanceUsdCents,
        referenceType: 'checkout_session',
        referenceId: checkoutSessionId,
        description: `Card deposit of $${(amountUsdCents / 100).toFixed(2)}`,
        createdAt: new Date(),
      })
      .returning();

    return { wallet, transaction };
  });
}

/**
 * Atomically hold USD cents for an upcoming proxy call.
 */
export async function holdUsd(
  walletId: string,
  amountUsdCents: number,
): Promise<HoldResult> {
  const result = await db.execute<typeof schema.wallets.$inferSelect>(
    sql`UPDATE wallets
        SET balance_usd_cents = balance_usd_cents - ${amountUsdCents},
            held_usd_cents = held_usd_cents + ${amountUsdCents},
            updated_at = NOW()
        WHERE id = ${walletId}
          AND balance_usd_cents >= ${amountUsdCents}
        RETURNING *`,
  );

  const rows = result.rows ?? [];
  if (rows.length === 0) {
    return { success: false, wallet: null, currency: 'usd_cents' };
  }

  return { success: true, wallet: rows[0] as unknown as Wallet, currency: 'usd_cents' };
}

/**
 * Settle a held USD amount after a successful proxy call.
 */
export async function settleUsd(
  walletId: string,
  heldAmount: number,
  finalAmount: number,
  agentId?: string | null,
): Promise<{ wallet: Wallet; transaction: Transaction }> {
  const refund = heldAmount - finalAmount;

  return await db.transaction(async (tx) => {
    const [wallet] = await tx
      .update(schema.wallets)
      .set({
        heldUsdCents: sql`${schema.wallets.heldUsdCents} - ${heldAmount}`,
        balanceUsdCents: sql`${schema.wallets.balanceUsdCents} + ${refund}`,
        lifetimeOutUsdCents: sql`${schema.wallets.lifetimeOutUsdCents} + ${finalAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.wallets.id, walletId))
      .returning();

    if (!wallet) {
      throw new NotFoundError('Wallet', walletId);
    }

    const [transaction] = await tx
      .insert(schema.transactions)
      .values({
        id: generateId(ID_PREFIXES.transaction),
        walletId,
        agentId: agentId ?? null,
        type: 'debit_proxy_call',
        currency: 'usd_cents',
        amountSats: 0,
        amountUsdCents: finalAmount,
        balanceAfter: 0,
        balanceAfterUsdCents: wallet.balanceUsdCents,
        referenceType: 'proxy_call',
        referenceId: null,
        description: `Proxy call: $${(finalAmount / 100).toFixed(2)} (held $${(heldAmount / 100).toFixed(2)}, refunded $${(refund / 100).toFixed(2)})`,
        createdAt: new Date(),
      })
      .returning();

    return { wallet, transaction };
  });
}

/**
 * Release a USD hold — moves USD from held back to balance.
 */
export async function releaseUsd(
  walletId: string,
  heldAmount: number,
  agentId?: string | null,
): Promise<Wallet> {
  return await db.transaction(async (tx) => {
    const [wallet] = await tx
      .update(schema.wallets)
      .set({
        heldUsdCents: sql`${schema.wallets.heldUsdCents} - ${heldAmount}`,
        balanceUsdCents: sql`${schema.wallets.balanceUsdCents} + ${heldAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.wallets.id, walletId))
      .returning();

    if (!wallet) {
      throw new NotFoundError('Wallet', walletId);
    }

    await tx
      .insert(schema.transactions)
      .values({
        id: generateId(ID_PREFIXES.transaction),
        walletId,
        agentId: agentId ?? null,
        type: 'refund',
        currency: 'usd_cents',
        amountSats: 0,
        amountUsdCents: heldAmount,
        balanceAfter: 0,
        balanceAfterUsdCents: wallet.balanceUsdCents,
        referenceType: 'hold_release',
        referenceId: null,
        description: `Hold released: $${(heldAmount / 100).toFixed(2)} returned`,
        createdAt: new Date(),
      });

    return wallet;
  });
}

// ---------------------------------------------------------------------------
// Dual-currency hold/settle/release (default-currency-first logic)
// ---------------------------------------------------------------------------

/**
 * Hold funds using default-currency-first logic.
 * Tries account's default currency first, falls back to the other.
 */
export async function hold(
  walletId: string,
  defaultCurrency: Currency,
  costUsdCents: number,
  costSats: number,
): Promise<HoldResult> {
  if (defaultCurrency === 'usd_cents') {
    // Try USD first
    const usdResult = await holdUsd(walletId, costUsdCents);
    if (usdResult.success) return usdResult;

    // Fall back to sats
    return await holdSats(walletId, costSats);
  } else {
    // Try sats first
    const satsResult = await holdSats(walletId, costSats);
    if (satsResult.success) return satsResult;

    // Fall back to USD
    return await holdUsd(walletId, costUsdCents);
  }
}

/**
 * Settle funds in the specified currency.
 */
export async function settle(
  walletId: string,
  currency: Currency,
  heldAmount: number,
  finalAmount: number,
  agentId?: string | null,
): Promise<{ wallet: Wallet; transaction: Transaction }> {
  if (currency === 'usd_cents') {
    return await settleUsd(walletId, heldAmount, finalAmount, agentId);
  } else {
    return await settleSats(walletId, heldAmount, finalAmount, agentId);
  }
}

/**
 * Release a hold in the specified currency.
 */
export async function release(
  walletId: string,
  currency: Currency,
  heldAmount: number,
  agentId?: string | null,
): Promise<Wallet> {
  if (currency === 'usd_cents') {
    return await releaseUsd(walletId, heldAmount, agentId);
  } else {
    return await releaseSats(walletId, heldAmount, agentId);
  }
}

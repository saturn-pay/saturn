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

export interface HoldResult {
  success: boolean;
  wallet: Wallet | null;
}

// ---------------------------------------------------------------------------
// Service functions
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

/**
 * Credit a wallet from a settled Lightning invoice.
 * Runs inside a DB transaction: updates wallet balance + lifetime_in,
 * then inserts a credit transaction record.
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
 * Credit a wallet from a completed Stripe checkout session.
 * Same pattern as creditFromInvoice but with credit_stripe type.
 */
export async function creditFromCheckout(
  walletId: string,
  amountSats: number,
  checkoutSessionId: string,
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
        type: 'credit_stripe',
        amountSats,
        balanceAfter: wallet.balanceSats,
        referenceType: 'checkout_session',
        referenceId: checkoutSessionId,
        description: `Card deposit of ${amountSats} sats`,
        createdAt: new Date(),
      })
      .returning();

    return { wallet, transaction };
  });
}

/**
 * Atomically hold sats for an upcoming proxy call.
 * Moves sats from balance_sats to held_sats using a WHERE guard so the
 * operation fails gracefully when the balance is insufficient.
 */
export async function hold(
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
    return { success: false, wallet: null };
  }

  return { success: true, wallet: rows[0] as unknown as Wallet };
}

/**
 * Settle a held amount after a successful proxy call.
 * If the final cost is less than the held amount, the overage is refunded
 * back to the balance. Updates lifetime_out and inserts a debit transaction.
 */
export async function settle(
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
 * Release a hold — moves sats from held back to balance.
 * Used when an upstream call fails and the hold should be reversed.
 */
export async function release(
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

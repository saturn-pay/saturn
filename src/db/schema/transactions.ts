import { pgTable, text, bigint, timestamp, unique, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { wallets } from './wallets.js';

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  walletId: text('wallet_id').notNull().references(() => wallets.id),
  agentId: text('agent_id'),
  type: text('type', { enum: ['credit_lightning', 'credit_stripe', 'debit_proxy_call', 'refund', 'withdrawal'] }).notNull(),
  currency: text('currency', { enum: ['sats', 'usd_cents'] }).notNull().default('sats'),
  // Sats amounts (for Lightning transactions)
  amountSats: bigint('amount_sats', { mode: 'number' }).notNull(),
  balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),
  // USD amounts (for Stripe transactions)
  amountUsdCents: bigint('amount_usd_cents', { mode: 'number' }),
  balanceAfterUsdCents: bigint('balance_after_usd_cents', { mode: 'number' }),
  referenceType: text('reference_type'),
  referenceId: text('reference_id'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('tx_reference_unique').on(table.referenceType, table.referenceId),
  index('tx_wallet_created_idx').on(table.walletId, table.createdAt),
  check('currency_valid', sql`${table.currency} IN ('sats', 'usd_cents')`),
]);

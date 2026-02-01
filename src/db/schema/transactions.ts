import { pgTable, text, bigint, timestamp } from 'drizzle-orm/pg-core';
import { wallets } from './wallets.js';

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  walletId: text('wallet_id').notNull().references(() => wallets.id),
  type: text('type', { enum: ['credit_lightning', 'debit_proxy_call', 'refund', 'withdrawal'] }).notNull(),
  amountSats: bigint('amount_sats', { mode: 'number' }).notNull(),
  balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),
  referenceType: text('reference_type'),
  referenceId: text('reference_id'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

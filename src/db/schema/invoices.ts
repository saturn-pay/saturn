import { pgTable, text, bigint, timestamp } from 'drizzle-orm/pg-core';
import { wallets } from './wallets.js';

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  walletId: text('wallet_id').notNull().references(() => wallets.id),
  amountSats: bigint('amount_sats', { mode: 'number' }).notNull(),
  paymentRequest: text('payment_request').notNull(),
  rHash: text('r_hash').unique().notNull(),
  status: text('status', { enum: ['pending', 'settled', 'expired', 'cancelled'] }).notNull().default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  settledAt: timestamp('settled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

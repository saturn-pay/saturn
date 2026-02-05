import { pgTable, text, bigint, integer, numeric, timestamp, index } from 'drizzle-orm/pg-core';
import { wallets } from './wallets.js';

export const checkoutSessions = pgTable('checkout_sessions', {
  id: text('id').primaryKey(),
  walletId: text('wallet_id').notNull().references(() => wallets.id),
  stripeSessionId: text('stripe_session_id').unique().notNull(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  amountUsdCents: integer('amount_usd_cents').notNull(),
  btcUsdRate: numeric('btc_usd_rate').notNull(),
  amountSats: bigint('amount_sats', { mode: 'number' }).notNull(),
  status: text('status', { enum: ['pending', 'completed', 'expired', 'failed'] }).notNull().default('pending'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('checkout_sessions_wallet_idx').on(table.walletId),
  index('checkout_sessions_stripe_session_idx').on(table.stripeSessionId),
  index('checkout_sessions_status_idx').on(table.status),
]);

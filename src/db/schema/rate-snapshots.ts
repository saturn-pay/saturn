import { pgTable, text, numeric, timestamp } from 'drizzle-orm/pg-core';

export const rateSnapshots = pgTable('rate_snapshots', {
  id: text('id').primaryKey(),
  btcUsd: numeric('btc_usd', { precision: 16, scale: 2 }).notNull(),
  source: text('source').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
});

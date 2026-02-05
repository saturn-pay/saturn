import { pgTable, text, bigint, timestamp, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { accounts } from './accounts.js';

export const wallets = pgTable('wallets', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().unique().references(() => accounts.id),
  balanceSats: bigint('balance_sats', { mode: 'number' }).notNull().default(0),
  heldSats: bigint('held_sats', { mode: 'number' }).notNull().default(0),
  lifetimeIn: bigint('lifetime_in', { mode: 'number' }).notNull().default(0),
  lifetimeOut: bigint('lifetime_out', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('balance_non_negative', sql`${table.balanceSats} >= 0`),
  check('held_non_negative', sql`${table.heldSats} >= 0`),
]);

import { pgTable, text, timestamp, check, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  defaultCurrency: text('default_currency', { enum: ['sats', 'usd_cents'] }).notNull().default('usd_cents'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('default_currency_valid', sql`${table.defaultCurrency} IN ('sats', 'usd_cents')`),
  index('accounts_email_idx').on(table.email),
]);

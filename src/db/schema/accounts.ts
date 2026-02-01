import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  apiKeyHash: text('api_key_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

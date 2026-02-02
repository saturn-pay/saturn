import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';

export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  name: text('name').notNull(),
  apiKeyHash: text('api_key_hash').notNull(),
  apiKeyPrefix: text('api_key_prefix'),
  email: text('email'),
  role: text('role', { enum: ['primary', 'worker'] }).notNull().default('worker'),
  status: text('status', { enum: ['active', 'suspended', 'killed'] }).notNull().default('active'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('agents_key_prefix_idx').on(table.apiKeyPrefix),
]);

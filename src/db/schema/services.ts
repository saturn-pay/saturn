import { pgTable, text, bigint, timestamp, unique } from 'drizzle-orm/pg-core';

export const services = pgTable('services', {
  id: text('id').primaryKey(),
  slug: text('slug').unique().notNull(),
  name: text('name').notNull(),
  description: text('description'),
  tier: text('tier').notNull(),
  status: text('status', { enum: ['active', 'disabled'] }).notNull().default('active'),
  baseUrl: text('base_url').notNull(),
  authType: text('auth_type', { enum: ['bearer', 'api_key_header', 'basic', 'query_param'] }).notNull(),
  authCredentialEnv: text('auth_credential_env').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const servicePricing = pgTable('service_pricing', {
  id: text('id').primaryKey(),
  serviceId: text('service_id').notNull().references(() => services.id),
  operation: text('operation').notNull(),
  costUsdMicros: bigint('cost_usd_micros', { mode: 'number' }).notNull(),
  priceUsdMicros: bigint('price_usd_micros', { mode: 'number' }).notNull(),
  priceSats: bigint('price_sats', { mode: 'number' }).notNull(),
  unit: text('unit', { enum: ['per_request', 'per_1k_tokens', 'per_minute'] }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('service_operation_unique').on(table.serviceId, table.operation),
]);

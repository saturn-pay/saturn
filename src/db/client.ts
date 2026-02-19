import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';

const { Pool } = pg;

let pool: pg.Pool;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 50, // Max connections in pool (default was 10)
      idleTimeoutMillis: 30_000, // Close idle connections after 30s
      connectionTimeoutMillis: 5_000, // Fail fast if can't connect in 5s
    });
  }
  return pool;
}

export const db = drizzle(getPool(), { schema });

export async function testConnection(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

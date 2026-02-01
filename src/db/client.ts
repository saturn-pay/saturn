import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';

const { Pool } = pg;

let pool: pg.Pool;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
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

import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, getPool } from './client.js';

async function run() {
  console.log('Running database migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations complete');
  await getPool().end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

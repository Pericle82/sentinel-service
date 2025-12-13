import 'dotenv/config';
import { loadEnv } from '@/infrastructure/config/env.js';
import { createPostgresDatabase } from '@/infrastructure/db/postgresDatabase.js';
import { runMigrations } from '@/infrastructure/db/migrate.js';

const config = loadEnv(process.env);

if (!config.data.databaseUrl) {
  throw new Error('DATABASE_URL is required to run migrations');
}

const db = createPostgresDatabase({ connectionString: config.data.databaseUrl });

try {
  await runMigrations(db, new URL('../../../migrations', import.meta.url).pathname);
  process.stdout.write('Migrations applied\n');
} finally {
  await db.close();
}

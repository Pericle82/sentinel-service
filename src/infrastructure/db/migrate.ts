import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Database } from '@/application/ports/db/Database.js';

type Migration = { filename: string; sql: string };

async function ensureMigrationsTable(db: Database) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getApplied(db: Database): Promise<Set<string>> {
  const res = await db.query<{ filename: string }>('SELECT filename FROM schema_migrations');
  return new Set(res.rows.map((r) => r.filename));
}

async function loadMigrations(dir: string): Promise<Migration[]> {
  const entries = await readdir(dir);
  const files = entries.filter((f) => f.endsWith('.sql')).sort();
  const migrations = await Promise.all(
    files.map(async (filename) => ({
      filename,
      sql: await readFile(join(dir, filename), 'utf8')
    }))
  );
  return migrations;
}

export async function runMigrations(db: Database, dir: string) {
  await ensureMigrationsTable(db);
  const applied = await getApplied(db);
  const migrations = await loadMigrations(dir);

  for (const m of migrations) {
    if (applied.has(m.filename)) continue;

    await db.query('BEGIN');
    try {
      await db.query(m.sql);
      await db.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [m.filename]);
      await db.query('COMMIT');
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  }
}

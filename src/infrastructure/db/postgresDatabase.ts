import { Pool } from 'pg';
import type { Database } from '@/application/ports/db/Database.js';

export function createPostgresDatabase(options: { connectionString: string }): Database {
  const pool = new Pool({ connectionString: options.connectionString });

  return {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]) {
      const res = await pool.query(sql, params as unknown[] | undefined);
      return { rows: res.rows as T[] };
    },

    async close() {
      await pool.end();
    }
  };
}

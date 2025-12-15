import type { Database } from '@/application/ports/db/Database.js';

/**
 * Lightweight advisory lock guard for jobs, to avoid double-running across replicas.
 * Uses pg_try_advisory_lock(hashtext(name)) so callers should pass stable names.
 */
export function createJobLock(db: Database) {
  const runWithLock = async <T>(name: string, fn: () => Promise<T>): Promise<{ locked: boolean; result?: T }> => {
    const res = await db.query<{ locked: boolean }>('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [name]);
    const locked = res.rows[0]?.locked === true;
    if (!locked) return { locked: false };

    try {
      const result = await fn();
      return { locked: true, result };
    } finally {
      // Best effort unlock; ignore failures so we don't mask job errors.
      await db.query('SELECT pg_advisory_unlock(hashtext($1))', [name]).catch(() => {});
    }
  };

  return { runWithLock };
}

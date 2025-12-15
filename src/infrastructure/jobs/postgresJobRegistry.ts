import type { Job, JobName, JobRegistry } from '@/application/ports/jobs/JobRegistry.js';
import type { Database } from '@/application/ports/db/Database.js';

function buildUpsertSql(jobs: Job[]): { sql: string; params: unknown[] } {
  if (jobs.length === 0) {
    return { sql: '', params: [] };
  }

  const values: string[] = [];
  const params: unknown[] = [];

  jobs.forEach((job, idx) => {
    const nameIdx = idx * 2 + 1;
    const descIdx = idx * 2 + 2;
    values.push(`($${nameIdx}, $${descIdx})`);
    params.push(job.name, job.description ?? null);
  });

  const sql = `INSERT INTO jobs (name, description)
               VALUES ${values.join(', ')}
               ON CONFLICT (name) DO UPDATE
               SET description = EXCLUDED.description,
                   updated_at = NOW()`;
  return { sql, params };
}

export function createPostgresJobRegistry(db: Database, jobs: Job[] = []): JobRegistry {
  const map = new Map<JobName, Job>();
  for (const job of jobs) map.set(job.name, job);

  const seedPromise = (async () => {
    const { sql, params } = buildUpsertSql(jobs);
    if (!sql) return;
    try {
      await db.query(sql, params);
    } catch (err) {
      // Avoid crashing app on startup if DB is temporarily unavailable; jobs still exist in memory.
      // Calling code can choose to log more context via a wrapping logger if needed.
      console.warn('PostgresJobRegistry seed failed; running without persisted job metadata', err);
    }
  })();

  return {
    async list() {
      await seedPromise;
      const res = await db.query<{ name: string }>('SELECT name FROM jobs ORDER BY name');
      return res.rows.map((r) => r.name);
    },
    async run(name) {
      await seedPromise;
      const job = map.get(name);
      if (!job) throw new Error(`Unknown job: ${name}`);
      await job.run();
      await db
        .query('UPDATE jobs SET last_run_at = NOW(), updated_at = NOW() WHERE name = $1', [name])
        .catch(() => {});
    }
  };
}

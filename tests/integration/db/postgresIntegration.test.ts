import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { join } from 'node:path';

import { createPostgresDatabase } from '@/infrastructure/db/postgresDatabase.js';
import { runMigrations } from '@/infrastructure/db/migrate.js';
import { createPostgresUserRepo } from '@/infrastructure/user/postgresUserRepo.js';
import { createPostgresUserProfileRepo } from '@/infrastructure/userProfile/postgresUserProfileRepo.js';
import type { Database } from '@/application/ports/db/Database.js';

const databaseUrl = process.env['DATABASE_URL'] ?? 'postgres://postgres:postgres@localhost:5432/greenfield_service';
const migrationsDir = join(process.cwd(), 'migrations');

const hasDatabase = Boolean(process.env['DATABASE_URL']);

if (!hasDatabase) {
  describe.skip('postgres adapters + migrations', () => {
    it('skipped because DATABASE_URL is not set', () => {
      expect(true).toBe(true);
    });
  });
} else {

let db: Database;

async function truncateAll() {
  await db.query('TRUNCATE TABLE user_profiles RESTART IDENTITY CASCADE');
  await db.query('TRUNCATE TABLE user_identities RESTART IDENTITY CASCADE');
  await db.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  await db.query('TRUNCATE TABLE schema_migrations');
}

const profileInput = {
  height: 180,
  weight: 80,
  age: 30,
  gender: 'male' as const,
  workLifestyle: { jobType: 'desk' },
  sleepPatterns: { avgBedtime: '23:00', avgWakeTime: '07:00' }
};

describe('postgres adapters + migrations', () => {
  beforeAll(async () => {
    db = createPostgresDatabase({ connectionString: databaseUrl });
    await runMigrations(db, migrationsDir);
  }, 30_000);

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await truncateAll();
    await runMigrations(db, migrationsDir);
  });

  it('applies migrations idempotently and creates required tables', async () => {
    await runMigrations(db, migrationsDir); // second run should be no-op
    const tables = await db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'users'
       ) AS exists`
    );
    expect(tables.rows[0]?.exists).toBe(true);
  });

  it('user repo upserts users and identities without duplicates', async () => {
    const userRepo = createPostgresUserRepo(db);
    const identity = { provider: 'oidc', externalId: 'sub-1', email: 'a@example.com', name: 'Alice' };

    const first = await userRepo.findOrCreateByExternalIdentity(identity);
    const again = await userRepo.findOrCreateByExternalIdentity(identity);
    expect(again.id).toBe(first.id);

    // Changing profile email/name should update identity record but keep same user
    const updated = await userRepo.findOrCreateByExternalIdentity({ ...identity, email: 'new@example.com', name: 'Al' });
    expect(updated.id).toBe(first.id);
  });

  it('user profile repo upserts, patches, and cascades on user delete', async () => {
    const userRepo = createPostgresUserRepo(db);
    const profileRepo = createPostgresUserProfileRepo(db);
    const user = await userRepo.findOrCreateByExternalIdentity({ provider: 'oidc', externalId: 'sub-2', email: 'b@example.com' });

    const { profile, created } = await profileRepo.upsertByUserId(user.id, profileInput);
    expect(created).toBe(true);
    expect(profile.weight).toBe(80);

    const patched = await profileRepo.patchByUserId(user.id, { weight: 75, goals: 'lean' });
    expect(patched?.weight).toBe(75);
    expect(patched?.goals).toBe('lean');

    const found = await profileRepo.findByUserId(user.id);
    expect(found?.weight).toBe(75);
    expect(found?.workLifestyle?.jobType).toBe('desk');

    // Cascade delete when user removed
    await db.query('DELETE FROM users WHERE id = $1', [user.id]);
    const afterDelete = await profileRepo.findByUserId(user.id);
    expect(afterDelete).toBeNull();
  });
});
}

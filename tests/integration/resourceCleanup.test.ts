import { describe, expect, it, vi } from 'vitest';

import { createApp } from '@/interfaces/http/createApp.js';
import { createLoggerConfig } from '@/infrastructure/logging/logger.js';

const mocks = vi.hoisted(() => {
  const fakeDb = {
    query: vi.fn(async () => ({ rows: [] })),
    close: vi.fn(async () => {})
  };
  const fakeRedis = {
    close: vi.fn(async () => {})
  };
  const fakeScheduled = { stop: vi.fn(() => {}) };

  return {
    fakeDb,
    fakeRedis,
    fakeScheduled
  };
});

vi.mock('@/infrastructure/db/postgresDatabase.js', () => ({
  createPostgresDatabase: () => mocks.fakeDb
}));

vi.mock('@/infrastructure/cache/redisCache.js', () => ({
  createRedisCache: () => mocks.fakeRedis
}));

vi.mock('@/infrastructure/jobs/cronScheduler.js', () => ({
  scheduleCronJob: () => mocks.fakeScheduled
}));

describe('resource cleanup on app close', () => {
  it('closes db, redis, and stops cron on onClose', async () => {
    const rawEnv = {
      NODE_ENV: 'test',
      AUTH_MODE: 'disabled',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/testdb',
      REDIS_URL: 'redis://localhost:6379',
      SESSION_SECRET: 'test-session-secret-123',
      DEV_USER_SUB: 'dev',
      DEV_USER_ROLES: 'admin'
    } as NodeJS.ProcessEnv;

    const { app } = await createApp(rawEnv, {
      loggerConfig: createLoggerConfig({ level: 'silent', nodeEnv: 'test' })
    });

    await app.close();

    expect(mocks.fakeDb.close).toHaveBeenCalledTimes(1);
    expect(mocks.fakeRedis.close).toHaveBeenCalledTimes(1);
    expect(mocks.fakeScheduled.stop).toHaveBeenCalledTimes(1);
  });
});

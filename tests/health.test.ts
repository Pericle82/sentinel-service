import { describe, expect, it } from 'vitest';

import { loadEnv } from '../src/infrastructure/config/env.js';
import { createLoggerConfig } from '../src/infrastructure/logging/logger.js';
import { createSystemClock } from '../src/infrastructure/time/systemClock.js';
import { createGetHealth } from '../src/application/usecases/getHealth.js';
import { createGetMe } from '../src/application/usecases/getMe.js';
import { createRunJob } from '../src/application/usecases/runJob.js';
import { createAuthorizationService } from '../src/application/authorization/authorize.js';
import { createInMemoryPermissionRepository } from '../src/infrastructure/rbac/inMemoryPermissionRepository.js';
import { createInMemoryJobRegistry } from '../src/infrastructure/jobs/inMemoryJobRegistry.js';
import { buildHttpServer } from '../src/interfaces/http/server.js';

describe('GET /health', () => {
  it('returns ok', async () => {
    const config = loadEnv({ ...process.env, NODE_ENV: 'test' });
    const loggerConfig = createLoggerConfig({ level: 'silent', nodeEnv: 'test' });

    const authz = createAuthorizationService(createInMemoryPermissionRepository());
    const jobRegistry = createInMemoryJobRegistry();

    const app = await buildHttpServer({
      loggerConfig,
      config,
      getHealth: createGetHealth(createSystemClock()),
      getMe: createGetMe(),
      runJob: createRunJob(jobRegistry),
      authz
    });

    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toMatchObject({ status: 'ok' });
    expect(typeof body.now).toBe('string');

    await app.close();
  });
});

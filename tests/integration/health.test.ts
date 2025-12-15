import { describe, expect, it } from 'vitest';

import { loadEnv } from '@/infrastructure/config/env.js';
import { createLoggerConfig } from '@/infrastructure/logging/logger.js';
import { createSystemClock } from '@/infrastructure/time/systemClock.js';
import { createGetHealth } from '@/application/usecases/getHealth.js';
import { createGetMe } from '@/application/usecases/getMe.js';
import { createRunJob } from '@/application/usecases/runJob.js';
import { createAuthorizationService } from '@/application/authorization/authorize.js';
import { createInMemoryPermissionRepository } from '@/infrastructure/rbac/inMemoryPermissionRepository.js';
import { createInMemoryJobRegistry } from '@/infrastructure/jobs/inMemoryJobRegistry.js';
import { createInMemoryAuditLogger } from '@/infrastructure/audit/inMemoryAuditLogger.js';
import { buildHttpServer } from '@/interfaces/http/server.js';
import type {
  GetUserProfile,
  UpsertUserProfile,
  PatchUserProfile,
  DeleteUserProfile,
  CalculateUserBmi,
  GetProfileCompletion
} from '@/application/usecases/userProfile.js';

describe('GET /health', () => {
  it('returns ok', async () => {
    const config = loadEnv({ ...process.env, NODE_ENV: 'test' });
    const loggerConfig = createLoggerConfig({ level: 'silent', nodeEnv: 'test' });

    const authz = createAuthorizationService(createInMemoryPermissionRepository());
    const jobRegistry = createInMemoryJobRegistry();
    const { logger: auditLogger } = createInMemoryAuditLogger();

    const stubProfileUsecases: {
      getUserProfile: GetUserProfile;
      upsertUserProfile: UpsertUserProfile;
      patchUserProfile: PatchUserProfile;
      deleteUserProfile: DeleteUserProfile;
      calcUserBmi: CalculateUserBmi;
      profileCompletion: GetProfileCompletion;
    } = {
      getUserProfile: { async execute() { throw new Error('not used in health test'); } },
      upsertUserProfile: { async execute() { throw new Error('not used in health test'); } },
      patchUserProfile: { async execute() { throw new Error('not used in health test'); } },
      deleteUserProfile: { async execute() { throw new Error('not used in health test'); } },
      calcUserBmi: { async execute() { throw new Error('not used in health test'); } },
      profileCompletion: { async execute() { throw new Error('not used in health test'); } }
    };

    const app = await buildHttpServer({
      loggerConfig,
      config,
      getHealth: createGetHealth(createSystemClock()),
      getMe: createGetMe(),
      runJob: createRunJob(jobRegistry),
      authz,
      auditLogger,
      ...stubProfileUsecases
    });

    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toMatchObject({ status: 'ok' });
    expect(typeof body.now).toBe('string');

    await app.close();
  });
});

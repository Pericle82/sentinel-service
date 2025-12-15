import { describe, expect, it } from 'vitest';

import { loadEnv } from '@/infrastructure/config/env.js';
import { createLoggerConfig } from '@/infrastructure/logging/logger.js';
import { createSystemClock } from '@/infrastructure/time/systemClock.js';
import { createGetHealth } from '@/application/usecases/getHealth.js';
import { createGetMe } from '@/application/usecases/getMe.js';
import { createRunJob } from '@/application/usecases/runJob.js';
import {
  createResolveUserId,
  createGetUserProfile,
  createUpsertUserProfile,
  createPatchUserProfile,
  createDeleteUserProfile,
  createCalculateUserBmi,
  createGetProfileCompletion
} from '@/application/usecases/userProfile.js';
import { createAuthorizationService } from '@/application/authorization/authorize.js';
import { createInMemoryPermissionRepository } from '@/infrastructure/rbac/inMemoryPermissionRepository.js';
import { createInMemoryJobRegistry } from '@/infrastructure/jobs/inMemoryJobRegistry.js';
import { createInMemoryAuditLogger } from '@/infrastructure/audit/inMemoryAuditLogger.js';
import { createInMemoryUserRepo } from '@/infrastructure/user/inMemoryUserRepo.js';
import { createInMemoryUserProfileRepo } from '@/infrastructure/userProfile/inMemoryUserProfileRepo.js';
import { buildHttpServer } from '@/interfaces/http/server.js';
import type { TokenVerifier } from '@/application/ports/auth/TokenVerifier.js';

function makeUserProfileDeps() {
  const userRepo = createInMemoryUserRepo();
  const profileRepo = createInMemoryUserProfileRepo();
  const resolveUserId = createResolveUserId({ userRepo });

  return {
    getUserProfile: createGetUserProfile({ resolveUserId, profileRepo }),
    upsertUserProfile: createUpsertUserProfile({ resolveUserId, profileRepo }),
    patchUserProfile: createPatchUserProfile({ resolveUserId, profileRepo }),
    deleteUserProfile: createDeleteUserProfile({ resolveUserId, profileRepo }),
    calcUserBmi: createCalculateUserBmi({ resolveUserId, profileRepo }),
    profileCompletion: createGetProfileCompletion({ resolveUserId, profileRepo })
  };
}

function makeTokenVerifier(principal: { sub: string; roles: string[] }): TokenVerifier {
  return {
    async verifyAccessToken(_token: string) {
      return {
        principal: { ...principal, roles: principal.roles },
        rawClaims: { sub: principal.sub }
      };
    }
  };
}

describe('job registry propagation', () => {
  it('runs job and returns ok', async () => {
    const config = loadEnv({
      ...process.env,
      NODE_ENV: 'test',
      AUTH_MODE: 'oidc',
      OIDC_ISSUER: 'https://issuer.example',
      OIDC_CLIENT_ID: 'test-client',
      OIDC_REDIRECT_URI: 'https://app.example/callback',
      SESSION_SECRET: 'test-session-secret-123'
    });
    const loggerConfig = createLoggerConfig({ level: 'silent', nodeEnv: 'test' });

    let ran = 0;
    const jobRegistry = createInMemoryJobRegistry([
      {
        name: 'demo.job',
        async run() {
          ran += 1;
        }
      }
    ]);

    const { logger: auditLogger, getEvents } = createInMemoryAuditLogger();

    const perms = createInMemoryPermissionRepository({ admin: ['adminJobs.run'] });
    const authz = createAuthorizationService(perms);
    const profileDeps = makeUserProfileDeps();

    const app = await buildHttpServer({
      loggerConfig,
      config,
      getHealth: createGetHealth(createSystemClock()),
      getMe: createGetMe(),
      runJob: createRunJob(jobRegistry),
      authz,
      auditLogger,
      ...profileDeps,
      tokenVerifier: makeTokenVerifier({ sub: 'u1', roles: ['admin'] })
    });

    const res = await app.inject({
      method: 'POST',
      url: '/admin/jobs/demo.job/run',
      headers: { authorization: 'Bearer test' }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, job: 'demo.job' });
    expect(ran).toBe(1);

    const events = getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: 'job.run', resource: 'demo.job', outcome: 'success' });

    await app.close();
  });

  it('bubbles job failure as 500', async () => {
    const config = loadEnv({
      ...process.env,
      NODE_ENV: 'test',
      AUTH_MODE: 'oidc',
      OIDC_ISSUER: 'https://issuer.example',
      OIDC_CLIENT_ID: 'test-client',
      OIDC_REDIRECT_URI: 'https://app.example/callback',
      SESSION_SECRET: 'test-session-secret-123'
    });
    const loggerConfig = createLoggerConfig({ level: 'silent', nodeEnv: 'test' });

    let ran = 0;
    const jobRegistry = createInMemoryJobRegistry([
      {
        name: 'fail.job',
        async run() {
          ran += 1;
          throw new Error('boom');
        }
      }
    ]);

    const { logger: auditLogger, getEvents } = createInMemoryAuditLogger();

    const perms = createInMemoryPermissionRepository({ admin: ['adminJobs.run'] });
    const authz = createAuthorizationService(perms);
    const profileDeps = makeUserProfileDeps();

    const app = await buildHttpServer({
      loggerConfig,
      config,
      getHealth: createGetHealth(createSystemClock()),
      getMe: createGetMe(),
      runJob: createRunJob(jobRegistry),
      authz,
      auditLogger,
      ...profileDeps,
      tokenVerifier: makeTokenVerifier({ sub: 'u1', roles: ['admin'] })
    });

    const res = await app.inject({
      method: 'POST',
      url: '/admin/jobs/fail.job/run',
      headers: { authorization: 'Bearer test' }
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'INTERNAL_SERVER_ERROR', message: 'Unexpected error' });
    expect(ran).toBe(1);

    const events = getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: 'job.run', resource: 'fail.job', outcome: 'failure', error: 'boom' });

    await app.close();
  });
});

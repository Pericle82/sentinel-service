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

describe('auth + rbac scaffolding', () => {
  it('GET /me returns 401 without token (oidc mode)', async () => {
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

    const authz = createAuthorizationService(createInMemoryPermissionRepository());
    const jobRegistry = createInMemoryJobRegistry();
    const { logger: auditLogger } = createInMemoryAuditLogger();
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
      tokenVerifier: makeTokenVerifier({ sub: 'u1', roles: [] })
    });

    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);

    await app.close();
  });

  it('GET /me returns principal when token is valid', async () => {
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

    const authz = createAuthorizationService(createInMemoryPermissionRepository());
    const jobRegistry = createInMemoryJobRegistry();
    const { logger: auditLogger } = createInMemoryAuditLogger();
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
      method: 'GET',
      url: '/me',
      headers: { authorization: 'Bearer test' }
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toMatchObject({ authenticated: true, user: { sub: 'u1' } });

    await app.close();
  });

  it('POST /admin/jobs/:name/run requires permission', async () => {
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

    const jobRegistry = createInMemoryJobRegistry([
      {
        name: 'demo.job',
        async run() {}
      }
    ]);

    const perms = createInMemoryPermissionRepository({
      admin: ['adminJobs.run']
    });
    const authz = createAuthorizationService(perms);
    const profileDeps = makeUserProfileDeps();
    const { logger: auditLogger } = createInMemoryAuditLogger();

    const app = await buildHttpServer({
      loggerConfig,
      config,
      getHealth: createGetHealth(createSystemClock()),
      getMe: createGetMe(),
      runJob: createRunJob(jobRegistry),
      authz,
      auditLogger,
      ...profileDeps,
      tokenVerifier: makeTokenVerifier({ sub: 'u1', roles: ['viewer'] })
    });

    const forbidden = await app.inject({
      method: 'POST',
      url: '/admin/jobs/demo.job/run',
      headers: { authorization: 'Bearer test' }
    });
    expect(forbidden.statusCode).toBe(403);

    const app2 = await buildHttpServer({
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

    const ok = await app2.inject({
      method: 'POST',
      url: '/admin/jobs/demo.job/run',
      headers: { authorization: 'Bearer test' }
    });
    expect(ok.statusCode).toBe(200);

    const okBody = ok.json();
    expect(okBody).toMatchObject({ ok: true, job: 'demo.job' });

    await app.close();
    await app2.close();
  });
});

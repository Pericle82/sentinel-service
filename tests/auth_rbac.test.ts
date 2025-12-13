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
import type { TokenVerifier } from '../src/application/ports/auth/TokenVerifier.js';

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
    const config = loadEnv({ ...process.env, NODE_ENV: 'test', AUTH_MODE: 'oidc', OIDC_ISSUER: 'https://issuer.example' });
    const loggerConfig = createLoggerConfig({ level: 'silent', nodeEnv: 'test' });

    const authz = createAuthorizationService(createInMemoryPermissionRepository());
    const jobRegistry = createInMemoryJobRegistry();

    const app = await buildHttpServer({
      loggerConfig,
      config,
      getHealth: createGetHealth(createSystemClock()),
      getMe: createGetMe(),
      runJob: createRunJob(jobRegistry),
      authz,
      tokenVerifier: makeTokenVerifier({ sub: 'u1', roles: [] })
    });

    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);

    await app.close();
  });

  it('GET /me returns principal when token is valid', async () => {
    const config = loadEnv({ ...process.env, NODE_ENV: 'test', AUTH_MODE: 'oidc', OIDC_ISSUER: 'https://issuer.example' });
    const loggerConfig = createLoggerConfig({ level: 'silent', nodeEnv: 'test' });

    const authz = createAuthorizationService(createInMemoryPermissionRepository());
    const jobRegistry = createInMemoryJobRegistry();

    const app = await buildHttpServer({
      loggerConfig,
      config,
      getHealth: createGetHealth(createSystemClock()),
      getMe: createGetMe(),
      runJob: createRunJob(jobRegistry),
      authz,
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
    const config = loadEnv({ ...process.env, NODE_ENV: 'test', AUTH_MODE: 'oidc', OIDC_ISSUER: 'https://issuer.example' });
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

    const app = await buildHttpServer({
      loggerConfig,
      config,
      getHealth: createGetHealth(createSystemClock()),
      getMe: createGetMe(),
      runJob: createRunJob(jobRegistry),
      authz,
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

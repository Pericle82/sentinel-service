import type { FastifyInstance } from 'fastify';

import { loadEnv, type AppConfig } from '@/infrastructure/config/env.js';
import { createLoggerConfig } from '@/infrastructure/logging/logger.js';
import { createSystemClock } from '@/infrastructure/time/systemClock.js';
import { createGetHealth } from '@/application/usecases/getHealth.js';
import { createGetMe } from '@/application/usecases/getMe.js';
import { createRunJob } from '@/application/usecases/runJob.js';
import { createAuthorizationService } from '@/application/authorization/authorize.js';
import { buildHttpServer } from './server.js';
import { createInMemoryJobRegistry } from '@/infrastructure/jobs/inMemoryJobRegistry.js';
import { createSampleCleanupJob } from '@/infrastructure/jobs/sampleCleanupJob.js';
import { scheduleCronJob, type ScheduledJob } from '@/infrastructure/jobs/cronScheduler.js';
import { createInMemoryPermissionRepository } from '@/infrastructure/rbac/inMemoryPermissionRepository.js';
import { createPostgresDatabase } from '@/infrastructure/db/postgresDatabase.js';
import { createPostgresPermissionRepository } from '@/infrastructure/rbac/postgresPermissionRepository.js';
import { createOidcTokenVerifier, keycloakIssuer } from '@/infrastructure/auth/oidc/oidcTokenVerifier.js';
import { createRedisCache } from '@/infrastructure/cache/redisCache.js';
import type { TokenVerifier } from '@/application/ports/auth/TokenVerifier.js';
import type { PermissionRepository } from '@/application/ports/rbac/PermissionRepository.js';
import type { JobRegistry } from '@/application/ports/jobs/JobRegistry.js';
import { registerSession } from './plugins/session.js';
import { registerLoginRoute } from './routes/auth/loginRoute.js';
import { registerCallbackRoute } from './routes/auth/callbackRoute.js';
import { registerLogoutRoute } from './routes/auth/logoutRoute.js';

export type CreateAppOverrides = {
  config?: AppConfig;
  loggerConfig?: unknown;
  tokenVerifier?: TokenVerifier;
  permissionRepo?: PermissionRepository;
  jobRegistry?: JobRegistry;
};

export async function createApp(
  rawEnv: NodeJS.ProcessEnv = process.env,
  overrides: CreateAppOverrides = {}
): Promise<{ app: FastifyInstance; config: AppConfig }> {
  const config = overrides.config ?? loadEnv(rawEnv);
  const loggerConfig = overrides.loggerConfig ?? createLoggerConfig({ level: config.logLevel, nodeEnv: config.nodeEnv });

  const clock = createSystemClock();
  const getHealth = createGetHealth(clock);
  const getMe = createGetMe();

  const db = !overrides.permissionRepo && config.data.databaseUrl
    ? createPostgresDatabase({ connectionString: config.data.databaseUrl })
    : null;

  const permissionRepo =
    overrides.permissionRepo ??
    (db
      ? createPostgresPermissionRepository(db)
      : createInMemoryPermissionRepository({ admin: ['adminJobs.run'] }));
  const authz = createAuthorizationService(permissionRepo);

  const redis = config.data.redisUrl ? createRedisCache({ url: config.data.redisUrl }) : null;

  const jobRegistry = overrides.jobRegistry ??
    createInMemoryJobRegistry([
      createSampleCleanupJob({
        log: (msg, meta) => {
          const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
          process.stdout.write(`${msg}${suffix}\n`);
        }
      })
    ]);

  const scheduled: ScheduledJob[] = [
    scheduleCronJob({
      cronExpr: '0 * * * *',
      job: { name: 'sample.cleanup', run: () => jobRegistry.run('sample.cleanup') },
      enabled: config.jobs.enabled
    })
  ];

  const runJob = createRunJob(jobRegistry);

  let tokenVerifier: TokenVerifier | undefined = overrides.tokenVerifier;
  if (!tokenVerifier && config.auth.mode === 'oidc') {
    const issuer =
      config.auth.oidc.issuer ??
      (config.auth.keycloak.baseUrl && config.auth.keycloak.realm
        ? keycloakIssuer(config.auth.keycloak.baseUrl, config.auth.keycloak.realm)
        : undefined);

    const audience = config.auth.oidc.audience ?? config.auth.keycloak.clientId;
    if (!issuer) throw new Error('AUTH_MODE=oidc requires OIDC_ISSUER or KEYCLOAK_BASE_URL+KEYCLOAK_REALM');

    tokenVerifier = await createOidcTokenVerifier({
      issuer,
      ...(audience ? { audience } : {}),
      ...(config.auth.oidc.jwksUri ? { jwksUri: config.auth.oidc.jwksUri } : {})
    });
  }

  const app = await buildHttpServer({
    loggerConfig,
    config,
    getHealth,
    getMe,
    runJob,
    authz,
    ...(tokenVerifier ? { tokenVerifier } : {})
  });

  await registerSession(app, config);
  await registerLoginRoute(app, config);
  await registerCallbackRoute(app, config);
  await registerLogoutRoute(app, config);

  app.addHook('onClose', async () => {
    for (const s of scheduled) s.stop();
    if (redis) await redis.close();
    if (db) await db.close();
  });

  return { app, config };
}
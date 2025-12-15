import type { FastifyInstance } from 'fastify';

import { loadEnv, type AppConfig } from '@/infrastructure/config/env.js';
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
import { buildHttpServer } from './server.js';
import { createInMemoryJobRegistry } from '@/infrastructure/jobs/inMemoryJobRegistry.js';
import { createSampleCleanupJob } from '@/infrastructure/jobs/sampleCleanupJob.js';
import { createPostgresJobRegistry } from '../../infrastructure/jobs/postgresJobRegistry.js';
import { createJobLock } from '@/infrastructure/jobs/jobLock.js';
import { scheduleCronJob, type ScheduledJob } from '@/infrastructure/jobs/cronScheduler.js';
import { createInMemoryPermissionRepository } from '@/infrastructure/rbac/inMemoryPermissionRepository.js';
import { createPostgresDatabase } from '@/infrastructure/db/postgresDatabase.js';
import { createPostgresPermissionRepository } from '@/infrastructure/rbac/postgresPermissionRepository.js';
import { createOidcTokenVerifier, keycloakIssuer } from '@/infrastructure/auth/oidc/oidcTokenVerifier.js';
import { createRedisCache } from '@/infrastructure/cache/redisCache.js';
import { createInMemoryAuditLogger } from '@/infrastructure/audit/inMemoryAuditLogger.js';
import { createPostgresAuditLogger } from '@/infrastructure/audit/postgresAuditLogger.js';
import { createInMemoryUserRepo } from '@/infrastructure/user/inMemoryUserRepo.js';
import { createInMemoryUserProfileRepo } from '@/infrastructure/userProfile/inMemoryUserProfileRepo.js';
import { createPostgresUserRepo } from '@/infrastructure/user/postgresUserRepo.js';
import { createPostgresUserProfileRepo } from '@/infrastructure/userProfile/postgresUserProfileRepo.js';
import type { TokenVerifier } from '@/application/ports/auth/TokenVerifier.js';
import type { PermissionRepository } from '@/application/ports/rbac/PermissionRepository.js';
import type { JobRegistry } from '@/application/ports/jobs/JobRegistry.js';
import type { AuditLogger } from '@/application/ports/audit/AuditLogger.js';
import type { UserRepo } from '@/application/ports/user/UserRepo.js';
import type { UserProfileRepo } from '@/application/ports/userProfile/UserProfileRepo.js';
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
  auditLogger?: AuditLogger;
  userRepo?: UserRepo;
  userProfileRepo?: UserProfileRepo;
};

/**
 * Composition root for the HTTP app. Loads config, wires adapters, and returns the Fastify instance plus resolved config.
 */
export async function createApp(
  rawEnv: NodeJS.ProcessEnv = process.env,
  overrides: CreateAppOverrides = {}
): Promise<{ app: FastifyInstance; config: AppConfig }> {
  const config = overrides.config ?? loadEnv(rawEnv);
  const loggerConfig = overrides.loggerConfig ?? createLoggerConfig({ level: config.logLevel, nodeEnv: config.nodeEnv });

  const clock = createSystemClock();
  const getHealth = createGetHealth(clock);
  const getMe = createGetMe();

  const db = config.data.databaseUrl
    ? createPostgresDatabase({ connectionString: config.data.databaseUrl })
    : null;

  const userRepo = overrides.userRepo ?? (db ? createPostgresUserRepo(db) : createInMemoryUserRepo());
  const userProfileRepo =
    overrides.userProfileRepo ?? (db ? createPostgresUserProfileRepo(db) : createInMemoryUserProfileRepo());

  const permissionRepo =
    overrides.permissionRepo ??
    (db
      ? createPostgresPermissionRepository(db)
      : createInMemoryPermissionRepository({ admin: ['adminJobs.run', 'docs.view'] }));
  const authz = createAuthorizationService(permissionRepo);

  const redis = config.data.redisUrl ? createRedisCache({ url: config.data.redisUrl }) : null;

  const sampleJobs = [
    createSampleCleanupJob({
      log: (msg, meta) => {
        const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
        process.stdout.write(`${msg}${suffix}\n`);
      }
    })
  ];

  const jobRegistry = overrides.jobRegistry ??
    (db ? createPostgresJobRegistry(db, sampleJobs) : createInMemoryJobRegistry(sampleJobs));

  const jobLock = db ? createJobLock(db) : null;

  const auditLogger = overrides.auditLogger ?? (db ? createPostgresAuditLogger(db) : createInMemoryAuditLogger().logger);

  const scheduled: ScheduledJob[] = [
    scheduleCronJob({
      cronExpr: '0 * * * *',
      job: {
        name: 'sample.cleanup',
        run: () =>
          jobLock
            ? jobLock.runWithLock('sample.cleanup', () => jobRegistry.run('sample.cleanup')).then(() => undefined)
            : jobRegistry.run('sample.cleanup')
      },
      enabled: config.jobs.enabled
    })
  ];

  const runJob = createRunJob(jobRegistry);

  const resolveUserId = createResolveUserId({ userRepo });
  const getUserProfile = createGetUserProfile({ resolveUserId, profileRepo: userProfileRepo });
  const upsertUserProfile = createUpsertUserProfile({ resolveUserId, profileRepo: userProfileRepo });
  const patchUserProfile = createPatchUserProfile({ resolveUserId, profileRepo: userProfileRepo });
  const deleteUserProfile = createDeleteUserProfile({ resolveUserId, profileRepo: userProfileRepo });
  const calcUserBmi = createCalculateUserBmi({ resolveUserId, profileRepo: userProfileRepo });
  const profileCompletion = createGetProfileCompletion({ resolveUserId, profileRepo: userProfileRepo });

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
    getUserProfile,
    upsertUserProfile,
    patchUserProfile,
    deleteUserProfile,
    calcUserBmi,
    profileCompletion,
    authz,
    auditLogger,
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
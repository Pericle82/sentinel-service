import fastify, { type FastifyInstance } from 'fastify';

import type { AppConfig } from '@/infrastructure/config/env.js';
import type { GetHealth } from '@/application/usecases/getHealth.js';
import type { GetMe } from '@/application/usecases/getMe.js';
import type { RunJob } from '@/application/usecases/runJob.js';
import type {
  GetUserProfile,
  UpsertUserProfile,
  PatchUserProfile,
  DeleteUserProfile,
  CalculateUserBmi,
  GetProfileCompletion
} from '@/application/usecases/userProfile.js';
import type { AuthorizationService } from '@/application/authorization/authorize.js';
import type { TokenVerifier } from '@/application/ports/auth/TokenVerifier.js';
import type { AuditLogger } from '@/application/ports/audit/AuditLogger.js';
import { mapErrorToHttp } from './httpErrors.js';
import { registerAuth } from './plugins/auth.js';
import { registerDocs } from './plugins/docs.js';
import { registerSecurityPlugins } from './plugins/security.js';
import { registerHealthRoute } from './routes/healthRoute.js';
import { registerMeRoute } from './routes/meRoute.js';
import { registerAdminJobsRoute } from './routes/admin/adminJobsRoute.js';
import { registerUserProfileRoutes } from './routes/userProfileRoute.js';
import { getCurrentSpanIds } from '@/infrastructure/otel/tracing.js';

export type HttpServerDeps = {
  loggerConfig: unknown;
  config: AppConfig;
  getHealth: GetHealth;
  getMe: GetMe;
  runJob: RunJob;
  getUserProfile: GetUserProfile;
  upsertUserProfile: UpsertUserProfile;
  patchUserProfile: PatchUserProfile;
  deleteUserProfile: DeleteUserProfile;
  calcUserBmi: CalculateUserBmi;
  profileCompletion: GetProfileCompletion;
  authz: AuthorizationService;
  auditLogger: AuditLogger;
  tokenVerifier?: TokenVerifier;
};

/**
 * Builds the Fastify HTTP server with middleware, auth, routes, and error handling.
 */
export async function buildHttpServer(deps: HttpServerDeps): Promise<FastifyInstance> {
  const app = fastify({
    logger: deps.loggerConfig as Record<string, unknown>,
    trustProxy: deps.config.trustProxy
  });

  app.setErrorHandler((err, _req, reply) => {
    const mapped = mapErrorToHttp(err);

    // Log full error server-side; keep response generic.
    app.log.error({ err }, 'request failed');

    void reply.code(mapped.statusCode).send(mapped.body);
  });

  await registerSecurityPlugins(app, deps.config);
  await registerAuth(app, {
    config: deps.config,
    ...(deps.tokenVerifier ? { tokenVerifier: deps.tokenVerifier } : {})
  });

  app.addHook('onRequest', (req, _reply, done) => {
    const spanIds = getCurrentSpanIds();
    if (spanIds) req.log = req.log.child(spanIds);
    done();
  });
  await registerDocs(app, deps.config, deps.authz);
  await registerHealthRoute(app, { getHealth: deps.getHealth });
  await registerMeRoute(app, { getMe: deps.getMe });
  await registerUserProfileRoutes(app, {
    getProfile: deps.getUserProfile,
    upsertProfile: deps.upsertUserProfile,
    patchProfile: deps.patchUserProfile,
    deleteProfile: deps.deleteUserProfile,
    calcBmi: deps.calcUserBmi,
    profileCompletion: deps.profileCompletion,
    auditLogger: deps.auditLogger
  });
  await registerAdminJobsRoute(app, { authz: deps.authz, runJob: deps.runJob, auditLogger: deps.auditLogger });

  return app;
}

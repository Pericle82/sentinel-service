import fastify, { type FastifyInstance } from 'fastify';

import type { AppConfig } from '@/infrastructure/config/env.js';
import type { GetHealth } from '@/application/usecases/getHealth.js';
import type { GetMe } from '@/application/usecases/getMe.js';
import type { RunJob } from '@/application/usecases/runJob.js';
import type { AuthorizationService } from '@/application/authorization/authorize.js';
import type { TokenVerifier } from '@/application/ports/auth/TokenVerifier.js';
import { mapErrorToHttp } from './httpErrors.js';
import { registerAuth } from './plugins/auth.js';
import { registerSecurityPlugins } from './plugins/security.js';
import { registerHealthRoute } from './routes/healthRoute.js';
import { registerMeRoute } from './routes/meRoute.js';
import { registerAdminJobsRoute } from './routes/admin/adminJobsRoute.js';

export type HttpServerDeps = {
  loggerConfig: unknown;
  config: AppConfig;
  getHealth: GetHealth;
  getMe: GetMe;
  runJob: RunJob;
  authz: AuthorizationService;
  tokenVerifier?: TokenVerifier;
};

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
  await registerHealthRoute(app, { getHealth: deps.getHealth });
  await registerMeRoute(app, { getMe: deps.getMe });
  await registerAdminJobsRoute(app, { authz: deps.authz, runJob: deps.runJob });

  return app;
}

import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@/infrastructure/config/env.js';
import type { AuthorizationService } from '@/application/authorization/authorize.js';
import { requireAuth } from '@/interfaces/http/middleware/requireAuth.js';
import { requirePermission } from '@/interfaces/http/middleware/requirePermission.js';

/**
 * Registers OpenAPI docs (Swagger UI + JSON). Protected by auth + docs.view permission.
 */
export async function registerDocs(app: FastifyInstance, config: AppConfig, authz: AuthorizationService) {
  const docHost = config.host === '0.0.0.0' || config.host === '::' ? 'localhost' : config.host;
  const serverUrl = `http://${docHost}:${config.port}`;

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Lybra Service API',
        version: '1.0.0'
      },
      servers: [{ url: serverUrl }]
    }
  });

  await app.register(async (docsApp) => {
    docsApp.addHook('preHandler', requireAuth);
    docsApp.addHook('preHandler', requirePermission(authz, 'docs.view'));

    docsApp.get(
      '/docs/openapi.json',
      { schema: { hide: true } },
      async (_req, reply) => reply.send(docsApp.swagger())
    );

    await docsApp.register(swaggerUi, {
      routePrefix: '/docs',
      staticCSP: true,
      transformStaticCSP: (header) => header,
      uiConfig: {
          docExpansion: 'list',
          displayRequestDuration: true
      }
    });
  });
}

import type { FastifyInstance } from 'fastify';
import { buildAuthorizationUrl } from '@/infrastructure/auth/oidc/oidcWebClient.js';
import type { AppConfig } from '@/infrastructure/config/env.js';

export async function registerLoginRoute(app: FastifyInstance, config: AppConfig) {
  app.get('/auth/login', async (req, reply) => {
    if (config.auth.mode !== 'oidc') {
      return reply.code(400).send({ error: 'AUTH_DISABLED', message: 'OIDC not enabled' });
    }

    const { url, artifacts } = await buildAuthorizationUrl(config);
    (req.session as unknown as { set: (key: string, value: unknown) => void }).set('oidc_login', {
      state: artifacts.state,
      nonce: artifacts.nonce,
      codeVerifier: artifacts.codeVerifier,
      createdAt: Date.now()
    });

    return reply.redirect(url);
  });
}

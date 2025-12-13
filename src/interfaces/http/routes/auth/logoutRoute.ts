import type { FastifyInstance } from 'fastify';
import { buildLogoutUrl } from '@/infrastructure/auth/oidc/oidcWebClient.js';
import type { AppConfig } from '@/infrastructure/config/env.js';

export async function registerLogoutRoute(app: FastifyInstance, config: AppConfig) {
  app.post('/auth/logout', async (req, reply) => {
    const auth = req.session.get('auth') as { idToken?: string } | undefined;
    req.session.delete();

    if (config.auth.mode === 'oidc') {
      const url = await buildLogoutUrl(config, auth?.idToken);
      if (url) return reply.redirect(url);
    }

    const redirect = config.auth.oidc.postLogoutRedirectUri ?? '/';
    return reply.redirect(redirect);
  });
}

import type { FastifyInstance } from 'fastify';
import { handleCallback } from '@/infrastructure/auth/oidc/oidcWebClient.js';
import type { AppConfig } from '@/infrastructure/config/env.js';

export async function registerCallbackRoute(app: FastifyInstance, config: AppConfig) {
  app.get('/auth/callback', async (req, reply) => {
    const login = req.session.get('oidc_login') as
      | { state: string; nonce: string; codeVerifier: string; createdAt: number }
      | undefined;

    if (!login) return reply.code(400).send({ error: 'AUTH_FLOW', message: 'Missing login transaction' });

    // Optional expiry for login transaction (5 minutes)
    if (Date.now() - login.createdAt > 5 * 60 * 1000) {
      req.session.delete();
      return reply.code(400).send({ error: 'AUTH_FLOW', message: 'Login transaction expired' });
    }

    const { state, code } = req.query as { state?: string; code?: string };
    const callbackParams: { state?: string; code?: string } = {};
    if (state !== undefined) callbackParams.state = state;
    if (code !== undefined) callbackParams.code = code;

    try {
      const session = await handleCallback(
        config,
        callbackParams,
        { state: login.state, nonce: login.nonce, codeVerifier: login.codeVerifier }
      );

      (req.session as unknown as { set: (key: string, value: unknown) => void }).set('auth', {
        principal: session.principal,
        tokenExpiresAt: session.tokenExpiresAt,
        idToken: session.idToken
      });
      (req.session as unknown as { set: (key: string, value: unknown) => void }).set('oidc_login', undefined);

      return reply.redirect(config.auth.oidc.postLogoutRedirectUri ?? '/');
    } catch (err) {
      req.log.error({ err }, 'oidc callback failed');
      req.session.delete();
      return reply.code(401).send({ error: 'UNAUTHENTICATED', message: 'OIDC callback failed' });
    }
  });
}

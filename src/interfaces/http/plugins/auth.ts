import type { FastifyInstance } from 'fastify';
import type { TokenVerifier } from '@/application/ports/auth/TokenVerifier.js';
import type { AppConfig } from '@/infrastructure/config/env.js';

function bearerTokenFromHeader(header?: string): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function registerAuth(app: FastifyInstance, deps: { config: AppConfig; tokenVerifier?: TokenVerifier }) {
  app.addHook('preHandler', async (req, reply) => {
    // Session-based auth
    const sessionAuth = req.session.get('auth') as
      | { principal?: unknown; tokenExpiresAt?: number }
      | undefined;
    if (sessionAuth?.principal && sessionAuth.tokenExpiresAt && sessionAuth.tokenExpiresAt > Date.now()) {
      req.principal = sessionAuth.principal as typeof req.principal;
      return;
    }

    if (deps.config.auth.mode === 'disabled') {
      req.principal = {
        sub: deps.config.auth.devPrincipal.sub,
        roles: [...deps.config.auth.devPrincipal.roles]
      };
      return;
    }

    const token = bearerTokenFromHeader(req.headers.authorization);
    if (!token) return;

    if (!deps.tokenVerifier) {
      req.log.error('Auth mode is oidc but no token verifier is configured');
      return reply.code(500).send({ error: 'AUTH_MISCONFIGURED', message: 'Auth verifier not configured' });
    }

    try {
      const verified = await deps.tokenVerifier.verifyAccessToken(token);
      req.principal = verified.principal;
      req.rawClaims = verified.rawClaims;
    } catch {
      return reply.code(401).send({ error: 'UNAUTHENTICATED', message: 'Invalid access token' });
    }
  });
}

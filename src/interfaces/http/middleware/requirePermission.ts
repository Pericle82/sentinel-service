import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthorizationService } from '@/application/authorization/authorize.js';

export function requirePermission(authz: AuthorizationService, permission: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.principal) {
      return reply.code(401).send({ error: 'UNAUTHENTICATED', message: 'Missing access token' });
    }

    const ok = await authz.hasPermission(req.principal, permission);
    if (!ok) {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Insufficient permissions' });
    }
  };
}

import type { FastifyReply, FastifyRequest } from 'fastify';

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!req.principal) {
    return reply.code(401).send({ error: 'UNAUTHENTICATED', message: 'Missing access token' });
  }
}

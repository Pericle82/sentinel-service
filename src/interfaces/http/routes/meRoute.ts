import type { FastifyInstance } from 'fastify';
import type { GetMe } from '@/application/usecases/getMe.js';
import { requireAuth } from '@/interfaces/http/middleware/requireAuth.js';

export async function registerMeRoute(app: FastifyInstance, deps: { getMe: GetMe }) {
  app.get('/me', { preHandler: [requireAuth] }, async (req, reply) => {
    const payload = await deps.getMe.execute(req.principal!);
    return reply.code(200).send(payload);
  });
}

import type { FastifyInstance } from 'fastify';
import type { GetHealth } from '@/application/usecases/getHealth.js';

export async function registerHealthRoute(app: FastifyInstance, deps: { getHealth: GetHealth }) {
  app.get('/health', async (_req, reply) => {
    const payload = await deps.getHealth.execute();
    return reply.code(200).send(payload);
  });
}

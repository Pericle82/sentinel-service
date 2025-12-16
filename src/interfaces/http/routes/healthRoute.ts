import type { FastifyInstance } from 'fastify';
import type { GetHealth } from '@/application/usecases/getHealth.js';

const healthResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok'] },
    now: { type: 'string', format: 'date-time' }
  },
  required: ['status', 'now'],
  additionalProperties: false
} as const;

export async function registerHealthRoute(app: FastifyInstance, deps: { getHealth: GetHealth }) {
  app.get(
    '/health',
    {
      schema: {
        tags: ['System'],
        summary: 'Service health check',
        response: {
          200: healthResponseSchema
        }
      }
    },
    async (_req, reply) => {
      const payload = await deps.getHealth.execute();
      return reply.code(200).send(payload);
    }
  );
}

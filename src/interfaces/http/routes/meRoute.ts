import type { FastifyInstance } from 'fastify';
import type { GetMe } from '@/application/usecases/getMe.js';
import { requireAuth } from '@/interfaces/http/middleware/requireAuth.js';

const principalSchema = {
  type: 'object',
  properties: {
    sub: { type: 'string' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string' },
    roles: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['sub', 'roles'],
  additionalProperties: false
} as const;

const meResponseSchema = {
  type: 'object',
  properties: {
    authenticated: { type: 'boolean' },
    user: {
      ...principalSchema,
      nullable: true
    }
  },
  required: ['authenticated'],
  additionalProperties: false
} as const;

export async function registerMeRoute(app: FastifyInstance, deps: { getMe: GetMe }) {
  app.get(
    '/me',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Auth'],
        summary: 'Return the authenticated principal',
        response: {
          200: meResponseSchema
        }
      }
    },
    async (req, reply) => {
      const payload = await deps.getMe.execute(req.principal!);
      return reply.code(200).send(payload);
    }
  );
}

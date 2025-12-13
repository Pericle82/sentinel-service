import type { FastifyInstance } from 'fastify';
import type { AuthorizationService } from '@/application/authorization/authorize.js';
import type { RunJob } from '@/application/usecases/runJob.js';
import { requirePermission } from '@/interfaces/http/middleware/requirePermission.js';

export async function registerAdminJobsRoute(
  app: FastifyInstance,
  deps: { authz: AuthorizationService; runJob: RunJob }
) {
  app.post(
    '/admin/jobs/:name/run',
    { preHandler: [requirePermission(deps.authz, 'adminJobs.run')] },
    async (req, reply) => {
      const name = (req.params as { name: string }).name;
      await deps.runJob.execute(name);
      return reply.code(200).send({ ok: true, job: name });
    }
  );
}

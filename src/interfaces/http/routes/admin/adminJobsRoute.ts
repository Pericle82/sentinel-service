import type { FastifyInstance } from 'fastify';
import type { AuthorizationService } from '@/application/authorization/authorize.js';
import type { RunJob } from '@/application/usecases/runJob.js';
import type { AuditLogger } from '@/application/ports/audit/AuditLogger.js';
import { requirePermission } from '@/interfaces/http/middleware/requirePermission.js';

/**
 * Registers the admin job run endpoint, enforcing permissions and auditing results.
 */
export async function registerAdminJobsRoute(
  app: FastifyInstance,
  deps: { authz: AuthorizationService; runJob: RunJob; auditLogger: AuditLogger }
) {
  app.post(
    '/admin/jobs/:name/run',
    { preHandler: [requirePermission(deps.authz, 'adminJobs.run')] },
    async (req, reply) => {
      const name = (req.params as { name: string }).name;
      const actor = req.principal;

      try {
        await deps.runJob.execute(name);
        await deps.auditLogger.record({
          timestamp: new Date().toISOString(),
          actor: actor ? { sub: actor.sub, roles: actor.roles } : undefined,
          action: 'job.run',
          resource: name,
          outcome: 'success'
        });
        return reply.code(200).send({ ok: true, job: name });
      } catch (err) {
        await deps.auditLogger.record({
          timestamp: new Date().toISOString(),
          actor: actor ? { sub: actor.sub, roles: actor.roles } : undefined,
          action: 'job.run',
          resource: name,
          outcome: 'failure',
          error: err instanceof Error ? err.message : 'unknown error'
        });
        throw err;
      }
    }
  );
}

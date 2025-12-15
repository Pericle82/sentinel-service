import type { FastifyInstance } from 'fastify';
import { requireAuth } from '@/interfaces/http/middleware/requireAuth.js';
import type {
  GetUserProfile,
  UpsertUserProfile,
  PatchUserProfile,
  DeleteUserProfile,
  CalculateUserBmi,
  GetProfileCompletion
} from '@/application/usecases/userProfile.js';
import type { AuditLogger } from '@/application/ports/audit/AuditLogger.js';

export async function registerUserProfileRoutes(app: FastifyInstance, deps: {
  getProfile: GetUserProfile;
  upsertProfile: UpsertUserProfile;
  patchProfile: PatchUserProfile;
  deleteProfile: DeleteUserProfile;
  calcBmi: CalculateUserBmi;
  profileCompletion: GetProfileCompletion;
  auditLogger: AuditLogger;
}) {
  app.get('/user-profile', { preHandler: [requireAuth] }, async (req, reply) => {
    try {
      const data = await deps.getProfile.execute(req.principal!);
      await deps.auditLogger.record({
        timestamp: new Date().toISOString(),
        actor: req.principal ? { sub: req.principal.sub, roles: req.principal.roles } : undefined,
        action: 'profile.get',
        resource: req.principal?.sub,
        outcome: 'success'
      });
      return reply.code(200).send({ success: true, data });
    } catch (err) {
      await deps.auditLogger.record({
        timestamp: new Date().toISOString(),
        actor: req.principal ? { sub: req.principal.sub, roles: req.principal.roles } : undefined,
        action: 'profile.get',
        resource: req.principal?.sub,
        outcome: 'failure',
        error: err instanceof Error ? err.message : 'unknown error'
      });
      throw err;
    }
  });

  app.put('/user-profile', { preHandler: [requireAuth] }, async (req, reply) => {
    const input = req.body as unknown;
    try {
      const result = await deps.upsertProfile.execute(req.principal!, input as never);
      await deps.auditLogger.record({
        timestamp: new Date().toISOString(),
        actor: req.principal ? { sub: req.principal.sub, roles: req.principal.roles } : undefined,
        action: 'profile.upsert',
        resource: req.principal?.sub,
        outcome: 'success'
      });
      return reply
        .code(result.created ? 201 : 200)
        .send({ success: true, data: result.profile, created: result.created });
    } catch (err) {
      await deps.auditLogger.record({
        timestamp: new Date().toISOString(),
        actor: req.principal ? { sub: req.principal.sub, roles: req.principal.roles } : undefined,
        action: 'profile.upsert',
        resource: req.principal?.sub,
        outcome: 'failure',
        error: err instanceof Error ? err.message : 'unknown error'
      });
      throw err;
    }
  });

  app.patch('/user-profile', { preHandler: [requireAuth] }, async (req, reply) => {
    const input = req.body as unknown;
    try {
      const profile = await deps.patchProfile.execute(req.principal!, input as never);
      await deps.auditLogger.record({
        timestamp: new Date().toISOString(),
        actor: req.principal ? { sub: req.principal.sub, roles: req.principal.roles } : undefined,
        action: 'profile.patch',
        resource: req.principal?.sub,
        outcome: 'success'
      });
      return reply.code(200).send({ success: true, data: profile });
    } catch (err) {
      await deps.auditLogger.record({
        timestamp: new Date().toISOString(),
        actor: req.principal ? { sub: req.principal.sub, roles: req.principal.roles } : undefined,
        action: 'profile.patch',
        resource: req.principal?.sub,
        outcome: 'failure',
        error: err instanceof Error ? err.message : 'unknown error'
      });
      throw err;
    }
  });

  app.delete('/user-profile', { preHandler: [requireAuth] }, async (req, reply) => {
    try {
      await deps.deleteProfile.execute(req.principal!);
      await deps.auditLogger.record({
        timestamp: new Date().toISOString(),
        actor: req.principal ? { sub: req.principal.sub, roles: req.principal.roles } : undefined,
        action: 'profile.delete',
        resource: req.principal?.sub,
        outcome: 'success'
      });
      return reply.code(204).send();
    } catch (err) {
      await deps.auditLogger.record({
        timestamp: new Date().toISOString(),
        actor: req.principal ? { sub: req.principal.sub, roles: req.principal.roles } : undefined,
        action: 'profile.delete',
        resource: req.principal?.sub,
        outcome: 'failure',
        error: err instanceof Error ? err.message : 'unknown error'
      });
      throw err;
    }
  });

  app.get('/user-profile/bmi', { preHandler: [requireAuth] }, async (req, reply) => {
    try {
      const bmi = await deps.calcBmi.execute(req.principal!);
      await deps.auditLogger.record({
        timestamp: new Date().toISOString(),
        actor: req.principal ? { sub: req.principal.sub, roles: req.principal.roles } : undefined,
        action: 'profile.bmi',
        resource: req.principal?.sub,
        outcome: 'success'
      });
      return reply.code(200).send({ success: true, data: bmi });
    } catch (err) {
      await deps.auditLogger.record({
        timestamp: new Date().toISOString(),
        actor: req.principal ? { sub: req.principal.sub, roles: req.principal.roles } : undefined,
        action: 'profile.bmi',
        resource: req.principal?.sub,
        outcome: 'failure',
        error: err instanceof Error ? err.message : 'unknown error'
      });
      throw err;
    }
  });

  app.get('/user-profile/completion', { preHandler: [requireAuth] }, async (req, reply) => {
    try {
      const completion = await deps.profileCompletion.execute(req.principal!);
      await deps.auditLogger.record({
        timestamp: new Date().toISOString(),
        actor: req.principal ? { sub: req.principal.sub, roles: req.principal.roles } : undefined,
        action: 'profile.completion',
        resource: req.principal?.sub,
        outcome: 'success'
      });
      return reply.code(200).send({ success: true, data: completion });
    } catch (err) {
      await deps.auditLogger.record({
        timestamp: new Date().toISOString(),
        actor: req.principal ? { sub: req.principal.sub, roles: req.principal.roles } : undefined,
        action: 'profile.completion',
        resource: req.principal?.sub,
        outcome: 'failure',
        error: err instanceof Error ? err.message : 'unknown error'
      });
      throw err;
    }
  });
}

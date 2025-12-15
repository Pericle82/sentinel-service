import type { AuditEvent, AuditLogger } from '@/application/ports/audit/AuditLogger.js';
import type { Database } from '@/application/ports/db/Database.js';

export function createPostgresAuditLogger(db: Database): AuditLogger {
  return {
    async record(event: AuditEvent): Promise<void> {
      await db.query(
        `INSERT INTO audit_log (created_at, actor_sub, actor_roles, action, resource, outcome, error, meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)` as const,
        [
          event.timestamp,
          event.actor?.sub ?? null,
          event.actor?.roles ?? null,
          event.action,
          event.resource ?? null,
          event.outcome,
          event.error ?? null,
          event.meta ?? null
        ]
      );
    }
  };
}

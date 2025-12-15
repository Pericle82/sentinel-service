import type { AuditEvent, AuditLogger } from '@/application/ports/audit/AuditLogger.js';

export function createInMemoryAuditLogger() {
  const events: AuditEvent[] = [];

  const logger: AuditLogger = {
    async record(event: AuditEvent) {
      events.push(event);
    }
  };

  return { logger, getEvents: () => [...events] };
}

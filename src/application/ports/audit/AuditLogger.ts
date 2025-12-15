/**
 * Structured audit event emitted by HTTP handlers and jobs.
 */
export type AuditEvent = {
  timestamp: string;
  actor?: { sub: string; roles?: string[] } | undefined;
  action: string;
  resource?: string | undefined;
  outcome: 'success' | 'failure';
  error?: string | undefined;
  meta?: Record<string, unknown> | undefined;
};

export interface AuditLogger {
  record(event: AuditEvent): Promise<void>;
}
